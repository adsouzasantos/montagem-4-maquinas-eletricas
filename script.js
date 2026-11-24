// ================================================
// CALCULADORA DE POTÊNCIA TRIFÁSICA (Calc3Φ) - versão 2.0
// Método dos Dois Wattímetros + Correção do Fator de Potência
// Alterações da v2.0:
//  - núcleo de cálculo isolado em calcularNucleo() (testável fora do navegador)
//  - ângulo com sinal (atan2): carga capacitiva não recebe recomendação de capacitores
//  - leituras dos wattímetros como fonte de verdade; VL·IL usado como verificação de coerência
//  - seleção comercial pela capacitância equivalente em triângulo (unidades trifásicas UCWT
//    possuem ligação interna em triângulo), independentemente da opção Y/Δ escolhida
//  - tensão nominal do capacitor >= tensão de linha informada
//  - fator de potência resultante com os capacitores comerciais e triângulo após a correção
// ================================================

let frequenciaAtual = 60;
let tipoLigacao = 'DELTA';
let resultadosValidos = false;
let serieCapacitorAtual = 'UCWT_Trifasico_60Hz';
let ultimoResultado = null;

const LIMIAR_RESISTIVA = 0.999;   // FP a partir do qual a carga é tratada como resistiva
const LIMIAR_COERENCIA = 10;      // desvio máximo (%) aceito entre S (Aron) e √3·VL·IL
const TOLERANCIA_TENSAO = 0.98;   // aceita capacitor com Vn >= 0,98·VL
const TOLERANCIA_EXCESSO = 2;     // pontos percentuais de excesso aceitos para reduzir o número de unidades

// ==================== EVENTOS ====================

document.querySelectorAll('.freq-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        frequenciaAtual = parseInt(this.dataset.freq);
        if (resultadosValidos) calcularPotencias();
    });
});

document.querySelectorAll('.ligacao-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.ligacao-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        tipoLigacao = this.dataset.ligacao;
        if (resultadosValidos) calcularPotencias();
    });
});

// Sincroniza o estado inicial com o botão marcado como ativo no HTML
(function sincronizarEstadoInicial() {
    const ligAtiva = document.querySelector('.ligacao-btn.active');
    if (ligAtiva) tipoLigacao = ligAtiva.dataset.ligacao;
    const freqAtiva = document.querySelector('.freq-btn.active');
    if (freqAtiva) frequenciaAtual = parseInt(freqAtiva.dataset.freq);
})();

const serieBtnGroup = document.querySelectorAll('.serie-btn');
if (serieBtnGroup.length > 0) {
    serieBtnGroup.forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.serie-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            serieCapacitorAtual = this.dataset.serie;
            if (resultadosValidos) calcularPotencias();
        });
    });
}

['w1', 'w2', 'vl', 'il', 'fpDesejado'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keypress', e => {
        if (e.key === 'Enter') calcularPotencias();
    });
});

