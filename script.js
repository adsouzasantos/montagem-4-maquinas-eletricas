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

    errorEl.classList.remove('show');
    successEl.classList.remove('show');
    wegContainer.style.display = 'none';
    combinacoesContainer.style.display = 'none';

    const w1 = parseFloat(document.getElementById('w1').value) || NaN;
    const w2 = parseFloat(document.getElementById('w2').value) || NaN;
    const vl = parseFloat(document.getElementById('vl').value) || NaN;
    const il = parseFloat(document.getElementById('il').value) || NaN;
    const fpDesejado = parseFloat(document.getElementById('fpDesejado').value) || NaN;

    if ([w1, w2, vl, il, fpDesejado].some(isNaN)) {
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
        const P3f = w1 + w2;
        const Q3f = Math.sqrt(3) * (w1 - w2);
        const S3f = Math.hypot(P3f, Q3f);

        const fpAtual = S3f > 0 ? P3f / S3f : 0;
        const phiRad = Math.acos(Math.max(-1, Math.min(1, fpAtual)));
        const phiDesejadoRad = Math.acos(fpDesejado);

        const Qc = P3f * (Math.tan(phiRad) - Math.tan(phiDesejadoRad));

        const omega = 2 * Math.PI * frequenciaAtual;
        let C = 0;

        if (tipoLigacao === 'Y') {
            C = Qc > 0 ? (Qc * 1e6) / (3 * omega * vl * vl) : 0;
        } else {
            C = Qc > 0 ? (Qc * 1e6) / (omega * vl * vl) : 0;
        }

        // Correção para evitar números negativos
        const QExibido = Math.abs(Q3f);
        const CExibido = Math.max(0, C);

        // Atualiza interface
        document.getElementById('resultP').textContent = P3f.toFixed(1);
        document.getElementById('resultQ').textContent = QExibido.toFixed(1);
        document.getElementById('resultS').textContent = S3f.toFixed(1);
        document.getElementById('resultFP').textContent = fpAtual.toFixed(4);
        document.getElementById('resultPhi').textContent = (phiRad * 180 / Math.PI).toFixed(1);
        document.getElementById('resultC').textContent = CExibido.toFixed(2);
        document.getElementById('fpDesejadoDisplay').textContent = fpDesejado.toFixed(2);

        // ===== CORREÇÃO: Determinar tipo de carga baseado na relação entre W1 e W2 =====
        let tipoCarga = '';
        const tolerancia = 10; // tolerância de 10W para considerar resistiva

        if (Math.abs(w1 - w2) < tolerancia) {
            tipoCarga = 'Resistiva';
        } else if (w1 > w2) {
            tipoCarga = 'Capacitiva';
        } else {
            tipoCarga = 'Indutiva';
        }

        document.getElementById('resultTipo').textContent = tipoCarga;

        document.getElementById('formulaDisplay').style.display = 'block';
        document.getElementById('triangleContainer').style.display = 'flex';

        desenharTriangulo(P3f, Q3f, S3f, phiRad * 180 / Math.PI, tipoCarga);

        successEl.classList.add('show');
        resultadosValidos = true;

        if (C > 3) {
            renderizarCardWEG(C, vl);
            gerarSugestoesCombinacoes(C, vl);
        }

    } catch (err) {
        mostrarErro('Erro ao realizar os cálculos.');
        console.error(err);
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
                <!-- COLUNA ESQUERDA: IMAGEM -->
                <div class="cap-card-image-section">
                    <div class="cap-card-image-wrapper">
                        <img src="capa.png" alt="Capacitor WEG" class="cap-card-image">
                    </div>
                    <p class="cap-card-image-disclaimer">Imagem meramente ilustrativa</p>
                </div>

                <!-- COLUNA DIREITA: INFORMAÇÕES -->
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

// ==================== TRIÂNGULO DE POTÊNCIAS MELHORADO ====================
function desenharTriangulo(p, q, s, phi, tipoCarga) {
    const canvas = document.getElementById('triangleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width, h = canvas.height;
    const padding = 60;
    const baseX = padding;
    const baseY = h - padding;

    // ===== ESCALA DINÂMICA =====
    const maxValor = Math.max(p, Math.abs(q), s) * 1.1;
    const escalaX = (w - padding * 2) / maxValor;
    const escalaY = (h - padding * 2) / maxValor;

    // ===== DESENHAR EIXOS =====
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.moveTo(baseX - 20, baseY);
    ctx.lineTo(w - padding + 20, baseY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(baseX, baseY + 20);
    ctx.lineTo(baseX, padding - 20);
    ctx.stroke();
    
    ctx.setLineDash([]);

    // ===== SETAS DOS EIXOS =====
    const arrowSize = 8;
    
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.moveTo(w - padding + 20, baseY);
    ctx.lineTo(w - padding + 20 - arrowSize, baseY - arrowSize/2);
    ctx.lineTo(w - padding + 20 - arrowSize, baseY + arrowSize/2);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(baseX, padding - 20);
    ctx.lineTo(baseX - arrowSize/2, padding - 20 + arrowSize);
    ctx.lineTo(baseX + arrowSize/2, padding - 20 + arrowSize);
    ctx.closePath();
    ctx.fill();

    // ===== LABELS DOS EIXOS =====
    ctx.fillStyle = '#666';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('P (W)', w - padding - 5, baseY - 8);
    ctx.textAlign = 'center';
    ctx.fillText('Q (VAr)', baseX + 15, padding - 8);

    // ===== DESENHAR GRID =====
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    ctx.font = '10px Arial';
    ctx.fillStyle = '#999';
    
    for (let i = 0; i <= 5; i++) {
        const x = baseX + (i * (w - padding * 2) / 5);
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x, padding);
        ctx.stroke();
        const valor = Math.round((maxValor * i / 5));
        ctx.textAlign = 'center';
        ctx.fillText(valor, x, baseY + 15);
    }
    
    for (let i = 0; i <= 5; i++) {
        const y = baseY - (i * (h - padding * 2) / 5);
        ctx.beginPath();
        ctx.moveTo(baseX, y);
        ctx.lineTo(w - padding, y);
        ctx.stroke();
        const valor = Math.round((maxValor * i / 5));
        ctx.textAlign = 'right';
        ctx.fillText(valor, baseX - 8, y + 4);
    }

    // ===== CALCULAR COORDENADAS =====
    const pX = baseX + (p * escalaX);
    const pY = baseY;
    
    const qY = baseY - (Math.abs(q) * escalaY);
    const qX = baseX + (p * escalaX);
    
    const sX = baseX + (p * escalaX);
    const sY = baseY - (Math.abs(q) * escalaY);

    // ===== DESENHAR TRIÂNGULO =====
    
    // Lado P (horizontal) - Azul
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(baseX, pY);
    ctx.lineTo(pX, pY);
    ctx.stroke();
    
    // Lado Q (vertical) - Laranja (indutiva) ou Roxo (capacitiva)
    ctx.strokeStyle = q > 0 ? '#ff9800' : '#9c27b0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pX, baseY);
    ctx.lineTo(pX, qY);
    ctx.stroke();
    
    // Lado S (hipotenusa) - Vermelho
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(sX, sY);
    ctx.stroke();

    // ===== DESENHAR ÂNGULO PHI =====
    ctx.strokeStyle = '#6a1b9a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const raioAngulo = 35;
    const anguloRad = phi * Math.PI / 180;
    ctx.arc(baseX, baseY, raioAngulo, 0, -anguloRad, true);
    ctx.stroke();

    // ===== TIPO DE CARGA NO TOPO =====
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`CARGA ${tipoCarga.toUpperCase()}`, w / 2, 25);

    // ===== LEGENDA DE CORES =====
    const legendaX = w - 200;
    const legendaY = 50;
    
    // P (Azul)
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(legendaX, legendaY, 12, 12);
    ctx.fillStyle = '#333';
    ctx.font = '9px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Potência Ativa (P) = ${p.toFixed(0)} W`, legendaX + 18, legendaY + 10);
    
    // Q (Laranja/Roxo)
    ctx.fillStyle = q > 0 ? '#ff9800' : '#9c27b0';
    ctx.fillRect(legendaX, legendaY + 20, 12, 12);
    ctx.fillStyle = '#333';
    ctx.fillText(`Potência Reativa (Q) = ${Math.abs(q).toFixed(0)} VAr`, legendaX + 18, legendaY + 30);
    
    // S (Vermelho)
    ctx.fillStyle = '#e53935';
    ctx.fillRect(legendaX, legendaY + 40, 12, 12);
    ctx.fillStyle = '#333';
    ctx.fillText(`Potência Aparente (S) = ${s.toFixed(0)} VA`, legendaX + 18, legendaY + 50);

    // φ (Roxo escuro)
    ctx.fillStyle = '#6a1b9a';
    ctx.fillRect(legendaX, legendaY + 60, 12, 12);
    ctx.fillStyle = '#333';
    ctx.fillText(`Ângulo (φ) = ${phi.toFixed(1)}°`, legendaX + 18, legendaY + 70);
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

// Inicialização
window.onload = () => {
    document.getElementById('w1').focus();
};
// FUNÇÕES DO MODAL (MÉTODO DE ARON)
function abrirModal() {
    document.getElementById('modalAron').style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Impede o scroll da página ao fundo
}

function fecharModal() {
    document.getElementById('modalAron').style.display = 'none';
    document.body.style.overflow = 'auto'; // Restaura o scroll
}

// Fechar o modal se clicar fora da caixa branca
window.onclick = function(event) {
    const modal = document.getElementById('modalAron');
    if (event.target == modal) {
        fecharModal();
    }
}