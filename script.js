// ================================================
//  CALCULADORA DE POTÊNCIA TRIFÁSICA
//  Melhor Combinação de Capacitores em Paralelo
// ================================================

let frequenciaAtual = 60;
let tipoLigacao = 'Y';
let resultadosValidos = false;
let serieCapacitorAtual = 'UCWT_Trifasico_60Hz';

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

// Seletor de série de capacitores
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

// Calcular com Enter
['w1', 'w2', 'vl', 'il', 'fpDesejado'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keypress', e => {
        if (e.key === 'Enter') calcularPotencias();
    });
});

// ==================== CÁLCULO PRINCIPAL ====================
function calcularPotencias() {
    const errorEl = document.getElementById('errorMessage');
    const successEl = document.getElementById('successMessage');
    const wegContainer = document.getElementById('resultado-weg-container');
    const combinacoesContainer = document.getElementById('combinacoes-container');

    // Reset visual
    errorEl.classList.remove('show');
    successEl.classList.remove('show');
    wegContainer.style.display = 'none';
    combinacoesContainer.style.display = 'none';

    // ==================== ENTRADAS ====================
    const w1 = Number(document.getElementById('w1').value);
    const w2 = Number(document.getElementById('w2').value);
    const vl = Number(document.getElementById('vl').value);
    const il = Number(document.getElementById('il').value);
    const fpDesejado = Number(document.getElementById('fpDesejado').value);

    // ==================== VALIDAÇÕES ====================
    if ([w1, w2, vl, il, fpDesejado].some(v => isNaN(v))) {
        mostrarErro('Preencha todos os campos com valores válidos.');
        return;
    }

    if (vl <= 0 || il <= 0) {
        mostrarErro('Tensão e corrente devem ser maiores que zero.');
        return;
    }

    if (fpDesejado < 0.7 || fpDesejado > 1) {
        mostrarErro('Fator de potência desejado deve estar entre 0.7 e 1.0');
        return;
    }

    try {
        // ==================== CÁLCULOS ELÉTRICOS ====================
        const P = w1 + w2;
        const Q = Math.sqrt(3) * (w1 - w2);
        const S = Math.hypot(P, Q);

        const fp = S > 0 ? P / S : 0;

        const phiRad = Math.acos(Math.max(-1, Math.min(1, fp)));
        const phiDeg = phiRad * 180 / Math.PI;

        const phiDesejadoRad = Math.acos(fpDesejado);

        // Potência reativa necessária para correção
        const Qc = P * (Math.tan(phiRad) - Math.tan(phiDesejadoRad));

        // ==================== TIPO DE CARGA ====================
        let tipoCarga = '';
        const tolerancia = 10;

        if (Math.abs(w1 - w2) < tolerancia) {
            tipoCarga = 'Resistiva';
        } else if (w1 > w2) {
            tipoCarga = 'Indutiva';
        } else {
            tipoCarga = 'Capacitiva';
        }

        // ==================== CÁLCULO DO CAPACITOR ====================
        const omega = 2 * Math.PI * frequenciaAtual;
        let C = 0;

        // CORREÇÃO: Calcula capacitância se houver reativa positiva a compensar
        if (Qc > 0.1) {
            if (tipoLigacao === 'Y') {
                // Ligação em Y: V_fase = V_linha / √3
                const vFase = vl / Math.sqrt(3);
                C = (Qc * 1e6) / (3 * omega * vFase * vFase);
            } else {
                // Ligação em Delta: usa tensão de linha diretamente
                C = (Qc * 1e6) / (3 * omega * vl * vl);
            }
        } else {
            C = 0; // Nenhuma correção necessária
        }

        // Debug no console
        console.log('=== CÁLCULO DE CAPACITÂNCIA ===');
        console.log('W1:', w1.toFixed(2), 'W | W2:', w2.toFixed(2), 'W');
        console.log('P (Ativa):', P.toFixed(2), 'W');
        console.log('Q (Reativa):', Q.toFixed(2), 'VAr');
        console.log('FP Atual:', fp.toFixed(4));
        console.log('Ângulo φ:', phiDeg.toFixed(2), '°');
        console.log('Qc (Reativa Comp.):', Qc.toFixed(2), 'VAr');
        console.log('Tipo de Carga:', tipoCarga);
        console.log('Ligação:', tipoLigacao);
        console.log('Tensão de Linha:', vl.toFixed(2), 'V');
        console.log('Frequência:', frequenciaAtual, 'Hz');
        console.log('Omega (ω):', omega.toFixed(2));
        console.log('Capacitância Calculada:', C.toFixed(4), 'µF');
        console.log('================================');

        // ==================== TRATAMENTO PARA EXIBIÇÃO ====================
        const QExibido = Math.abs(Q);
        const CExibido = Math.max(0, C);

        // ==================== ATUALIZA INTERFACE ====================
        document.getElementById('resultP').textContent = P.toFixed(1);
        document.getElementById('resultQ').textContent = QExibido.toFixed(1);
        document.getElementById('resultS').textContent = S.toFixed(1);
        document.getElementById('resultFP').textContent = fp.toFixed(4);
        document.getElementById('resultPhi').textContent = phiDeg.toFixed(1);
        document.getElementById('resultC').textContent = CExibido.toFixed(2);
        document.getElementById('fpDesejadoDisplay').textContent = fpDesejado.toFixed(2);
        document.getElementById('resultTipo').textContent = tipoCarga;

        // ==================== EXIBIÇÃO ====================
        document.getElementById('formulaDisplay').style.display = 'block';
        document.getElementById('triangleContainer').style.display = 'flex';

        desenharTriangulo("triangleCanvas", P, Q, S, phiDeg, tipoCarga);

        successEl.classList.add('show');
        resultadosValidos = true;

        // ==================== WEG ====================
        if (CExibido > 3) {
            renderizarCardWEG(CExibido, vl);
            gerarSugestoesCombinacoes(CExibido, vl);
        } else if (CExibido > 0) {
            // Se capacitância for pequena mas positiva, ainda tenta exibir
            renderizarCardWEG(CExibido, vl);
            gerarSugestoesCombinacoes(CExibido, vl);
        }

    } catch (err) {
        mostrarErro('Erro ao realizar os cálculos.');
        console.error('Erro detalhado:', err);
    }
}