// ==================== NÚCLEO DE CÁLCULO (sem dependência da interface) ====================
function calcularNucleo(e) {
    const { w1, w2, vl, il, fpDesejado, freq, ligacao, serie, db } = e;

    // Potências pelo Método de Aron (W1: wattímetro de maior leitura em carga indutiva,
    // sequência de fases positiva)
    const P = w1 + w2;
    const Q = Math.sqrt(3) * (w1 - w2);          // válido para carga equilibrada
    const S = Math.hypot(P, Q);
    const fp = S > 0 ? P / S : 0;
    const phiRad = Math.atan2(Q, P);             // com sinal: + indutiva, - capacitiva
    const phiDeg = phiRad * 180 / Math.PI;

    // Verificação de coerência com a corrente de linha (não entra no dimensionamento)
    const sVI = Math.sqrt(3) * vl * il;
    const desvioS = sVI > 0 ? Math.abs(S - sVI) / sVI * 100 : NaN;
    const coerente = desvioS <= LIMIAR_COERENCIA;

    let tipoCarga;
    if (fp >= LIMIAR_RESISTIVA) tipoCarga = 'Resistiva';
    else if (Q > 0) tipoCarga = 'Indutiva';
    else tipoCarga = 'Capacitiva';

    // Potência reativa capacitiva necessária (somente carga indutiva abaixo do alvo)
    const phiAlvo = Math.acos(fpDesejado);
    let Qc = 0;
    if (tipoCarga === 'Indutiva') {
        Qc = Math.max(0, P * (Math.tan(phiRad) - Math.tan(phiAlvo)));
    }

    const omega = 2 * Math.PI * freq;
    const cDelta = Qc > 0 ? (Qc * 1e6) / (3 * omega * vl * vl) : 0;   // µF por fase, ligação Δ
    const cY = Qc > 0 ? (Qc * 1e6) / (omega * vl * vl) : 0;           // µF por fase, ligação Y (= 3·cDelta)
    const cPorFase = ligacao === 'Y' ? cY : cDelta;

    const selecao = cDelta > 0 ? selecionarCapacitores(cDelta, vl, omega, P, Q, db[serie]) : null;

    return { P, Q, S, fp, phiDeg, sVI, desvioS, coerente, tipoCarga, Qc, omega, cDelta, cY, cPorFase, selecao };
}

// Tensão nominal: menor tensão do catálogo que seja >= tensão de linha (com tolerância)
function obterTensaoNominal(vl, serieDb) {
    const tensoes = Object.keys(serieDb).map(k => parseFloat(k)).sort((a, b) => a - b);
    for (const t of tensoes) {
        if (t >= vl * TOLERANCIA_TENSAO) return t + 'V';
    }
    return null;
}

// Avalia uma associação em paralelo de unidades trifásicas operando na tensão VL e frequência f
function avaliarAssociacao(unidades, cDelta, vl, omega, P, Q) {
    const cTotal = unidades.reduce((a, u) => a + u.uF, 0);
    const qComercial = 3 * omega * vl * vl * cTotal * 1e-6;          // VAr efetivamente fornecidos
    const qFinal = Q - qComercial;
    const fpFinal = P / Math.hypot(P, qFinal);
    return {
        unidades,
        cTotal,
        erroAbs: cTotal - cDelta,
        erroRel: (cTotal - cDelta) / cDelta * 100,
        qComercial,
        qFinal,
        fpFinal,
        naturezaFinal: qFinal >= 0 ? 'indutivo' : 'capacitivo'
    };
}

function selecionarCapacitores(cDelta, vl, omega, P, Q, serieDb) {
    if (!serieDb) return { tensaoChave: null, individual: null, combinacao: null };
    const tensaoChave = obterTensaoNominal(vl, serieDb);
    if (!tensaoChave) return { tensaoChave: null, individual: null, combinacao: null };
    const lista = serieDb[tensaoChave];

    // Gera todas as associações de 1 a 3 unidades em paralelo
    const candidatos = [];
    const n = lista.length;
    for (let i = 0; i < n; i++) {
        candidatos.push(avaliarAssociacao([lista[i]], cDelta, vl, omega, P, Q));
        for (let j = i; j < n; j++) {
            candidatos.push(avaliarAssociacao([lista[i], lista[j]], cDelta, vl, omega, P, Q));
            for (let k = j; k < n; k++) {
                candidatos.push(avaliarAssociacao([lista[i], lista[j], lista[k]], cDelta, vl, omega, P, Q));
            }
        }
    }

    // Critério: menor excesso de capacitância que garanta o FP desejado (C >= C necessária);
    // entre soluções com excesso até TOLERANCIA_EXCESSO acima da melhor, prefere menos unidades.
    const escolher = lista => {
        const viaveis = lista.filter(c => c.erroAbs >= -1e-9);
        if (viaveis.length === 0) {
            // demanda acima da capacidade do catálogo: maior associação disponível
            return lista.reduce((a, b) => (b.cTotal > a.cTotal ? b : a));
        }
        const melhorExcesso = Math.min(...viaveis.map(c => c.erroRel));
        return viaveis
            .filter(c => c.erroRel <= melhorExcesso + TOLERANCIA_EXCESSO)
            .sort((a, b) => a.unidades.length - b.unidades.length || a.erroRel - b.erroRel)[0];
    };

    const individual = escolher(candidatos.filter(c => c.unidades.length === 1));
    const combinacao = escolher(candidatos);
    return { tensaoChave, individual, combinacao };
}

