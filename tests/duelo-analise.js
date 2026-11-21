// Duelo: leitura do adversário e "por que perdi/ganhei" (duelo-analise.js). Uso: node tests/duelo-analise.js
const M = require('../prototipo/assets/js/duelo-motor.js');
const A = require('../prototipo/assets/js/duelo-analise.js');
const checks = {}; const ok = (n, v) => { checks[n] = !!v; };
function jogar(sem, estiloB) {
    const planos = []; let e = M.estadoDoDuelo(sem, planos);
    while (!e.vencedor && planos.length < 5) {
        const r = e.proximaRodada, pa = M.planoPadrao(), pb = M.planoPadrao();
        if (r === 1) { pa.doutrina = 'fortaleza'; pb.doutrina = estiloB === 'art' ? 'artilharia' : 'assalto'; }
        pa.escala = ['vigia', 'vigia', 'descanso', 'descanso', 'obras', 'vigia'];
        pb.ataque = estiloB === 'art' ? { infantaria: 1, artilharia: 3, blindado: 0 } : { infantaria: 6, artilharia: 0, blindado: 1 };
        pb.postura = 'atacar';
        planos.push({ A: pa, B: pb }); e = M.estadoDoDuelo(sem, planos);
    }
    return e;
}
const e1 = jogar(31, 'art'), e2 = jogar(77, 'inf');
// leitura antes da 2ª rodada
{
    const so1 = M.estadoDoDuelo(31, [{ A: Object.assign(M.planoPadrao(), { doutrina: 'fortaleza' }), B: Object.assign(M.planoPadrao(), { doutrina: 'artilharia', ataque: { infantaria: 1, artilharia: 3, blindado: 0 }, postura: 'atacar' }) }]);
    const L = A.leituraDoAdversario(so1, 'A');
    ok('leituraTemEstado', L.estado && typeof L.estado.trinch === 'number' && L.estado.soldados <= 6 && typeof L.estado.mun === 'number' && typeof L.estado.cmd === 'number');
    ok('leituraVeEstiloArtilheiro', L.estilo.includes('artilheiro') && L.estilo.includes('agressivo'));
    ok('leituraSugereBunkerContraArtilharia', L.sugestoes.some(s => /Bunker/.test(s)) && L.sugestoes.length <= 3);
    // fortaleza (A) contra artilharia (B): a artilharia vence a fortaleza, então A está em desvantagem
    ok('leituraDoutrinas', L.doutrinas === 'desvantagem');
    ok('leituraPlacar', typeof L.placar === 'number' && typeof L.placarDele === 'number');
    // vista do outro lado também funciona
    const LB = A.leituraDoAdversario(so1, 'B'); ok('leituraDoLadoB', LB.estado && LB.planoDele && LB.planoDele.postura === 'equilibrado');
    // sem rodada anterior (antes da 1ª): não quebra
    const L0 = A.leituraDoAdversario(M.estadoDoDuelo(1, []), 'A'); ok('leituraSemHistorico', L0.estado && L0.sugestoes.length === 0 && L0.estilo.length === 0);
}
// análise do fim
{
    const R = A.analiseDoDuelo(e1, e1.vencedor === 'A' ? 'B' : 'A'), V = A.analiseDoDuelo(e1, e1.vencedor);
    ok('analiseDerrotaTemCausaEDicas', !R.venceu && R.rodadas.length === e1.rodadas.length && R.dicas.length >= 1 && R.dicas.length <= 3 && (R.principal ? R.principal.parte > 0 && R.principal.parte <= 100 : true));
    ok('analiseVitoriaTemDica', V.venceu && V.dicas.length >= 1);
    ok('analisePlacar', /^\d × \d$/.test(R.placar));
    ok('analiseRodadasCompletas', R.rodadas.every(r => typeof r.meuDano === 'number' && typeof r.delDano === 'number' && (r.venci || r.empate || true)));
    const R2 = A.analiseDoDuelo(e2, e2.vencedor === 'A' ? 'B' : 'A'); ok('analiseOutraEstrategia', R2.rodadas.length >= 1 && R2.meu.art + R2.meu.invInf + R2.meu.invBli >= 0);
}
const falhas = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Análise do duelo: leitura do adversário e por que perdi/ganhei funcionam.');
if (falhas.length) process.exitCode = 1;
