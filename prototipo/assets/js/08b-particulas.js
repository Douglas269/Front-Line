// FrontLine · Trincheiras: sistema de partículas
// Carregado depois de 08-campo-ameacas.js. Terra, brasas, faíscas, clarões e fumaça nas explosões, nos tiros e nos acertos.
// - Um só conjunto ("pool") de até 500 partículas, com gravidade, arrasto, quique no chão e esmaecer;
// - Desligável em Configurações ("Partículas e fumaça"); em aparelho lento, reduz sozinho a quantidade;
// - As coordenadas são as da cena (400 de largura), as mesmas dos outros efeitos.

const PART = { MAX: 500, MAX_LEVE: 220 };
const PARTICULAS = [];
let particulasLeve = false, particulasUltimoQuadro = 0, particulasLentos = 0;
const particulasAtivas = () => typeof CONFIG === 'undefined' || CONFIG.particulas !== false;
const prt = (a, b) => a + Math.random() * (b - a);
const qtdPart = (n) => Math.max(1, Math.round(n * (particulasLeve ? 0.5 : 1)));

function emitirParticula(o) {
    PARTICULAS.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, d: 0.97, vida: 30, i: 0, r: 2, cor: [255, 200, 120], t: 'fumaca', cresce: 0, a: 1, giro: 0, ang: 0 }, o));
    const max = particulasLeve ? PART.MAX_LEVE : PART.MAX;
    while (PARTICULAS.length > max) PARTICULAS.shift();
}
// Explosão: clarão, terra que voa e quica, brasas, fumaça que sobe e poeira rasteira. campo: caiu na terra de ninguém (senão, dentro da trincheira)
function emiteExplosao(x, y, forca = 1, campo = true) {
    if (!particulasAtivas()) return;
    const chao = y + (campo ? 2 : 12);
    emitirParticula({ x, y: y - 6, t: 'clarao', vida: 9, r: 40 * forca, a: 0.95 });
    for (let i = 0; i < qtdPart(18 * forca); i++) emitirParticula({ x: x + prt(-6, 6), y: y - 2, vx: prt(-2.8, 2.8), vy: prt(-5.4, -2.2), g: 0.28, d: 0.99, vida: prt(40, 75), r: prt(1.3, 3), cor: [68 + prt(0, 34), 54 + prt(0, 22), 38], t: 'terra', chao, giro: prt(-0.3, 0.3) });
    for (let i = 0; i < qtdPart(16 * forca); i++) emitirParticula({ x, y: y - 8, vx: prt(-2.4, 2.4), vy: prt(-4.8, -1.2), g: 0.12, d: 0.985, vida: prt(30, 62), r: prt(0.9, 1.7), cor: [255, 150 + prt(0, 80), 50], t: 'brasa' });
    for (let i = 0; i < qtdPart(7 * forca); i++) emitirParticula({ x: x + prt(-8, 8), y: y - 6, vx: prt(-0.5, 0.9), vy: prt(-1.3, -0.5), g: -0.004, d: 0.985, vida: prt(100, 170), r: prt(5, 9), cresce: prt(0.12, 0.22), cor: [60, 58, 52], t: 'fumaca', a: 0.55 });
    if (campo) for (let s = -1; s <= 1; s += 2) for (let i = 0; i < qtdPart(5); i++) emitirParticula({ x, y: y + 1, vx: s * prt(1.2, 2.8), vy: prt(-0.15, 0), d: 0.94, vida: prt(24, 42), r: prt(3, 5), cresce: 0.2, cor: [120, 102, 74], t: 'fumaca', a: 0.5 });
}
// Tiro: clarão no cano, faíscas e um fio de fumaça
function emiteDisparo(x, y) {
    if (!particulasAtivas()) return;
    emitirParticula({ x, y, t: 'clarao', vida: 4, r: 12, a: 0.95 });
    for (let i = 0; i < qtdPart(4); i++) emitirParticula({ x, y, vx: prt(1.5, 3.6), vy: prt(-1, 1), d: 0.9, vida: prt(5, 9), r: 1, cor: [255, 225, 140], t: 'faisca' });
    if (!particulasLeve) emitirParticula({ x: x + 3, y, vx: 0.4, vy: -0.25, d: 0.97, vida: 28, r: 2, cresce: 0.1, cor: [150, 150, 140], t: 'fumaca', a: 0.3 });
}
// Acerto em inimigo: faíscas que caem e uma nuvem de poeira
function emiteAcerto(x, y) {
    if (!particulasAtivas()) return;
    for (let i = 0; i < qtdPart(6); i++) emitirParticula({ x, y, vx: prt(-1.9, 1.9), vy: prt(-2.4, -0.4), g: 0.14, d: 0.96, vida: prt(10, 20), r: 1, cor: [255, 220, 150], t: 'faisca' });
    emitirParticula({ x, y: y + 4, vx: prt(-0.3, 0.3), vy: -0.3, vida: 34, r: 3, cresce: 0.16, cor: [132, 114, 82], t: 'fumaca', a: 0.45 });
}
// Inimigo abatido: nuvem de poeira que sobe
function emiteMorte(x, y) {
    if (!particulasAtivas()) return;
    for (let i = 0; i < qtdPart(9); i++) emitirParticula({ x: x + prt(-3, 3), y: y - 4, vx: prt(-1.3, 1.3), vy: prt(-1.6, -0.3), d: 0.95, vida: prt(22, 40), r: prt(2, 4), cresce: 0.15, cor: [118, 100, 74], t: 'fumaca', a: 0.5 });
}
// Lança-chamas: brasas que sobem da chama
function emiteChama(x, y) {
    if (!particulasAtivas() || Math.random() > 0.6) return;
    emitirParticula({ x: x + prt(-2, 2), y: y + prt(-2, 2), vx: prt(-0.3, 0.8), vy: prt(-1.4, -0.4), g: -0.01, d: 0.97, vida: prt(14, 28), r: prt(1, 2), cor: [255, 120 + prt(0, 90), 40], t: 'brasa' });
}