// Exporta o núcleo para testes em Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calcularNucleo, selecionarCapacitores, obterTensaoNominal, avaliarAssociacao };
}

// ==================== CÁLCULO PRINCIPAL (interface) ====================
function calcularPotencias() {
    const errorEl = document.getElementById('errorMessage');
    const successEl = document.getElementById('successMessage');
    const wegContainer = document.getElementById('resultado-weg-container');
    const combinacoesContainer = document.getElementById('combinacoes-container');

    errorEl.classList.remove('show');
    successEl.classList.remove('show');
    wegContainer.style.display = 'none';
    combinacoesContainer.style.display = 'none';

    const w1 = Number(document.getElementById('w1').value);
    const w2 = Number(document.getElementById('w2').value);
    const vl = Number(document.getElementById('vl').value);
    const il = Number(document.getElementById('il').value);
    const fpDesejado = Number(document.getElementById('fpDesejado').value);

    // ==================== VALIDAÇÕES ====================
    const campos = ['w1', 'w2', 'vl', 'il', 'fpDesejado'];
    if (campos.some(id => document.getElementById(id).value.trim() === '') ||
        [w1, w2, vl, il, fpDesejado].some(v => !isFinite(v))) {
        mostrarErro('Preencha todos os campos com valores válidos.');
        return;
    }
    if (vl <= 0 || il <= 0) {
        mostrarErro('Tensão e corrente devem ser maiores que zero.');
        return;
    }
    if (fpDesejado < 0.7 || fpDesejado > 1) {
        mostrarErro('Fator de potência desejado deve estar entre 0,70 e 1,00.');
        return;
    }
    if (w1 + w2 <= 0) {
        mostrarErro('A soma W1 + W2 deve ser positiva. Verifique a polaridade e a ligação dos wattímetros.');
        return;
    }

    try {
        const r = calcularNucleo({
            w1, w2, vl, il, fpDesejado,
            freq: frequenciaAtual,
            ligacao: tipoLigacao,
            serie: serieCapacitorAtual,
            db: DB_CAPACITORES
        });
        ultimoResultado = { entradas: { w1, w2, vl, il, fpDesejado }, ...r };

        document.getElementById('resultP').textContent = r.P.toFixed(1);
        document.getElementById('resultQ').textContent = Math.abs(r.Q).toFixed(1);
        document.getElementById('resultS').textContent = r.S.toFixed(1);
        document.getElementById('resultFP').textContent = r.fp.toFixed(4);
        document.getElementById('resultPhi').textContent = Math.abs(r.phiDeg).toFixed(1);
        document.getElementById('resultC').textContent = r.cPorFase.toFixed(2);
        document.getElementById('fpDesejadoDisplay').textContent = fpDesejado.toFixed(2);
        document.getElementById('resultTipo').textContent = r.tipoCarga;

        document.getElementById('formulaDisplay').style.display = 'block';
        document.getElementById('triangleContainer').style.display = 'flex';

        const qFinal = r.selecao && r.selecao.combinacao ? r.selecao.combinacao.qFinal : null;
        desenharTriangulo('triangleCanvas', r.P, r.Q, r.S, Math.abs(r.phiDeg), r.tipoCarga, qFinal);

        renderizarDiagnostico(r);

        if (r.selecao && r.selecao.individual) {
            renderizarCardWEG(r.selecao.individual, r.selecao.tensaoChave);
            renderizarCombinacao(r.selecao.combinacao, r.selecao.tensaoChave);
        } else if (r.cDelta > 0) {
            wegContainer.innerHTML = `<p class="text-warning">Nenhum capacitor do catálogo possui tensão nominal compatível com ${vl} V.</p>`;
            wegContainer.style.display = 'block';
        }

        successEl.classList.add('show');
        resultadosValidos = true;
    } catch (err) {
        mostrarErro('Erro ao realizar os cálculos.');
        console.error('Erro detalhado:', err);
    }
}