// ==================== OBTER TENSÃO CORRETA ====================
function obterTensaoChave(vl) {
    const tensoes = [220, 380, 440, 480, 535];
    let tensaoChave = "220V";
    let menorDiff = Math.abs(vl - 220);

    for (let tensao of tensoes) {
        const diff = Math.abs(vl - tensao);
        if (diff < menorDiff) {
            menorDiff = diff;
            tensaoChave = tensao + "V";
        }
    }

    return tensaoChave;
}

// ==================== CAPACITOR INDIVIDUAL COM IMAGEM ====================
function renderizarCardWEG(cUf, vl) {
    const container = document.getElementById('resultado-weg-container');
    const tensaoChave = obterTensaoChave(vl);
    
    const serie = DB_CAPACITORES[serieCapacitorAtual];
    if (!serie || !serie[tensaoChave]) {
        container.innerHTML = `<p class="text-warning">Nenhum capacitor disponível para ${tensaoChave}</p>`;
        container.style.display = 'block';
        return;
    }

    const lista = serie[tensaoChave];

    let melhor = lista[0];
    let menorDiff = Math.abs(lista[0].uF - cUf);

    for (let p of lista) {
        const diff = Math.abs(p.uF - cUf);
        if (diff < menorDiff) {
            menorDiff = diff;
            melhor = p;
        }
    }

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
                                <span class="s-label">
                                    <i class="bi bi-lightning-charge"></i> Potência
                                </span>
                                <span class="s-value">${melhor.kvar} kVAr</span>
                            </div>
                            <div class="spec-item">
                                <span class="s-label">
                                    <i class="bi bi-activity"></i> Tensão
                                </span>
                                <span class="s-value">${tensaoChave}</span>
                            </div>
                            <div class="spec-item">
                                <span class="s-label">
                                    <i class="bi bi-diagram-2"></i> Capacitância
                                </span>
                                <span class="s-value">${melhor.uF} µF</span>
                            </div>
                        </div>

                        <div class="cap-card-note">
                            <i class="bi bi-check-circle-fill text-success"></i> 
                            <span>Melhor capacitor individual encontrado</span>
                        </div>

                        <div class="cap-card-footer">
                            <a href="${linkWeg}" target="_blank" class="btn-weg">
                                <i class="bi bi-box-arrow-up-right"></i> Ver no site da WEG
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.style.display = 'block';
}

