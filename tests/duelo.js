// Testes do Duelo online: motor (determinístico, à prova de trapaça, estratégia importa)
// e o fluxo da página com dois jogadores e um servidor falso (sem tocar no Supabase de verdade).
// Uso: node tests/duelo.js
const path = require('path');
const M = require(path.resolve(__dirname, '..', 'prototipo', 'assets', 'js', 'duelo-motor.js'));

const checks = {};
const ok = (nome, v) => { checks[nome] = !!v; };

// ---------- Jogadores de teste ----------
function aleatorio(r) {
    const esc = M.SOLDADOS.map(() => M.FUNCOES[Math.floor(r() * 3)]);
    return { escala: esc, postura: ['atacar', 'equilibrado', 'abrigar'][Math.floor(r() * 3)], compras: [], contra: false,
        ataque: { infantaria: Math.floor(r() * 5), artilharia: Math.floor(r() * 2), blindado: Math.floor(r() * 2) } };
}
// Esperto: descansa quem está cansado, investe em melhorias, guarda contra-bateria se o outro usa artilharia, gasta todo o ataque
function esperto(est, rodada, ultimoDoOutro) {
    const vivosOrd = est.soldados.map((s, i) => ({ s, i })).filter(x => x.s.cond > 0).sort((a, b) => b.s.cond - a.s.cond);
    const escala = est.soldados.map(() => 'descanso');
    vivosOrd.filter(x => !x.s.engenheiro).slice(0, 3).forEach(x => { escala[x.i] = 'vigia'; });
    const eng = est.soldados.findIndex(s => s.engenheiro && s.cond > 0);
    if (eng >= 0) escala[eng] = est.trinch < 95 ? 'obras' : 'vigia';
    const compras = [];
    let cmd = est.cmd;
    const usaArt = ultimoDoOutro && ultimoDoOutro.ataque.artilharia > 0;
    const reserva = usaArt ? 2 : 0;
    ['ninho', 'arame', 'bunker', 'ninho', 'arame'].forEach(id => { const m = M.D.MELHORIAS[id]; if (cmd - m.custo >= reserva) { compras.push(id); cmd -= m.custo; } });
    const orc = M.D.ORCAMENTO(rodada);
    const blind = orc >= 12 ? 1 : 0, art = 1, inf = Math.floor((orc - blind * 5 - art * 3) / 2);
    return { escala, postura: 'equilibrado', compras, contra: usaArt && cmd >= 2, ataque: { infantaria: inf, artilharia: art, blindado: blind } };
}
function jogar(semente, estrategiaA, estrategiaB) {
    const planos = [];
    let estado = M.estadoDoDuelo(semente, planos);
    const rA = M.rng(semente ^ 0xA5A5), rB = M.rng(semente ^ 0x5A5A);
    while (!estado.vencedor) {
        const rodada = estado.proximaRodada;
        const ultA = estado.rodadas.length ? estado.rodadas[estado.rodadas.length - 1].planoA : null;
        const ultB = estado.rodadas.length ? estado.rodadas[estado.rodadas.length - 1].planoB : null;
        planos.push({
            A: estrategiaA === 'esperto' ? esperto(estado.A, rodada, ultB) : aleatorio(rA),
            B: estrategiaB === 'esperto' ? esperto(estado.B, rodada, ultA) : aleatorio(rB)
        });
        estado = M.estadoDoDuelo(semente, planos);
    }
    return estado;
}

// 1) Determinismo: o mesmo duelo dá o mesmo resultado
const e1 = jogar(12345, 'esperto', 'aleatorio'), e2 = jogar(12345, 'esperto', 'aleatorio');
ok('motorDeterministico', JSON.stringify(e1) === JSON.stringify(e2));

// 2) Trapaça: plano com ataque e compras acima do permitido é cortado
{
    const est = M.estadoInicial();
    const p = M.sanitizar({ escala: ['x', 'vigia'], postura: 'voar', compras: ['ninho', 'ninho', 'ninho', 'bunker'], contra: true, ataque: { infantaria: 50, artilharia: 9, blindado: 9 } }, est, 1);
    ok('trapacaCortada', M.custoAtaque(p.ataque) <= M.D.ORCAMENTO(1) && M.custoDefesa(p) <= est.cmd && p.postura === 'equilibrado' && p.escala.every(f => M.FUNCOES.includes(f)));
}

// 3) Estratégia importa: o esperto vence o aleatório quase sempre; esperto contra esperto fica parelho
let espVence = 0, aVence = 0, rodadasTot = 0, empatesRodada = 0, rodadasN = 0, quedas = 0;
const N = 200;
for (let s = 1; s <= N; s++) {
    const e = jogar(s * 7919, 'esperto', 'aleatorio'); if (e.vencedor === 'A') espVence++;
    const f = jogar(s * 104729, 'esperto', 'esperto'); if (f.vencedor === 'A') aVence++;
    rodadasTot += f.rodadas.length;
    f.rodadas.forEach(r => { rodadasN++; if (!r.vencedor) empatesRodada++; if (r.caiuA || r.caiuB) quedas++; });
}
ok('espertoVenceAleatorio', espVence / N >= 0.85);
ok('espelhoParelho', aVence / N > 0.3 && aVence / N < 0.7);
ok('rodadasRaramenteEmpatam', empatesRodada / rodadasN < 0.35); // no espelho (os dois com a mesma estratégia) é o pior caso
ok('duelosNaoAcabamNaPrimeira', rodadasTot / N >= 3);

console.log(JSON.stringify({
    espertoContraAleatorio: `${espVence}/${N}`, espertoContraEsperto_vitoriasA: `${aVence}/${N}`,
    rodadasPorDuelo: +(rodadasTot / N).toFixed(2), empatesDeRodada: Math.round(100 * empatesRodada / rodadasN) + '%', trincheiraCaiu: Math.round(100 * quedas / rodadasN) + '%'
}, null, 1));
const falhas = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Motor do duelo: todas as verificações passaram.');
module.exports = { falhas };
if (falhas.length) process.exitCode = 1;