// ==================== DIAGNÓSTICO E COERÊNCIA ====================
function obterCaixaDiagnostico() {
    let box = document.getElementById('diagnostico-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'diagnostico-box';
        box.style.cssText = 'margin:12px 0;padding:12px 14px;border-radius:10px;font-size:0.9rem;line-height:1.45;border:1px solid #d0d7de;background:#f6f8fa;';
        const ref = document.getElementById('resultado-weg-container');
        ref.parentNode.insertBefore(box, ref);
    }
    return box;
}

function fmt(v, d) { return v.toFixed(d).replace('.', ','); }

function renderizarDiagnostico(r) {
    const box = obterCaixaDiagnostico();
    const linhas = [];

    linhas.push(`<strong>Coerência das entradas:</strong> S pelas leituras = ${fmt(r.S, 1)} VA; √3·V<sub>L</sub>·I<sub>L</sub> = ${fmt(r.sVI, 1)} VA; desvio = ${fmt(r.desvioS, 1)}%.`);
    if (!r.coerente) {
        linhas.push(`<span style="color:#b45309"><i class="bi bi-exclamation-triangle-fill"></i> Desvio acima de ${LIMIAR_COERENCIA}%: as leituras dos wattímetros e a corrente de linha não descrevem a mesma carga equilibrada. Os resultados usam as leituras dos wattímetros; revise as medições, a polaridade dos instrumentos ou a hipótese de equilíbrio.</span>`);
    }

    if (r.tipoCarga === 'Capacitiva') {
        linhas.push('<strong>Carga capacitiva:</strong> não há potência reativa indutiva a compensar. A instalação de capacitores reduziria ainda mais o fator de potência; avalie a retirada de estágios de capacitores existentes.');
    } else if (r.tipoCarga === 'Indutiva' && r.Qc === 0) {
        linhas.push('<strong>Fator de potência atual já atende ao valor desejado:</strong> nenhuma correção é necessária.');
    } else if (r.Qc > 0) {
        linhas.push(`<strong>Compensação necessária:</strong> Q<sub>c</sub> = ${fmt(r.Qc, 1)} VAr; C por fase = ${fmt(r.cDelta, 2)} µF em Δ ou ${fmt(r.cY, 2)} µF em Y.`);
        linhas.push('<small>As unidades trifásicas do catálogo possuem ligação interna em triângulo; por isso a seleção comercial usa a capacitância equivalente em Δ. A opção Y aplica-se a bancos formados por capacitores monofásicos.</small>');
    }
    box.innerHTML = linhas.map(l => `<div style="margin-bottom:6px">${l}</div>`).join('');
}