// ==================== MELHOR COMBINAÇÃO DE 2 OU 3 CAPACITORES ====================
function gerarSugestoesCombinacoes(cNecessaria, vl) {
    const container = document.getElementById('combinacoes-list');
    const combinacoesContainer = document.getElementById('combinacoes-container');
    const tensaoChave = obterTensaoChave(vl);
    
    const serie = DB_CAPACITORES[serieCapacitorAtual];
    if (!serie || !serie[tensaoChave]) {
        combinacoesContainer.style.display = 'none';
        return;
    }

    const lista = serie[tensaoChave];

    let melhorCombinacao = null;
    let menorDiferenca = Infinity;

    // Busca melhor combinação de 2 capacitores
    for (let i = 0; i < lista.length; i++) {
        for (let j = i; j < lista.length; j++) {
            const soma = lista[i].uF + lista[j].uF;
            const diff = Math.abs(soma - cNecessaria);
            if (diff < menorDiferenca && soma <= cNecessaria * 1.25) {
                menorDiferenca = diff;
                melhorCombinacao = [lista[i], lista[j]];
            }
        }
    }

    // Busca melhor combinação de 3 capacitores
    for (let i = 0; i < lista.length; i++) {
        for (let j = i; j < lista.length; j++) {
            for (let k = j; k < lista.length; k++) {
                const soma = lista[i].uF + lista[j].uF + lista[k].uF;
                const diff = Math.abs(soma - cNecessaria);
                if (diff < menorDiferenca && soma <= cNecessaria * 1.30) {
                    menorDiferenca = diff;
                    melhorCombinacao = [lista[i], lista[j], lista[k]];
                }
            }
        }
    }

    if (melhorCombinacao && menorDiferenca < 12) {
        let capacitancias = melhorCombinacao.map(cap => cap.uF);
        let codigosHtml = melhorCombinacao.map(cap => {
            const link = `https://www.weg.net/catalog/weg/BR/pt/p/${cap.code}`;
            return `<a href="${link}" target="_blank" class="combo-code">${cap.code}</a>`;
        }).join(" <span class=\"combo-plus\">+</span> ");

        const somaTotal = capacitancias.reduce((a, b) => a + b, 0);

        const html = `
            <div class="combinacao-item melhor-combinacao">
                <div class="combo-header">
                    <i class="bi bi-diagram-3"></i>
                    <strong>Melhor Combinação Recomendada</strong>
                </div>
                <div class="combo-values">
                    <span class="combo-capacitancias">
                        ${capacitancias.join(" µF <span class=\"combo-plus\">+</span> ")} µF
                    </span>
                    <span class="combo-total">= <strong>${somaTotal.toFixed(1)} µF</strong></span>
                </div>
                <div class="combo-codes">
                    <small><strong>Códigos:</strong> ${codigosHtml}</small>
                </div>
                <div class="combo-diff">
                    <small><i class="bi bi-info-circle"></i> Diferença: <strong>${menorDiferenca.toFixed(1)} µF</strong></small>
                </div>
            </div>
        `;

        container.innerHTML = html;
        combinacoesContainer.style.display = 'block';
    } else {
        combinacoesContainer.style.display = 'none';
    }
}

