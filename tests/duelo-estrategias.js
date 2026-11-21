// Estratégias simples do Duelo (doutrina × ataque × defesa) e a medição round-robin entre elas.
// Usado por tests/duelo-balanco.js (relatório) e tests/duelo.js (confere que nenhuma doutrina domina).
const M = require('../prototipo/assets/js/duelo-motor.js');
const DOUT = ['assalto', 'artilharia', 'fortaleza'];
const ATQ = ['infantaria', 'artilharia', 'blindado', 'misto'];
const DEF = ['equilibrado', 'abrigar', 'atacar'];

function plano(estrat, estado, rodada) {
    const dout = rodada === 1 ? estrat.dout : estado.doutrina;
    const orc = M.orcamento(rodada, dout);
    const ataque = { infantaria: 0, artilharia: 0, blindado: 0 };
    let sobra = orc;
    const gasta = (id, n) => { const c = M.custoDe(id, dout); n = Math.min(n, M.maxDe(id, dout), Math.floor(sobra / c)); if (n > 0) { ataque[id] += n; sobra -= n * c; } };
    if (estrat.atq === 'artilharia') { gasta('artilharia', 9); gasta('infantaria', 9); }
    else if (estrat.atq === 'blindado') { gasta('blindado', 2); gasta('infantaria', 9); }
    else if (estrat.atq === 'misto') { gasta('blindado', rodada >= 3 ? 1 : 0); gasta('artilharia', 2); gasta('infantaria', 9); }
    else { gasta('infantaria', 9); gasta('artilharia', 9); }
    const compras = []; let cmd = estado.cmd;
    ['ninho', 'bunker', 'arame', 'ninho'].forEach(id => { const m = M.D.MELHORIAS[id]; const ja = estado.melh[id] + compras.filter(x => x === id).length; if (cmd >= m.custo && ja < m.max) { compras.push(id); cmd -= m.custo; } });
    const escala = estado.soldados.map((s, i) => (s.cond < 40 ? 'descanso' : estado.trinch < 55 && s.engenheiro ? 'obras' : M.D && ['vigia', 'vigia', 'descanso', 'descanso', 'obras', 'vigia'][i]));
    return { escala, postura: estrat.def, compras, contra: false, ataque, doutrina: dout };
}
function duelo(eA, eB, semente) {
    const planos = [];
    let est = M.estadoDoDuelo(semente, planos);
    for (let r = 1; r <= 5 && !est.vencedor; r++) {
        planos.push({ A: plano(eA, est.A, r), B: plano(eB, est.B, r) });
        est = M.estadoDoDuelo(semente, planos);
    }
    est.rodadas.forEach(r => { CONT.rodadas++; if (!r.vencedor) CONT.empates++; });
    return est.vencedor || 'A';
}
const CONT = { rodadas: 0, empates: 0 };

function medir(N, semente0 = 1234) {
    const estrats = []; DOUT.forEach(d => ATQ.forEach(a => DEF.forEach(f => estrats.push({ dout: d, atq: a, def: f, nome: `${d}/${a}/${f}` }))));
    const vit = {}, jogos = {}; estrats.forEach(e => { vit[e.nome] = 0; jogos[e.nome] = 0; });
    const matriz = {}; DOUT.forEach(a => { matriz[a] = {}; DOUT.forEach(b => { matriz[a][b] = [0, 0]; }); });
    let semente = semente0;
    for (let i = 0; i < estrats.length; i++) for (let j = 0; j < estrats.length; j++) {
        if (i === j) continue;
        for (let k = 0; k < N; k++) {
            semente = (semente * 1103515245 + 12345) >>> 0;
            const v = duelo(estrats[i], estrats[j], semente);
            const a = estrats[i], b = estrats[j];
            jogos[a.nome]++; jogos[b.nome]++; vit[v === 'A' ? a.nome : b.nome]++;
            matriz[a.dout][b.dout][1]++; if (v === 'A') matriz[a.dout][b.dout][0]++;
        }
    }
    
    const taxa = (f) => { const t = {}; estrats.forEach(e => { const k = f(e); t[k] = t[k] || [0, 0]; t[k][0] += vit[e.nome]; t[k][1] += jogos[e.nome]; }); return Object.fromEntries(Object.entries(t).map(([k, [v, n]]) => [k, Math.round(1000 * v / n) / 10])); };
    const cel = (a, b) => Math.round(1000 * matriz[a][b][0] / matriz[a][b][1]) / 10;
    const rank = estrats.map(e => ({ n: e.nome, p: Math.round(1000 * vit[e.nome] / jogos[e.nome]) / 10 })).sort((x, y) => y.p - x.p);
    return { empates: CONT.rodadas ? CONT.empates / CONT.rodadas : 0, rodadas: CONT.rodadas, porDoutrina: taxa(e => e.dout), porAtaque: taxa(e => e.atq), porPostura: taxa(e => e.def), cel, rank, DOUT };
}
module.exports = { medir, M };