function desenharParticulas() {
    const agora = performance.now(), dt = agora - particulasUltimoQuadro; particulasUltimoQuadro = agora;
    if (dt > 55 && dt < 400) { if (++particulasLentos > 20 && !particulasLeve) particulasLeve = true; } // celular engasgando: passa a usar metade das partículas
    if (!particulasAtivas()) { PARTICULAS.length = 0; return; }
    const c = cctx;
    for (let n = PARTICULAS.length - 1; n >= 0; n--) {
        const p = PARTICULAS[n]; p.i++;
        if (p.i > p.vida) { PARTICULAS.splice(n, 1); continue; }
        p.vx *= p.d; p.vy = p.vy * p.d + p.g; p.x += p.vx; p.y += p.vy; p.ang += p.giro; p.r += p.cresce;
        if (p.chao !== undefined && p.y > p.chao) { p.y = p.chao; p.vy *= -0.35; p.vx *= 0.6; if (Math.abs(p.vy) < 0.3) { p.g = 0; p.vy = 0; p.vx = 0; } }
        const k = p.i / p.vida, al = p.a * (1 - k * k);
        if (p.t === 'fumaca') { c.fillStyle = `rgba(${p.cor[0]},${p.cor[1]},${p.cor[2]},${0.55 * al})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.3); c.fill(); }
        else if (p.t === 'terra') { c.save(); c.translate(p.x, p.y); c.rotate(p.ang); c.globalAlpha = Math.min(1, 1.6 * (1 - k)); c.fillStyle = `rgb(${p.cor[0] | 0},${p.cor[1] | 0},${p.cor[2] | 0})`; c.fillRect(-p.r, -p.r * 0.7, p.r * 2, p.r * 1.4); c.restore(); }
        else if (p.t === 'brasa') { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(${p.cor[0]},${p.cor[1] | 0},${p.cor[2]},${al})`; c.beginPath(); c.arc(p.x, p.y, p.r * (1 - 0.5 * k), 0, 6.3); c.fill(); c.restore(); }
        else if (p.t === 'faisca') { c.strokeStyle = `rgba(${p.cor[0]},${p.cor[1]},${p.cor[2]},${al})`; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); c.stroke(); }
        else if (p.t === 'clarao') { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, `rgba(255,240,200,${al})`); g.addColorStop(0.4, `rgba(255,160,70,${0.5 * al})`); g.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.3); c.fill(); c.restore(); }
    }
}
// Toda explosão da cena (no campo, no posto, no soldado) ganha partículas
const _o8b_cenaEfeito = cenaEfeito;
cenaEfeito = function (tipo, alvo, vida) {
    const r = _o8b_cenaEfeito(tipo, alvo, vida);
    if (tipo === 'explosao' && particulasAtivas()) {
        const e = cenaEfeitos[cenaEfeitos.length - 1], p = e && (e.fixo || posAlvoCena(e.alvo)), campo = !!(alvo && alvo.pos);
        if (p) emiteExplosao(p.x, p.y, campo ? 1.15 : 0.75, campo);
    }
    return r;
};
const _o8b_desenharEfeitosCena = desenharEfeitosCena;
desenharEfeitosCena = function () { _o8b_desenharEfeitosCena(); desenharParticulas(); };