// ==================== DESENHAR TRIÂNGULO ====================
function desenharTriangulo(canvasId, p, q, s, phi, tipoCarga) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // ==================== CONFIGURAÇÃO DE TELA ====================
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    // Margens e Origem dinâmica
    const margin = 60;
    const originX = margin + 10;
    // Se Q < 0 (Capacitiva), a origem sobe para o triângulo descer sem bater no fundo
    const originY = q >= 0 ? h - margin - 20 : margin + 60;

    const maxVal = s * 1.2 || 1;
    const scale = (w - margin * 2.5) / maxVal;

    const px = originX + p * scale;
    const py = originY;
    const qx = px;
    const qy = originY - (q * scale);

    // ==================== DESENHO DO GRID ====================
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Linhas verticais do grid
    for (let i = 0; i <= 5; i++) {
        let x = originX + (i * (p * scale) / 5);
        ctx.moveTo(x, margin);
        ctx.lineTo(x, h - margin);
    }
    // Linhas horizontais do grid
    for (let i = 0; i <= 5; i++) {
        let y = q >= 0 ? originY - (i * (q * scale) / 5) : originY + (i * (Math.abs(q) * scale) / 5);
        ctx.moveTo(originX, y);
        ctx.lineTo(w - margin, y);
    }
    ctx.stroke();

    // ==================== EIXOS PRINCIPAIS ====================
    ctx.strokeStyle = "#ccc";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(originX - 10, originY); ctx.lineTo(w - margin, originY); // Eixo P
    ctx.moveTo(originX, 0); ctx.lineTo(originX, h); // Eixo Q
    ctx.stroke();
    ctx.setLineDash([]);

    // ==================== TRIÂNGULO ====================
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // P (Ativa)
    ctx.beginPath();
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 4;
    ctx.moveTo(originX, originY);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Q (Reativa)
    ctx.beginPath();
    ctx.strokeStyle = q >= 0 ? "#FF9800" : "#9C27B0";
    ctx.moveTo(px, py);
    ctx.lineTo(qx, qy);
    ctx.stroke();

    // S (Aparente)
    ctx.beginPath();
    ctx.strokeStyle = "#F44336";
    ctx.lineWidth = 5;
    ctx.moveTo(originX, originY);
    ctx.lineTo(qx, qy);
    ctx.stroke();

    // ==================== ÂNGULO (PHI) ====================
    ctx.beginPath();
    ctx.strokeStyle = "#673AB7";
    ctx.lineWidth = 2;
    const raioArc = 35;
    const phiRad = (phi * Math.PI) / 180;
    const anguloFinal = q >= 0 ? -phiRad : phiRad;
    
    ctx.arc(originX, originY, raioArc, 0, anguloFinal, q >= 0);
    ctx.stroke();

    // ==================== LEGENDAS (LABELS) ====================
    ctx.font = "bold 12px Arial";
    
    // Label P
    ctx.fillStyle = "#2196F3";
    ctx.textAlign = "center";
    ctx.fillText(`P = ${p.toFixed(1)} W`, originX + (p * scale) / 2, originY + (q >= 0 ? 20 : -10));

    // Label Q
    ctx.fillStyle = q >= 0 ? "#FF9800" : "#9C27B0";
    ctx.textAlign = "left";
    ctx.fillText(`Q = ${Math.abs(q).toFixed(1)} VAr`, qx + 12, originY - (q * scale) / 2);

    // Label S
    ctx.fillStyle = "#F44336";
    ctx.textAlign = "center";
    const midSX = (originX + qx) / 2;
    const midSY = (originY + qy) / 2;
    const sOffsetX = -35;
    const sOffsetY = q >= 0 ? -25 : 35;
    ctx.fillText(`S = ${s.toFixed(1)} VA`, midSX + sOffsetX, midSY + sOffsetY);

    // Label Ângulo φ
    ctx.fillStyle = "#673AB7";
    ctx.textAlign = "left";
    ctx.fillText(`φ = ${phi.toFixed(1)}°`, originX + raioArc + 18, originY + (q >= 0 ? -18 : 22));
    
    // ==================== TÍTULO ====================
    ctx.fillStyle = "#333";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`CARGA ${tipoCarga.toUpperCase()}`, w / 2, 30);
}