// ==================== CAPACITOR INDIVIDUAL ====================
function renderizarCardWEG(sel, tensaoChave) {
    const container = document.getElementById('resultado-weg-container');
    const melhor = sel.unidades[0];
    const linkWeg = `https://www.weg.net/catalog/weg/BR/pt/p/${melhor.code}`;
    const nomeSerie = serieCapacitorAtual === 'UCWT_Trifasico_60Hz' ? 'UCWT HD Trifásico' : 'UCWT UHD Série F';

    container.innerHTML = `
        <div class="cap-card">
            <div class="cap-card-content">
                <div class="cap-card-image-section">
                    <div class="cap-card-image-wrapper">
                        <img src="capa.png" alt="Capacitor WEG" class="cap-card-image">
                    </div>
                    <p class="cap-card-image-disclaimer">Imagem meramente ilustrativa</p>
                </div>
                <div class="cap-card-info-section">
                    <div class="cap-card-header">
                        <i class="bi bi-lightning-fill weg-icon"></i>
                        <div class="cap-card-title-group">
                            <div class="family">WEG ${nomeSerie}</div>
                            <div class="model">Cód: <strong>${melhor.code}</strong></div>
                        </div>
                    </div>
                    <div class="cap-card-body">
                        <div class="specs-grid">
                            <div class="spec-item">
                                <span class="s-label"><i class="bi bi-lightning-charge"></i> Potência nominal</span>
                                <span class="s-value">${melhor.kvar} kVAr</span>
                            </div>
                            <div class="spec-item">
                                <span class="s-label"><i class="bi bi-activity"></i> Tensão nominal</span>
                                <span class="s-value">${tensaoChave}</span>
                            </div>
                            <div class="spec-item">
                                <span class="s-label"><i class="bi bi-diagram-2"></i> Capacitância</span>
                                <span class="s-value">${melhor.uF} µF</span>
                            </div>
                        </div>
                        <div class="cap-card-note">
                            <i class="bi bi-check-circle-fill text-success"></i>
                            <span>Menor unidade individual que atende ao FP desejado: excesso de ${fmt(sel.erroRel, 1)}%; fornece ${fmt(sel.qComercial, 0)} VAr na tensão e frequência informadas; FP resultante = ${fmt(sel.fpFinal, 3)} (${sel.naturezaFinal}).</span>
                        </div>
                        <div class="cap-card-footer">
                            <a href="${linkWeg}" target="_blank" rel="noopener" class="btn-weg">
                                <i class="bi bi-box-arrow-up-right"></i> Ver no site da WEG
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    container.style.display = 'block';
}

// ==================== MELHOR ASSOCIAÇÃO (1 A 3 UNIDADES) ====================
function renderizarCombinacao(sel, tensaoChave) {
    const container = document.getElementById('combinacoes-list');
    const combinacoesContainer = document.getElementById('combinacoes-container');
    if (!sel) { combinacoesContainer.style.display = 'none'; return; }

    const capacitancias = sel.unidades.map(u => u.uF);
    const codigosHtml = sel.unidades.map(u =>
        `<a href="https://www.weg.net/catalog/weg/BR/pt/p/${u.code}" target="_blank" rel="noopener" class="combo-code">${u.code}</a>`
    ).join(' <span class="combo-plus">+</span> ');

    container.innerHTML = `
        <div class="combinacao-item melhor-combinacao">
            <div class="combo-header">
                <i class="bi bi-diagram-3"></i>
                <strong>Melhor associação em paralelo (${sel.unidades.length} unidade${sel.unidades.length > 1 ? 's' : ''}, ${tensaoChave})</strong>
            </div>
            <div class="combo-values">
                <span class="combo-capacitancias">${capacitancias.join(' µF <span class="combo-plus">+</span> ')} µF</span>
                <span class="combo-total">= <strong>${sel.cTotal.toFixed(1)} µF</strong></span>
            </div>
            <div class="combo-codes"><small><strong>Códigos:</strong> ${codigosHtml}</small></div>
            <div class="combo-diff">
                <small><i class="bi bi-info-circle"></i> Diferença: <strong>${fmt(sel.erroAbs, 2)} µF (${fmt(sel.erroRel, 1)}%)</strong>;
                Q fornecida: <strong>${fmt(sel.qComercial, 0)} VAr</strong>;
                FP resultante: <strong>${fmt(sel.fpFinal, 3)} (${sel.naturezaFinal})</strong></small>
            </div>
        </div>`;
    combinacoesContainer.style.display = 'block';
}

// ==================== DESENHAR TRIÂNGULO (antes e após a correção) ====================
function desenharTriangulo(canvasId, p, q, s, phi, tipoCarga, qFinal) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const margin = 60;
    const originX = margin + 10;
    const originY = q >= 0 ? h - margin - 20 : margin + 60;

    const maxVal = s * 1.2 || 1;
    const scale = Math.min((w - margin * 2.5) / maxVal, (h - margin * 2) / (Math.abs(q) || 1));

    const px = originX + p * scale;
    const py = originY;
    const qx = px;
    const qy = originY - (q * scale);

    // Grade
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
        const x = originX + (i * (p * scale) / 5);
        ctx.moveTo(x, margin);
        ctx.lineTo(x, h - margin);
    }
    for (let i = 0; i <= 5; i++) {
        const y = q >= 0 ? originY - (i * (q * scale) / 5) : originY + (i * (Math.abs(q) * scale) / 5);
        ctx.moveTo(originX, y);
        ctx.lineTo(w - margin, y);
    }
    ctx.stroke();

    // Eixos
    ctx.strokeStyle = '#ccc';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(originX - 10, originY); ctx.lineTo(w - margin, originY);
    ctx.moveTo(originX, 0); ctx.lineTo(originX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // P
    ctx.beginPath();
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 4;
    ctx.moveTo(originX, originY);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Q
    ctx.beginPath();
    ctx.strokeStyle = q >= 0 ? '#FF9800' : '#9C27B0';
    ctx.moveTo(px, py);
    ctx.lineTo(qx, qy);
    ctx.stroke();

    // S
    ctx.beginPath();
    ctx.strokeStyle = '#F44336';
    ctx.lineWidth = 5;
    ctx.moveTo(originX, originY);
    ctx.lineTo(qx, qy);
    ctx.stroke();

    // Triângulo após a correção (tracejado)
    if (qFinal !== null && qFinal !== undefined && q > 0) {
        const qfy = originY - (qFinal * scale);
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#2E7D32';
        ctx.lineWidth = 3;
        ctx.moveTo(originX, originY);
        ctx.lineTo(px, qfy);
        ctx.stroke();
        ctx.setLineDash([]);
        const sFinal = Math.hypot(p, qFinal);
        ctx.fillStyle = '#2E7D32';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`S' = ${sFinal.toFixed(1)} VA (após correção)`, px + 12, qfy - 6);
    }

    // Ângulo
    ctx.beginPath();
    ctx.strokeStyle = '#673AB7';
    ctx.lineWidth = 2;
    const raioArc = 35;
    const phiRad = (phi * Math.PI) / 180;
    const anguloFinal = q >= 0 ? -phiRad : phiRad;
    ctx.arc(originX, originY, raioArc, 0, anguloFinal, q >= 0);
    ctx.stroke();

    // Legendas
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#2196F3';
    ctx.textAlign = 'center';
    ctx.fillText(`P = ${p.toFixed(1)} W`, originX + (p * scale) / 2, originY + (q >= 0 ? 20 : -10));

    ctx.fillStyle = q >= 0 ? '#FF9800' : '#9C27B0';
    ctx.textAlign = 'left';
    ctx.fillText(`Q = ${Math.abs(q).toFixed(1)} VAr`, qx + 12, originY - (q * scale) / 2);

    ctx.fillStyle = '#F44336';
    ctx.textAlign = 'center';
    const midSX = (originX + qx) / 2;
    const midSY = (originY + qy) / 2;
    ctx.fillText(`S = ${s.toFixed(1)} VA`, midSX - 35, midSY + (q >= 0 ? -25 : 35));

    ctx.fillStyle = '#673AB7';
    ctx.textAlign = 'left';
    ctx.fillText(`φ = ${phi.toFixed(1)}°`, originX + raioArc + 18, originY + (q >= 0 ? -18 : 22));

    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`CARGA ${tipoCarga.toUpperCase()}`, w / 2, 30);
}

