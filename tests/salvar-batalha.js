// Conquista: recarregar no meio de uma batalha continua a mesma batalha (tempo, distância, artilharia usada,
// posturas, mortos, reforços e quem esperava a vez). Uso: node tests/salvar-batalha.js
const path = require('path');
const { chromium } = require('playwright');
const CONQ = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(() => { window.retrato = () => {
            const bt = G.batalhas[0]; if (!bt) return null;
            const lado = (l) => l.map(a => [a.s.nome, a.s.tipo, Math.round(a.s.vida * 100), Math.round(a.x), a.dist === undefined ? null : Math.round(a.dist * 100), !!a.morto]);
            const ligados = (l, soldados) => l.every(a => a.s.vida <= 0 || soldados.includes(a.s)); // o soldado da batalha é o mesmo do exército
            const espera = G.ex.find(e => e.aguarda);
            return {
                dados: { n: G.batalhas.length, alvo: bt.alvo.id, t: +bt.t.toFixed(3), usouArt: !!bt.usouArt, pa: bt.postAtq, pd: bt.postDef, atq: lado(bt.atq), def: lado(bt.def), fatores: [bt.genAtq, bt.genDef, bt.effAtq, bt.effDef, bt.forte], mun: Math.round(G.fac.jogador.mun), espera: espera ? [espera.id, espera.aguarda, espera.s.length] : null },
                ligado: ligados(bt.atq, bt.ex.s) && ligados(bt.def, bt.defensores.flatMap(d => d.s)),
                emLuta: G.ex.includes(bt.ex) && bt.ex.emBatalha && bt.defensores.every(d => d.emBatalha)
            };
        }; });
    await p.goto(CONQ); await p.evaluate(() => { localStorage.clear(); }); await p.goto(CONQ); await p.waitForTimeout(500);
    await p.evaluate(() => {
        esconderTela(); laco = () => {};
        novoJogo(1); G.semSalvar = false; Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; });
        const cap = G.prov[G.capitalJogador], alvo = cap.viz.map(id => G.prov[id]).find(q => q.dono === 'neutro');
        G.ex = G.ex.filter(e => e.prov !== alvo.id);
        criarExercito('neutro', alvo.id, 12); alvo.trinch = 80;
        const entrar = (e) => { e.de = cap.id; e.prov = alvo.id; e.x = alvo.x; e.y = alvo.y; chegarAqui(e, alvo); };
        entrar(criarExercito('jogador', cap.id, 8));
        const bt = G.batalhas[0];
        bt.postAtq = 'cobertura';
        artilhariaNaBatalha(bt, 'atq');
        for (let i = 0; i < 20; i++) passoBatalha(bt, 0.2);
        entrar(criarExercito('jogador', cap.id, 3));                         // reforço no meio da luta
        entrar(criarExercito(G.fase.bots[0], cap.id, 4));                    // outro país espera a vez
        bt.atq[0].s.vida = 0; passoBatalha(bt, 0.01); limparMortos();        // um morto já retirado do exército (conta nas baixas)
        window.antes = retrato();
        salvarPartida();
    });
    const antes = await p.evaluate(() => window.antes);
    const guardado = await p.evaluate(() => localStorage.getItem('frontline-conquista-partida'));
    await p.goto(CONQ); await p.waitForTimeout(500);
    const r = await p.evaluate((guardado) => {
        localStorage.setItem('frontline-conquista-partida', guardado);
        esconderTela(); laco = () => {};
        const o = {};
        carregarPartida(); o.depois = retrato();
        // a batalha carregada termina normalmente e as baixas contam o morto de antes de recarregar
        const bt = G.batalhas[0];
        if (bt) { Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; }); const mortos = () => bt.atq.filter(a => a.s.vida <= 0).length; for (let i = 0; i < 3000 && G.batalhas.includes(bt); i++) avancarBatalhas(0.1); o.terminou = bt.terminou && !G.batalhas.includes(bt); o.baixas = [G.stats.baixas || 0, mortos()]; }
        // salvamento antigo (sem batalhas): continua abrindo, como antes
        const velho = JSON.parse(guardado); delete velho.batalhas; velho.ex.forEach(e => { delete e.aguarda; });
        localStorage.setItem('frontline-conquista-partida', JSON.stringify(velho));
        o.antigo = carregarPartida() && G.batalhas.length === 1;
        return o;
    }, guardado);
    if (!r.depois) falhas.push('a batalha sumiu depois de recarregar');
    else {
        for (const k of Object.keys(antes.dados)) if (JSON.stringify(antes.dados[k]) !== JSON.stringify(r.depois.dados[k])) falhas.push(`mudou depois de recarregar: ${k}: ${JSON.stringify(antes.dados[k]).slice(0, 160)} → ${JSON.stringify(r.depois.dados[k]).slice(0, 160)}`);
        if (!r.depois.ligado) falhas.push('os soldados da batalha precisam ser os mesmos dos exércitos');
        if (!r.depois.emLuta) falhas.push('os exércitos precisam continuar marcados em batalha');
    }
    if (!r.terminou) falhas.push('a batalha carregada deveria terminar normalmente');
    if (!r.baixas || r.baixas[0] < 1 || r.baixas[0] !== r.baixas[1]) falhas.push('baixas erradas depois de recarregar: ' + JSON.stringify(r.baixas));
    if (!r.antigo) falhas.push('salvamento antigo (sem batalhas) deveria continuar abrindo');
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Salvar no meio da batalha: continua igual depois de recarregar.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