// ==================== FUNÇÕES AUXILIARES ====================
function mostrarErro(msg) {
    const el = document.getElementById('errorMessage');
    el.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> ${msg}`;
    el.classList.add('show');
}

function limparFormulario() {
    ['w1','w2','vl','il'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fpDesejado').value = '0.95';
    
    // Limpar todos os resultados
    document.getElementById('resultP').textContent = '';
    document.getElementById('resultQ').textContent = '';
    document.getElementById('resultS').textContent = '';
    document.getElementById('resultFP').textContent = '';
    document.getElementById('resultPhi').textContent = '';
    document.getElementById('resultC').textContent = '';
    document.getElementById('resultTipo').textContent = '';
    document.getElementById('fpDesejadoDisplay').textContent = '';
    
    // Limpar containers
    document.getElementById('resultado-weg-container').innerHTML = '';
    document.getElementById('resultado-weg-container').style.display = 'none';
    
    document.getElementById('combinacoes-list').innerHTML = '';
    document.getElementById('combinacoes-container').style.display = 'none';
    
    // Limpar canvas
    const canvas = document.getElementById('triangleCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    document.getElementById('triangleContainer').style.display = 'none';
    document.getElementById('formulaDisplay').style.display = 'none';
    document.getElementById('errorMessage').classList.remove('show');
    document.getElementById('successMessage').classList.remove('show');
    
    resultadosValidos = false;
    document.getElementById('w1').focus();
}

function exportarCSV() {
    if (!resultadosValidos) {
        alert("Não há resultados para exportar.");
        return;
    }

    const dados = {
        W1: document.getElementById('w1').value,
        W2: document.getElementById('w2').value,
        Tensao: document.getElementById('vl').value,
        Corrente: document.getElementById('il').value,
        FP_Desejado: document.getElementById('fpDesejado').value,

        P_Ativa: document.getElementById('resultP').textContent,
        Q_Reativa: document.getElementById('resultQ').textContent,
        S_Aparente: document.getElementById('resultS').textContent,
        FP_Atual: document.getElementById('resultFP').textContent,
        Angulo: document.getElementById('resultPhi').textContent,
        Capacitancia: document.getElementById('resultC').textContent,
        Tipo_Carga: document.getElementById('resultTipo').textContent,

        Frequencia: frequenciaAtual + " Hz",
        Ligacao: tipoLigacao,
        Serie_Capacitor: serieCapacitorAtual
    };

    const cabecalho = Object.keys(dados).join(";");
    const valores = Object.values(dados).join(";");

    const csv = cabecalho + "\n" + valores;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const agora = new Date();
    const nomeArquivo = `relatorio_fp_${agora.getFullYear()}-${(agora.getMonth()+1).toString().padStart(2,'0')}-${agora.getDate().toString().padStart(2,'0')}_${agora.getHours().toString().padStart(2,'0')}-${agora.getMinutes().toString().padStart(2,'0')}.csv`;

    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== INICIALIZAÇÃO ====================
window.onload = () => {
    document.getElementById('w1').focus();
};

// ==================== FUNÇÕES DO MODAL (MÉTODO DE ARON) ====================
function abrirModal() {
    document.getElementById('modalAron').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function fecharModal() {
    document.getElementById('modalAron').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Fechar o modal se clicar fora da caixa branca
window.onclick = function(event) {
    const modal = document.getElementById('modalAron');
    if (event.target == modal) {
        fecharModal();
    }
}
