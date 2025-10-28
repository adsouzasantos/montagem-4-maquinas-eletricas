// ================================================
//  CALCULADORA DE POTÊNCIA TRIFÁSICA + CAPACITOR
// ================================================

let frequenciaAtual = 60;
let tipoLigacao = 'Y'; // 'Y' ou 'DELTA'

/* -------------------------------------------------
   1. Seleção de frequência (50/60 Hz)
------------------------------------------------- */
document.querySelectorAll('.freq-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        frequenciaAtual = parseInt(this.dataset.freq, 10);
        if (document.getElementById('resultC').textContent !== '0') {
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
        if (document.getElementById('resultC').textContent !== '0') {
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
    // Limpar mensagens
    const errorEl = document.getElementById('errorMessage');
    const successEl = document.getElementById('successMessage');
    errorEl?.classList.remove('show');
    successEl?.classList.remove('show');

    // Entradas
    const w1 = parseFloat(document.getElementById('w1').value) || NaN;
    const w2 = parseFloat(document.getElementById('w2').value) || NaN;
    const vl = parseFloat(document.getElementById('vl').value) || NaN;
    const il = parseFloat(document.getElementById('il').value) || NaN;
    const fpDesejado = parseFloat(document.getElementById('fpDesejado').value) || NaN;

    // Validação rigorosa
    if ([w1, w2, vl, il, fpDesejado].some(isNaN)) {
        mostrarErro('Preencha todos os campos com valores numéricos válidos.');
        return;
    }
    if (vl <= 0 || il <= 0) {
        mostrarErro('Tensão e corrente devem ser maiores que zero.');
        return;
    }
    if (fpDesejado <= 0 || fpDesejado > 1) {
        mostrarErro('Fator de potência desejado deve estar entre 0 e 1.');
        return;
    }

    try {
        // === Cálculo das potências trifásicas ===
        const P3f = w1 + w2;                                   // Potência ativa total
        const Q3f = Math.sqrt(3) * (w2 - w1);                  // Potência reativa
        const S3f = Math.hypot(P3f, Q3f);                      // Potência aparente (mais preciso)

        // Fator de potência e ângulo
        const fpAtual = S3f > 0 ? P3f / S3f : 0;
        const phiRad = Math.acos(Math.clamp(fpAtual, -1, 1));
        const phi = phiRad * (180 / Math.PI);

        // Tipo de carga
        let tipoCarga = 'Resistiva';
        if (Q3f > 0.1) tipoCarga = 'Indutiva';
        else if (Q3f < -0.1) tipoCarga = 'Capacitiva';

        // === Correção de FP: Capacitor ===
        const phiDesejado = Math.acos(fpDesejado);
        const tanPhi = Math.tan(phiRad);
        const tanPhiDesejado = Math.tan(phiDesejado);
        const Qc = P3f * (tanPhi - tanPhiDesejado); // VAr a compensar

        let C = 0;
        const omega = 2 * Math.PI * frequenciaAtual;
        if (tipoLigacao === 'Y') {
            // 3 capacitores em estrela: C por fase = Qc / (3 * ω * Vf²)
            const Vf = vl; // Tensão de fase = linha em Y
            C = Qc > 0 ? (Qc * 1e6) / (3 * omega * Vf * Vf) : 0;
        } else {
            // Delta: 3 capacitores entre fases → C total = Qc / (ω * Vl²)
            C = Qc > 0 ? (Qc * 1e6) / (omega * vl * vl) : 0;
        }

        // === Atualizar interface ===
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

        // Exibir triângulo e fórmulas
        document.getElementById('formulaDisplay').style.display = 'block';
        desenharTriangulo(P3f, Q3f, S3f, phi, tipoCarga);
        document.getElementById('triangleContainer').style.display = 'flex';
        successEl?.classList.add('show');

    } catch (err) {
        mostrarErro('Erro interno: ' + err.message);
        console.error(err);
    }
}

/* -------------------------------------------------
   5. DESENHO DO TRIÂNGULO (ILUSTRATIVO FIXO)
------------------------------------------------- */
function desenharTriangulo(p, q, s, phi, tipoCarga) {
    const canvas = document.getElementById('triangleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // --- Configurações fixas ---
    const pLength = 150;
    const qLength = 100;
    const offsetX = 60;
    const offsetY = h - 40;

    // --- Cores dinâmicas ---
    const colorP = '#0fa96c';
    const colorQ = q >= 0 ? '#ff9800' : '#00612c'; // Laranja: indutivo | Verde: capacitivo
    const colorS = '#04733c';
    const colorAngle = '#f44336';

    // 1. Eixos
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

    // 2. Triângulo (sempre acima, ilustrativo)
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY - qLength);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 169, 108, 0.08)';
    ctx.fill();

    // 3. Lados com cor
    // P
    ctx.strokeStyle = colorP;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY);
    ctx.stroke();

    // Q
    ctx.strokeStyle = colorQ;
    ctx.beginPath();
    ctx.moveTo(offsetX + pLength, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY - qLength);
    ctx.stroke();

    // S (hipotenusa)
    ctx.strokeStyle = colorS;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY - qLength);
    ctx.stroke();
    ctx.lineWidth = 3;

    // 4. Arco do ângulo φ
    ctx.strokeStyle = colorAngle;
    ctx.lineWidth = 2;
    const angleRadius = 38;
    const angleEnd = -Math.atan2(qLength, pLength);
    ctx.beginPath();
    ctx.arc(offsetX, offsetY, angleRadius, angleEnd, 0, false);
    ctx.stroke();

    // 5. Rótulos dos eixos
    ctx.fillStyle = '#555';
    ctx.font = '13px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('P (W)', w - 25, offsetY + 18);
    ctx.textAlign = 'center';
    ctx.fillText('Q (VAr)', offsetX - 25, 20);

    // 6. Valores calculados
    ctx.font = 'bold 14px Arial';

    // P
    ctx.fillStyle = colorP;
    ctx.textAlign = 'center';
    ctx.fillText(`${p.toFixed(0)} W`, offsetX + pLength / 2, offsetY + 28);

    // Q
    ctx.fillStyle = colorQ;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.abs(q).toFixed(0)} VAr`, offsetX + pLength + 18, offsetY - qLength / 2 + 5);

    // S
    ctx.fillStyle = colorS;
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${s.toFixed(0)} VA`, offsetX + pLength / 2 - 35, offsetY - qLength / 2 - 22);

    // φ
    ctx.fillStyle = colorAngle;
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`φ = ${phi.toFixed(1)}°`, offsetX + 52, offsetY - 10);

    // 7. Tipo de carga
    ctx.fillStyle = '#d32f2f';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tipoCarga.toUpperCase(), w / 2, 28);
}

/* -------------------------------------------------
   6. Limpar formulário
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

    document.getElementById('w1')?.focus();
}

/* -------------------------------------------------
   7. Exibir erro
------------------------------------------------- */
function mostrarErro(mensagem) {
    const el = document.getElementById('errorMessage');
    if (el) {
        el.textContent = 'Erro: ' + mensagem;
        el.classList.add('show');
    }
}

/* -------------------------------------------------
   8. Polyfill: Math.clamp e Math.hypot
------------------------------------------------- */
if (!Math.clamp) {
    Math.clamp = (x, min, max) => Math.min(Math.max(x, min), max);
}
if (!Math.hypot) {
    Math.hypot = (x, y) => Math.sqrt(x * x + y * y);
}
