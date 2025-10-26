let frequenciaAtual = 60;

// Event listeners para seleção de frequência
document.querySelectorAll('.freq-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        frequenciaAtual = parseInt(this.dataset.freq);
    });
});

// Event listeners para auto-cálculo ao pressionar Enter
['w1', 'w2', 'vl', 'il', 'fpDesejado'].forEach(id => {
    document.getElementById(id).addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            calcularPotencias();
        }
    });
});

function calcularPotencias() {
    // Limpar mensagens anteriores
    document.getElementById('errorMessage').classList.remove('show');
    document.getElementById('successMessage').classList.remove('show');

    // Obter valores de entrada
    const w1 = parseFloat(document.getElementById('w1').value);
    const w2 = parseFloat(document.getElementById('w2').value);
    const vl = parseFloat(document.getElementById('vl').value);
    const il = parseFloat(document.getElementById('il').value);
    const fpDesejado = parseFloat(document.getElementById('fpDesejado').value);

    // Validação de entrada
    if (isNaN(w1) || isNaN(w2) || isNaN(vl) || isNaN(il)) {
        mostrarErro('Por favor, preencha todos os campos de entrada com valores válidos.');
        return;
    }

    if (vl <= 0 || il <= 0) {
        mostrarErro('Tensão e corrente devem ser valores positivos.');
        return;
    }

    if (fpDesejado <= 0 || fpDesejado > 1) {
        mostrarErro('O fator de potência desejado deve estar entre 0 e 1.');
        return;
    }

    try {
        // Cálculos conforme método dos dois wattímetros
        const P3f = w1 + w2; // Potência ativa trifásica
        const Q3f = Math.sqrt(3) * (w2 - w1); // Potência reativa trifásica
        const S3f = Math.sqrt(P3f ** 2 + Q3f ** 2); // Potência aparente trifásica

        // Fator de potência e ângulo
        let fp = P3f / S3f;
        if (isNaN(fp) || !isFinite(fp)) {
            fp = 0;
        }

        const phi = Math.acos(Math.max(-1, Math.min(1, fp))) * (180 / Math.PI);
        const phiRad = phi * (Math.PI / 180);

        // Determinar tipo de carga
        let tipoCarga = 'Resistiva';
        if (Q3f > 0.1) {
            tipoCarga = 'Indutiva';
        } else if (Q3f < -0.1) {
            tipoCarga = 'Capacitiva';
        }

        // Cálculo do capacitor para correção
        const phiDesejado = Math.acos(fpDesejado) * (Math.PI / 180);
        const Qc = P3f * (Math.tan(phiRad) - Math.tan(phiDesejado));
        const C = (Qc * 1e6) / (3 * 2 * Math.PI * frequenciaAtual * vl ** 2);

        // Atualizar resultados
        document.getElementById('resultP').textContent = P3f.toFixed(2);
        document.getElementById('resultQ').textContent = Q3f.toFixed(2);
        document.getElementById('resultS').textContent = S3f.toFixed(2);
        document.getElementById('resultFP').textContent = fp.toFixed(4);
        document.getElementById('resultPhi').textContent = phi.toFixed(2);
        document.getElementById('resultTipo').textContent = tipoCarga;
        document.getElementById('resultC').textContent = Math.max(0, C).toFixed(2);
        document.getElementById('fpDesejadoDisplay').textContent = fpDesejado.toFixed(2);

        // Mostrar fórmulas
        document.getElementById('formulaDisplay').style.display = 'block';

        // Desenhar triângulo de potências
        desenharTriangulo(P3f, Q3f, S3f, phi, tipoCarga);
        document.getElementById('triangleContainer').style.display = 'flex';

        // Mostrar mensagem de sucesso
        document.getElementById('successMessage').classList.add('show');

    } catch (error) {
        mostrarErro('Erro ao realizar cálculos: ' + error.message);
    }
}

