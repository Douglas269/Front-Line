// Duelo: efeito de cada reforço isolado. O lado A começa com o reforço X (já em vigor), o lado B sem nada, com a mesma estratégia.
// Esperado: cada reforço dá uma vantagem real mas não decisiva (A vence uns 52% a 65%). Uso: node tests/duelo-reforcos-balanco.js [duelos]
const { M } = require('./duelo-estrategias.js');
const N = +(process.argv[2] || 300);
const estrats = [];
['assalto', 'artilharia', 'fortaleza'].forEach(d => ['infantaria', 'misto', 'artilharia'].forEach(a => estrats.push({ dout: d, atq: a })));
function plano(e, est, rodada) {
    const dout = rodada === 1 ? e.dout : est.doutrina, orc = M.orcamento(rodada, dout), ataque = { infantaria: 0, artilharia: 0, blindado: 0 }; let sobra = orc;
    const gasta = (id, n) => { const c = M.custoDe(id, dout); n = Math.min(n, M.maxDe(id, dout), Math.floor(sobra / c)); if (n > 0) { ataque[id] += n; sobra -= n * c; } };
    if (e.atq === 'artilharia') { gasta('artilharia', 9); gasta('infantaria', 9); } else if (e.atq === 'misto') { gasta('blindado', rodada >= 3 ? 1 : 0); gasta('artilharia', 2); gasta('infantaria', 9); } else { gasta('infantaria', 9); gasta('artilharia', 9); }
    const compras = []; let cmd = est.cmd; ['ninho', 'bunker', 'arame', 'ninho'].forEach(id => { const m = M.D.MELHORIAS[id]; const ja = est.melh[id] + compras.filter(x => x === id).length; if (cmd >= m.custo && ja < m.max) { compras.push(id); cmd -= m.custo; } });
    const escala = est.soldados.map((s, i) => (s.cond < 40 ? 'descanso' : est.trinch < 55 && s.engenheiro ? 'obras' : ['vigia', 'vigia', 'descanso', 'descanso', 'obras', 'vigia'][i]));
    return { escala, postura: 'equilibrado', compras, contra: false, ataque, doutrina: dout };
}
// Cada reforço é testado pelo caminho de verdade (oferta, escolha e plano): na rodada 2 o lado com o reforço escolhe X e o outro um "vazio" sem efeito.
const REAIS = JSON.parse(JSON.stringify(M.D.REFORCOS));
function duelo(eA, eB, sem, comA, comB) {
    const planos = []; let est = M.estadoDoDuelo(sem, planos);
    for (let r = 1; r <= 5 && !est.vencedor; r++) {
        const pA = plano(eA, est.A, r), pB = plano(eB, est.B, r);
        if (r === 2) { pA.reforco = comA; pB.reforco = comB; }
        planos.push({ A: pA, B: pB }); est = M.estadoDoDuelo(sem, planos);
    }
    return est.vencedor || 'A';
}
const res = {};
M.D.REFORCO_RODADAS = [2];
Object.keys(REAIS).concat(['(nenhum)']).forEach(id => {
    M.D.REFORCOS = id === '(nenhum)' ? { v1: { nome: '-', tipo: 'agora' }, v2: { nome: '-', tipo: 'agora' }, v3: { nome: '-', tipo: 'agora' } } : { [id]: REAIS[id], v1: { nome: '-', tipo: 'agora' }, v2: { nome: '-', tipo: 'agora' } };
    const meu = id === '(nenhum)' ? 'v1' : id;
    let v = 0, n = 0, sem = 99;
    for (let k = 0; k < N; k++) {
        sem = (sem * 1103515245 + 12345) >>> 0;
        const eA = estrats[k % estrats.length], eB = estrats[(k * 7 + 3) % estrats.length];
        if (duelo(eA, eB, sem, meu, 'v1') === 'A') v++; n++;      // com o reforço no lado A
        if (duelo(eB, eA, sem + 1, 'v1', meu) === 'B') v++; n++;  // e no lado B (anula a vantagem de lado)
    }
    res[id] = Math.round(1000 * v / n) / 10;
});
console.log('Vitórias de quem tem o reforço (%), com estratégias iguais:', JSON.stringify(res));
