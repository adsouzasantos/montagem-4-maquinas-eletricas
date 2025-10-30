// ================================================
//  CALCULADORA DE POTÊNCIA TRIFÁSICA + CAPACITOR
// ================================================

let frequenciaAtual = 60;
let tipoLigacao = 'Y'; // 'Y' ou 'DELTA'
let resultadosValidos = false; // controla se há resultados válidos

/* -------------------------------------------------
   1. Seleção de frequência (50/60 Hz)
------------------------------------------------- */
document.querySelectorAll('.freq-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        frequenciaAtual = parseInt(this.dataset.freq, 10);
        if (resultadosValidos) {
            calcularPotencias();
        }
    });
});

/* -------------------------------------------------
   2. Botões Y / Δ (Estrela / Triângulo)
------------------------------------------------- */
const container = document.querySelector('.capacitor-section');
const ligacaoDiv = document.createElement('div');
ligacaoDiv.style.cssText = 'display:flex; gap:10px; margin-top:10px; align-items:center;';
ligacaoDiv.innerHTML = `
    <strong>Tipo de Ligação:</strong>
    <button class="ligacao-btn active" data-ligacao="Y">Y (Estrela)</button>
    <button class="ligacao-btn" data-ligacao="DELTA">Δ (Delta)</button>
`;
container.insertBefore(ligacaoDiv, container.querySelector('.capacitor-info'));

document.querySelectorAll('.ligacao-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.ligacao-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        tipoLigacao = this.dataset.ligacao;
        if (resultadosValidos) {
            calcularPotencias();
        }
    });
});

/* -------------------------------------------------
   3. Auto-cálculo com Enter
------------------------------------------------- */
['w1', 'w2', 'vl', 'il', 'fpDesejado'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('keypress', e => {
            if (e.key === 'Enter') calcularPotencias();
        });
    }
});

/* -------------------------------------------------
   4. CÁLCULO PRINCIPAL
------------------------------------------------- */
function calcularPotencias() {
    const errorEl = document.getElementById('errorMessage');
    const successEl = document.getElementById('successMessage');
    errorEl?.classList.remove('show');
    successEl?.classList.remove('show');

    const w1 = parseFloat(document.getElementById('w1').value) || NaN;
    const w2 = parseFloat(document.getElementById('w2').value) || NaN;
    const vl = parseFloat(document.getElementById('vl').value) || NaN;
    const il = parseFloat(document.getElementById('il').value) || NaN;
    const fpDesejado = parseFloat(document.getElementById('fpDesejado').value) || NaN;

    // Validação rigorosa
    if ([w1, w2, vl, il, fpDesejado].some(isNaN)) {
        mostrarErro('Preencha todos os campos com valores numéricos válidos.');
        resultadosValidos = false;
        atualizarBotaoExport();
        return;
    }
    if (vl <= 0 || il <= 0) {
        mostrarErro('Tensão e corrente devem ser maiores que zero.');
        resultadosValidos = false;
        atualizarBotaoExport();
        return;
    }
    if (fpDesejado <= 0 || fpDesejado > 1) {
        mostrarErro('Fator de potência desejado deve estar entre 0 e 1.');
        resultadosValidos = false;
        atualizarBotaoExport();
        return;
    }

    try {
        const P3f = w1 + w2;
        const Q3f = Math.sqrt(3) * (w2 - w1);
        const S3f = Math.hypot(P3f, Q3f);

        const fpAtual = S3f > 0 ? P3f / S3f : 0;
        const phiRad = Math.acos(Math.clamp(fpAtual, -1, 1));
        const phi = phiRad * (180 / Math.PI);

        let tipoCarga = 'Resistiva';
        if (Q3f > 0.1) tipoCarga = 'Indutiva';
        else if (Q3f < -0.1) tipoCarga = 'Capacitiva';

        const phiDesejado = Math.acos(fpDesejado);
        const tanPhi = Math.tan(phiRad);
        const tanPhiDesejado = Math.tan(phiDesejado);
        const Qc = P3f * (tanPhi - tanPhiDesejado);

        let C = 0;
        const omega = 2 * Math.PI * frequenciaAtual;
        if (tipoLigacao === 'Y') {
            const Vf = vl;
            C = Qc > 0 ? (Qc * 1e6) / (3 * omega * Vf * Vf) : 0;
        } else {
            C = Qc > 0 ? (Qc * 1e6) / (omega * vl * vl) : 0;
        }

        const resultados = [
            ['resultP', P3f.toFixed(1)],
            ['resultQ', Q3f.toFixed(1)],
            ['resultS', S3f.toFixed(1)],
            ['resultFP', fpAtual.toFixed(4)],
            ['resultPhi', phi.toFixed(2)],
            ['resultTipo', tipoCarga],
            ['resultC', Math.max(0, C).toFixed(2)],
            ['fpDesejadoDisplay', fpDesejado.toFixed(2)]
        ];
        resultados.forEach(([id, valor]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = valor;
        });

        document.getElementById('formulaDisplay').style.display = 'block';
        desenharTriangulo(P3f, Q3f, S3f, phi, tipoCarga);
        document.getElementById('triangleContainer').style.display = 'flex';
        successEl?.classList.add('show');

        resultadosValidos = true;
        atualizarBotaoExport();
    } catch (err) {
        mostrarErro('Erro interno: ' + err.message);
        console.error(err);
        resultadosValidos = false;
        atualizarBotaoExport();
    }
}

/* -------------------------------------------------
   5. Atualizar botão de exportação
------------------------------------------------- */
function atualizarBotaoExport() {
    const btn = document.getElementById('exportBtn');
    if (!btn) return;
    if (resultadosValidos) {
        btn.disabled = false;
        btn.classList.remove('disabled');
    } else {
        btn.disabled = true;
        btn.classList.add('disabled');
    }
}

