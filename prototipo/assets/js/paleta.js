// FrontLine: paleta única do pixel art (os mesmos valores de assets/css/tokens.css, variáveis --px-*; tests/paleta.js confere).
// Usada nos soldados dos três modos: pele, farda, bota, sangue, contorno, sombra e a cor de cada soldado.
const FL_PAL = {
    contorno: '#0e0b08',                  // contorno de 1 px em volta dos sprites
    sombra: 'rgba(0,0,0,0.32)',           // sombra sob os pés
    pele: { 1: '#c99a74', 2: '#7a4f33', 3: '#e2b996', 4: '#a8714c', 5: '#d9a988', 6: '#b98159' },
    farda: '#5d6b48', fardaEscura: '#3e4a33', fardaMedico: '#5f6b4c', bota: '#2a2a22',
    sangue: '#8a1f1f',
    // cor de cada soldado (lenço e faixa do capacete): dá para saber quem é quem sem ler o nome
    soldado: { 1: '#e5483d', 2: '#3d8be5', 3: '#e8c53a', 4: '#f2f2ee', 5: '#e88a2a', 6: '#a96be5' }
};