// ==================== FUNÇÕES AUXILIARES ====================
function mostrarErro(msg) {
    const el = document.getElementById('errorMessage');
    el.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> ${msg}`;
    el.classList.add('show');
}

function limparFormulario() {
    ['w1', 'w2', 'vl', 'il'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fpDesejado').value = '0.95';

    ['resultP', 'resultQ', 'resultS', 'resultFP', 'resultPhi', 'resultC', 'resultTipo', 'fpDesejadoDisplay']
        .forEach(id => document.getElementById(id).textContent = '');

    document.getElementById('resultado-weg-container').innerHTML = '';
    document.getElementById('resultado-weg-container').style.display = 'none';
    document.getElementById('combinacoes-list').innerHTML = '';
    document.getElementById('combinacoes-container').style.display = 'none';
    const box = document.getElementById('diagnostico-box');
    if (box) box.remove();

    const canvas = document.getElementById('triangleCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    document.getElementById('triangleContainer').style.display = 'none';
    document.getElementById('formulaDisplay').style.display = 'none';
    document.getElementById('errorMessage').classList.remove('show');
    document.getElementById('successMessage').classList.remove('show');

    resultadosValidos = false;
    ultimoResultado = null;
    document.getElementById('w1').focus();
}

function exportarCSV() {
    if (!resultadosValidos || !ultimoResultado) {
        mostrarErro('Não há resultados para exportar.');
        return;
    }
    const r = ultimoResultado;
    const comb = r.selecao && r.selecao.combinacao;
    const ind = r.selecao && r.selecao.individual;
    const n = (v, d) => (v === null || v === undefined || !isFinite(v)) ? '' : v.toFixed(d).replace('.', ',');

    const dados = {
        W1_W: n(r.entradas.w1, 1),
        W2_W: n(r.entradas.w2, 1),
        Tensao_linha_V: n(r.entradas.vl, 1),
        Corrente_linha_A: n(r.entradas.il, 2),
        FP_desejado: n(r.entradas.fpDesejado, 2),
        Frequencia_Hz: frequenciaAtual,
        Ligacao: tipoLigacao,
        P_W: n(r.P, 1),
        Q_VAr: n(r.Q, 1),
        S_VA: n(r.S, 1),
        S_VI_VA: n(r.sVI, 1),
        Desvio_coerencia_pct: n(r.desvioS, 1),
        FP_atual: n(r.fp, 4),
        Angulo_graus: n(r.phiDeg, 2),
        Tipo_carga: r.tipoCarga,
        Qc_VAr: n(r.Qc, 1),
        C_por_fase_Delta_uF: n(r.cDelta, 2),
        C_por_fase_Y_uF: n(r.cY, 2),
        Tensao_nominal_capacitor: r.selecao ? (r.selecao.tensaoChave || '') : '',
        Unidade_individual: ind ? ind.unidades.map(u => u.code).join('+') : '',
        FP_final_individual: ind ? n(ind.fpFinal, 3) : '',
        Associacao: comb ? comb.unidades.map(u => u.code).join('+') : '',
        C_associacao_uF: comb ? n(comb.cTotal, 1) : '',
        Erro_associacao_pct: comb ? n(comb.erroRel, 1) : '',
        Q_fornecida_VAr: comb ? n(comb.qComercial, 1) : '',
        FP_final_associacao: comb ? n(comb.fpFinal, 3) : '',
        Serie_capacitor: serieCapacitorAtual
    };

    const csv = '﻿' + Object.keys(dados).join(';') + '\n' + Object.values(dados).join(';');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const agora = new Date();
    const p2 = x => x.toString().padStart(2, '0');
    const nomeArquivo = `relatorio_fp_${agora.getFullYear()}-${p2(agora.getMonth() + 1)}-${p2(agora.getDate())}_${p2(agora.getHours())}-${p2(agora.getMinutes())}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.onload = () => {
    document.getElementById('w1').focus();
};

// ==================== MODAL (MÉTODO DE ARON) ====================
function abrirModal() {
    document.getElementById('modalAron').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function fecharModal() {
    document.getElementById('modalAron').style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.onclick = function (event) {
    const modal = document.getElementById('modalAron');
    if (event.target == modal) fecharModal();
};