function desenharTriangulo(p, q, s, phi, tipoCarga) {
    const canvas = document.getElementById('triangleCanvas');
    const ctx = canvas.getContext('2d');

    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dimensões do canvas
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Parâmetros fixos para o desenho ilustrativo
    const pLength = 150; // Comprimento fixo para P
    const qLength = 100; // Comprimento fixo para Q
    const offsetX = 50;
    const offsetY = canvasHeight - 30;

    // Cores
    const colorP = '#0fa96c'; // Cor para P (Ativa)
    const colorQ = q > 0 ? '#ff9800' : '#00612c'; // Laranja para Q Indutiva, Verde Escuro para Q Capacitiva
    const colorS = '#04733c'; // Cor para S (Aparente)
    const colorAngle = '#f44336'; // Cor para o ângulo

    // 1. Desenhar Eixos
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Eixo P (horizontal)
    ctx.moveTo(offsetX - 10, offsetY);
    ctx.lineTo(canvasWidth - 10, offsetY);
    // Eixo Q (vertical)
    ctx.moveTo(offsetX, offsetY + 10);
    ctx.lineTo(offsetX, 10);
    ctx.stroke();

    // 2. Desenhar Triângulo Fixo (Indutivo como padrão visual)
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY); // Origem
    ctx.lineTo(offsetX + pLength, offsetY); // Lado P
    ctx.lineTo(offsetX + pLength, offsetY - qLength); // Lado Q (Indutivo)
    ctx.closePath();

    // 3. Preenchimento (Ilustrativo)
    ctx.fillStyle = 'rgba(15, 169, 108, 0.1)';
    ctx.fill();

    // 4. Desenhar os lados com cores e espessuras
    // Lado P (Ativa)
    ctx.strokeStyle = colorP;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY);
    ctx.stroke();

    // Lado Q (Reativa)
    ctx.strokeStyle = colorQ;
    ctx.beginPath();
    ctx.moveTo(offsetX + pLength, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY - qLength);
    ctx.stroke();

    // Lado S (Aparente)
    ctx.strokeStyle = colorS;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + pLength, offsetY - qLength);
    ctx.stroke();
    ctx.lineWidth = 3; // Reset

    // 5. Desenhar Ângulo (Ilustrativo)
    ctx.strokeStyle = colorAngle;
    ctx.beginPath();
    const angleRadius = 35;
    ctx.arc(offsetX, offsetY, angleRadius, -Math.atan2(qLength, pLength), 0, false);
    ctx.stroke();

    // 6. Labels dos Eixos
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('P (W)', canvasWidth - 15, offsetY + 15);
    ctx.textAlign = 'center';
    ctx.fillText('Q (VAr)', offsetX - 15, 15);

    // 7. Labels dos Valores Calculados
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';

    // Label P (Posição fixa no meio do vetor P)
    ctx.fillStyle = colorP;
    ctx.fillText('P = ' + p.toFixed(0) + ' W', offsetX + pLength / 2, offsetY + 25);

    // Label Q (Posição fixa no meio do vetor Q)
    ctx.fillStyle = colorQ;
    ctx.textAlign = 'right';
    ctx.fillText('Q = ' + Math.abs(q).toFixed(0) + ' VAr', offsetX + pLength + 15, offsetY - qLength / 2);

    // Label S (Posição fixa na hipotenusa)
    ctx.fillStyle = colorS;
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Arial';
    ctx.fillText('S = ' + s.toFixed(0) + ' VA', offsetX + pLength / 2 - 30, offsetY - qLength / 2 - 20);

    // Label φ (Posição fixa no arco)
    ctx.fillStyle = colorAngle;
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('φ = ' + phi.toFixed(1) + '°', offsetX + 50, offsetY - 8);

    // 8. Indicador de Tipo de Carga
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tipoCarga.toUpperCase(), canvasWidth / 2, 20);
}

function limparFormulario() {
    document.getElementById('w1').value = '';
    document.getElementById('w2').value = '';
    document.getElementById('vl').value = '';
    document.getElementById('il').value = '';
    document.getElementById('fpDesejado').value = '0.95';

    document.getElementById('resultP').textContent = '0';
    document.getElementById('resultQ').textContent = '0';
    document.getElementById('resultS').textContent = '0';
    document.getElementById('resultFP').textContent = '0';
    document.getElementById('resultPhi').textContent = '0';
    document.getElementById('resultTipo').textContent = '-';
    document.getElementById('resultC').textContent = '0';

    document.getElementById('formulaDisplay').style.display = 'none';
    document.getElementById('triangleContainer').style.display = 'none';
    document.getElementById('errorMessage').classList.remove('show');
    document.getElementById('successMessage').classList.remove('show');

    document.getElementById('w1').focus();
}


function mostrarErro(mensagem) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = '✗ ' + mensagem;
    errorDiv.classList.add('show');
}

