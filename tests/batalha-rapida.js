// Conquista: "Resolver rápido" e a opção de resolver batalhas sempre rápido. Uso: node tests/batalha-rapida.js
// O resultado rápido precisa ter a mesma chance de vitória da batalha animada (mesmas regras).
const path = require('path');
const { chromium } = require('playwright');
const CONQ = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(CONQ); await p.evaluate(() => { localStorage.clear(); }); await p.goto(CONQ); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
        esconderTela(); laco = () => {};
        const o = {};
        const mk = (atq, def, trinch) => { novoJogo(1); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; });
            const q = Object.values(G.prov).find(x => x.dono === 'neutro' && !x.capital); G.ex = G.ex.filter(e => e.prov !== q.id); q.trinch = trinch; q.obras = {};
            const d = criarExercito('neutro', q.id, 0, def.map(t => soldado('d', t))), a = criarExercito('jogador', q.viz[0], 0, atq.map(t => soldado('a', t)));
            return abrirBatalha(a, q, [d]); };
        const rep = (t, n) => Array(n).fill(t);
        // chance de vitória: animada (passos pequenos, como no jogo) x rápida
        const taxa = (atq, def, trinch, rapido, N = 200) => { let v = 0; for (let k = 0; k < N; k++) { const bt = mk(atq, def, trinch);
            if (rapido) resolverBatalhaAgora(bt); else { let g = 0; while (!bt.terminou && g++ < 5000) bt.passo(0.07); }
            if (bt.vencedor === 'atq') v++; } return 100 * v / N; };
        o.parelho = [taxa(rep('inf', 8), rep('inf', 6), 30, false), taxa(rep('inf', 8), rep('inf', 6), 30, true)];
        o.dificil = [taxa(rep('inf', 10), rep('inf', 6), 30, false), taxa(rep('inf', 10), rep('inf', 6), 30, true)];
        // botão: termina a batalha, conclui (conquista a província) e some do painel
        const bt = mk(rep('inf', 12), rep('inf', 2), 0); G.sel = null;
        const prov = bt.alvo.id; o.temBotao = /Resolver rápido/.test(painelBatalha(bt));
        resolverRapido(prov);
        o.terminou = bt.terminou && !(G.batalhas || []).some(x => x === bt);
        o.conquistou = G.prov[prov].dono === 'jogador';
        // preferência "sempre rápido": a batalha já nasce resolvida
        CONFIG_CONQ.batalhaRapida = true;
        const bt2 = mk(rep('inf', 12), rep('inf', 2), 0); o.sempre = bt2.terminou === true;
        CONFIG_CONQ.batalhaRapida = false;
        // online: não resolve rápido (a batalha é de todos)
        const bt3 = mk(rep('inf', 12), rep('inf', 2), 0); G.online = true; o.online = podeResolverRapido(bt3) === false && !/Resolver rápido/.test(painelBatalha(bt3)); G.online = false;
        return o;
    });
    const dif = (a) => Math.abs(a[0] - a[1]);
    if (dif(r.parelho) > 10) falhas.push('chance de vitória diferente (parelho): animada ' + r.parelho[0] + '% x rápida ' + r.parelho[1] + '%');
    if (dif(r.dificil) > 10) falhas.push('chance de vitória diferente (difícil): animada ' + r.dificil[0] + '% x rápida ' + r.dificil[1] + '%');
    if (!r.temBotao) falhas.push('o painel da batalha deveria ter o botão Resolver rápido');
    if (!r.terminou || !r.conquistou) falhas.push('Resolver rápido deveria terminar e concluir a batalha (conquistar a província): ' + JSON.stringify(r));
    if (!r.sempre) falhas.push('com a preferência ligada a batalha deveria nascer resolvida');
    if (!r.online) falhas.push('no online não pode haver resolução rápida');
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Batalha rápida: mesmas chances da animada, botão, preferência e bloqueio no online funcionam. ' + JSON.stringify(r.parelho) + JSON.stringify(r.dificil));
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