/* -------------------------------------------------
   6. DESENHO DO TRIÂNGULO
------------------------------------------------- */
function desenharTriangulo(p, q, s, phi, tipoCarga) {
    const canvas = document.getElementById('triangleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    const pLength = 150;
    const qLength = 100;
    const offsetX = 60;
    const offsetY = h - 40;

    const colorP = '#0fa96c';
    const colorQ = q >= 0 ? '#ff9800' : '#00612c';
    const colorS = '#04733c';
    const colorAngle = '#f44336';

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(offsetX - 15, offsetY);
    ctx.lineTo(w - 20, offsetY);
    ctx.moveTo(offsetX, offsetY + 15);
    ctx.lineTo(offsetX, 15);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY - qLength);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 169, 108, 0.08)';
    ctx.fill();

    ctx.strokeStyle = colorP;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY);
    ctx.stroke();

    ctx.strokeStyle = colorQ;
    ctx.beginPath();
    ctx.moveTo(offsetX + pLength, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY - qLength);
    ctx.stroke();

    ctx.strokeStyle = colorS;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY - qLength);
    ctx.stroke();

    ctx.strokeStyle = colorAngle;
    ctx.lineWidth = 2;
    const angleRadius = 38;
    const angleEnd = -Math.atan2(qLength, pLength);
    ctx.beginPath();
    ctx.arc(offsetX, offsetY, angleRadius, angleEnd, 0, false);
    ctx.stroke();

    ctx.fillStyle = '#555';
    ctx.font = '13px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('P (W)', w - 25, offsetY + 18);
    ctx.textAlign = 'center';
    ctx.fillText('Q (VAr)', offsetX - 25, 20);

    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = colorP;
    ctx.textAlign = 'center';
    ctx.fillText(`${p.toFixed(0)} W`, offsetX + pLength / 2, offsetY + 28);

    ctx.fillStyle = colorQ;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.abs(q).toFixed(0)} VAr`, offsetX + pLength + 18, offsetY - qLength / 2 + 5);

    ctx.fillStyle = colorS;
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${s.toFixed(0)} VA`, offsetX + pLength / 2 - 35, offsetY - qLength / 2 - 22);

    ctx.fillStyle = colorAngle;
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`φ = ${phi.toFixed(1)}°`, offsetX + 52, offsetY - 10);

    ctx.fillStyle = '#d32f2f';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tipoCarga.toUpperCase(), w / 2, 28);
}

/* -------------------------------------------------
   7. Limpar formulário
------------------------------------------------- */
function limparFormulario() {
    ['w1', 'w2', 'vl', 'il'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('fpDesejado').value = '0.95';

    const zeros = ['resultP', 'resultQ', 'resultS', 'resultFP', 'resultPhi', 'resultC'];
    zeros.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
    });
    document.getElementById('resultTipo').textContent = '-';

    document.getElementById('formulaDisplay').style.display = 'none';
    document.getElementById('triangleContainer').style.display = 'none';
    document.getElementById('errorMessage')?.classList.remove('show');
    document.getElementById('successMessage')?.classList.remove('show');

    resultadosValidos = false;
    atualizarBotaoExport();
    document.getElementById('w1')?.focus();
}

/* -------------------------------------------------
   8. Exportar resultados em CSV
------------------------------------------------- */
function exportarCSV() {
    if (!resultadosValidos) {
        alert("⚠️ Nenhum resultado válido para exportar.");
        return;
    }

    const linhas = [];
    const add = (secao, nome, valor, unidade) => linhas.push(`${secao},${nome},${valor},${unidade}`);

    add("Entradas", "W1 (W)", document.getElementById('w1').value, "W");
    add("Entradas", "W2 (W)", document.getElementById('w2').value, "W");
    add("Entradas", "VL (V)", document.getElementById('vl').value, "V");
    add("Entradas", "IL (A)", document.getElementById('il').value, "A");
    add("Entradas", "Frequência", frequenciaAtual, "Hz");
    add("Entradas", "Ligação", tipoLigacao, "-");
    add("Entradas", "FP Desejado", document.getElementById('fpDesejado').value, "-");

    add("Resultados", "P (W)", document.getElementById('resultP').textContent, "W");
    add("Resultados", "Q (VAr)", document.getElementById('resultQ').textContent, "VAr");
    add("Resultados", "S (VA)", document.getElementById('resultS').textContent, "VA");
    add("Resultados", "FP", document.getElementById('resultFP').textContent, "-");
    add("Resultados", "φ (graus)", document.getElementById('resultPhi').textContent, "°");
    add("Resultados", "Tipo de Carga", document.getElementById('resultTipo').textContent, "-");
    add("Correção FP", "Capacitância por fase", document.getElementById('resultC').textContent, "µF");

    const agora = new Date();
    add("Info", "Data/Hora", agora.toLocaleString('pt-BR'), "");

    const csv = "Seção,Grandeza,Valor,Unidade\n" + linhas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "resultados_trifasicos.csv";
    link.click();
}

/* -------------------------------------------------
   9. Exibir erro
------------------------------------------------- */
function mostrarErro(mensagem) {
    const el = document.getElementById('errorMessage');
    if (el) {
        el.textContent = 'Erro: ' + mensagem;
        el.classList.add('show');
    }
}

/* -------------------------------------------------
   10. Polyfill: Math.clamp e Math.hypot
------------------------------------------------- */
if (!Math.clamp) Math.clamp = (x, min, max) => Math.min(Math.max(x, min), max);
if (!Math.hypot) Math.hypot = (x, y) => Math.sqrt(x*x + y*y);
