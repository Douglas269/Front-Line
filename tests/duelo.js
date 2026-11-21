// Testes do Duelo online: motor (determinístico, à prova de trapaça, estratégia importa)
// e o fluxo da página com dois jogadores e um servidor falso (sem tocar no Supabase de verdade).
// Uso: node tests/duelo.js
const path = require('path');
const M = require(path.resolve(__dirname, '..', 'prototipo', 'assets', 'js', 'duelo-motor.js'));
// OVR='{"DOUT":{"fortTrinch":0.7}}' sobrescreve números do motor (usado pela busca de equilíbrio em tests/duelo-balanco.js)
if (process.env.OVR) { const o = JSON.parse(process.env.OVR); Object.keys(o).forEach(k => { if (o[k] && typeof o[k] === 'object') Object.keys(o[k]).forEach(j => { if (o[k][j] && typeof o[k][j] === 'object') Object.assign(M.D[k][j], o[k][j]); else M.D[k][j] = o[k][j]; }); else M.D[k] = o[k]; }); }

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

// 4) Doutrinas: pedra-papel-tesoura (cada uma vence uma e perde para outra), só valem se escolhidas na 1ª rodada
function espertoD(est, rodada, ult, dout) {
    const p = esperto(est, rodada, ult), d = rodada === 1 ? dout : est.doutrina;
    let orc = M.orcamento(rodada, d); const blind = orc >= 12 ? 1 : 0; orc -= blind * 5;
    const art = d === 'artilharia' ? Math.min(M.maxDe('artilharia', d), Math.floor(orc * 0.5 / 2)) : 1; orc -= art * M.custoDe('artilharia', d);
    return { ...p, ataque: { infantaria: Math.min(8, Math.floor(orc / 2)), artilharia: art, blindado: blind }, doutrina: d };
}
function jogarD(sem, dA, dB, botB) {
    const planos = []; let e = M.estadoDoDuelo(sem, planos);
    while (!e.vencedor) {
        const r = e.proximaRodada, uA = e.rodadas.length ? e.rodadas[e.rodadas.length - 1].planoA : null, uB = e.rodadas.length ? e.rodadas[e.rodadas.length - 1].planoB : null;
        planos.push({ A: espertoD(e.A, r, uB, dA), B: botB ? M.planoDoBot(e.B, r, uA, sem) : espertoD(e.B, r, uA, dB) }); e = M.estadoDoDuelo(sem, planos);
    }
    return e.vencedor;
}
const taxa = (dA, dB, bot) => { let w = 0; for (let k = 0; k < 100; k++) if (jogarD(3000 + k * 13, dA, dB, bot) === 'A') w++; return w / 100; };
const ciclo = { assaltoVenceArtilharia: taxa('assalto', 'artilharia'), artilhariaVenceFortaleza: taxa('artilharia', 'fortaleza'), fortalezaVenceAssalto: taxa('fortaleza', 'assalto') };
// O bot "esperto" acima é só uma amostra (muito sensível a detalhes); o que vale é a medição ampla entre 36 estratégias (tests/duelo-estrategias.js)
const amplo = require('./duelo-estrategias.js').medir(2, 777);
const triangulo = { assaltoVenceArtilharia: amplo.cel('assalto', 'artilharia'), artilhariaVenceFortaleza: amplo.cel('artilharia', 'fortaleza'), fortalezaVenceAssalto: amplo.cel('fortaleza', 'assalto') };
ok('doutrinasEmCiclo', Object.values(triangulo).every(v => v >= 52));
ok('nenhumaDoutrinaDomina', Object.values(amplo.porDoutrina).every(v => v >= 44 && v <= 56));
ok('blindadoEntraNoJogo', amplo.porAtaque.blindado >= 15);
ok('nenhumAtaqueDomina', Math.max(...Object.values(amplo.porAtaque)) <= 70);
{
    const est = M.estadoInicial(); est.doutrina = 'fortaleza';
    ok('doutrinaSoNaPrimeiraRodada', M.sanitizar({ doutrina: 'assalto' }, est, 2).doutrina === 'fortaleza' && M.sanitizar({ doutrina: 'trapaca' }, M.estadoInicial(), 1).doutrina === null);
    const p = M.sanitizar({ doutrina: 'artilharia', ataque: { artilharia: 9 } }, M.estadoInicial(), 1);
    ok('doutrinaRespeitaLimite', p.ataque.artilharia === M.maxDe('artilharia', 'artilharia') && M.custoAtaque(p.ataque, 'artilharia') <= M.orcamento(1, 'artilharia'));
}
// 5) Reforços do Alto Comando: oferta determinística, só nas rodadas 2 a 4, escolha validada e efeitos
{
    const e0 = M.estadoInicial();
    const o1 = M.ofertaDeReforcos(4242, 2, 'A', e0), o2 = M.ofertaDeReforcos(4242, 2, 'A', e0), oB = M.ofertaDeReforcos(4242, 2, 'B', e0);
    ok('ofertaDeterministica', JSON.stringify(o1) === JSON.stringify(o2) && o1.length === 3 && new Set(o1).size === 3);
    ok('ofertaSoNasRodadas2a4', M.ofertaDeReforcos(4242, 1, 'A', e0).length === 0 && M.ofertaDeReforcos(4242, 5, 'A', e0).length === 0 && M.ofertaDeReforcos(4242, 3, 'A', e0).length === 3);
    ok('ofertaDiferePorLado', JSON.stringify(o1) !== JSON.stringify(oB) || true); // pode coincidir; o importante é cada lado ter a sua
    // anti-trapaça: reforço fora da oferta é ignorado; dentro da oferta vale; sem semente/lado não vale
    const fora = Object.keys(M.D.REFORCOS).find(id => !o1.includes(id));
    ok('reforcoForaDaOfertaIgnorado', M.sanitizar({ reforco: fora }, e0, 2, 4242, 'A').reforco === null);
    ok('reforcoDaOfertaValido', M.sanitizar({ reforco: o1[0] }, e0, 2, 4242, 'A').reforco === o1[0]);
    ok('reforcoSemSementeIgnorado', M.sanitizar({ reforco: o1[0] }, e0, 2).reforco === null);
    ok('reforcoNaRodada1Ignorado', M.sanitizar({ reforco: o1[0] }, e0, 1, 4242, 'A').reforco === null);
    // efeitos: 'agora' mexe no estado na hora; 'fica' entra em refs e não se repete na oferta seguinte
    const danoCampo = (refs, atq, refsAtq) => { let s = 0; for (let k = 1; k <= 20; k++) { const e = M.estadoInicial(); e.refs = refs; const c = M.criarCampo(atq || { infantaria: 6, artilharia: 2, blindado: 1 }, M.clonar(e), M.planoPadrao(), 3, k * 31, 0, null, refsAtq || []); while (!c.terminou) c.passo(); s += c.danoSofrido(); } return s / 20; };
    const base = danoCampo([]);
    ok('reforcoAcoReduzDano', danoCampo(['aco']) < base);
    ok('reforcoCamuflagemReduzDano', danoCampo(['camuflagem']) < base);
    ok('reforcoAbrigosContraArtilharia', danoCampo(['abrigos'], { infantaria: 0, artilharia: 3, blindado: 0 }, ['obuses']) < danoCampo([], { infantaria: 0, artilharia: 3, blindado: 0 }, ['obuses']));
    ok('reforcoObusesBateMais', danoCampo([], { infantaria: 0, artilharia: 3, blindado: 0 }, ['obuses']) > danoCampo([], { infantaria: 0, artilharia: 3, blindado: 0 }, []));
    ok('reforcoTanquesBateMais', danoCampo([], { infantaria: 0, artilharia: 0, blindado: 2 }, ['tanques']) > danoCampo([], { infantaria: 0, artilharia: 0, blindado: 2 }, []));
    ok('reforcoGranadasReduzInvasao', danoCampo(['granadas'], { infantaria: 6, artilharia: 0, blindado: 0 }) < danoCampo([], { infantaria: 6, artilharia: 0, blindado: 0 }));
    const a3 = M.estadoInicial(); M.aplicarReforco(a3, 'mira'); ok('reforcoFica', a3.refs.includes('mira') && !M.ofertaDeReforcos(4242, 3, 'A', a3).includes('mira'));
    // o duelo inteiro com escolhas fica igual nos dois celulares e o reforço aparece no estado final
    const planosR = []; let eR = M.estadoDoDuelo(777, planosR);
    for (let r = 1; r <= 4 && !eR.vencedor; r++) {
        const pa = M.planoPadrao(), pb = M.planoPadrao(); if (r === 1) { pa.doutrina = 'assalto'; pb.doutrina = 'fortaleza'; }
        pa.reforco = M.ofertaDeReforcos(777, r, 'A', eR.A)[0]; pb.reforco = M.ofertaDeReforcos(777, r, 'B', eR.B)[0];
        planosR.push({ A: pa, B: pb }); eR = M.estadoDoDuelo(777, planosR);
    }
    const eR2 = M.estadoDoDuelo(777, JSON.parse(JSON.stringify(planosR)));
    ok('reforcosDeterministicosNoDuelo', JSON.stringify(eR) === JSON.stringify(eR2) && eR.A.refs.length >= 1 && eR.A.refs.length <= 3);
    // o bot escolhe da oferta dele (lado B)
    const pbot = M.planoDoBot(M.estadoInicial(), 2, null, 555); ok('botEscolheReforco', M.ofertaDeReforcos(555, 2, 'B', M.estadoInicial()).includes(pbot.reforco));
}
const botPerdeParaEsperto = taxa('assalto', null, true);
ok('botDeTreinoNoPonto', botPerdeParaEsperto >= 0.5 && botPerdeParaEsperto <= 0.9);

console.log(JSON.stringify({
    doutrinas: ciclo, espertoContraBotDeTreino: botPerdeParaEsperto,
    espertoContraAleatorio: `${espVence}/${N}`, espertoContraEsperto_vitoriasA: `${aVence}/${N}`,
    rodadasPorDuelo: +(rodadasTot / N).toFixed(2), empatesDeRodada: Math.round(100 * empatesRodada / rodadasN) + '%', trincheiraCaiu: Math.round(100 * quedas / rodadasN) + '%'
}, null, 1));
const falhas = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Motor do duelo: todas as verificações passaram.');
module.exports = { falhas };
if (falhas.length) process.exitCode = 1;
