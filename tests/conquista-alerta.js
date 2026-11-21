// Conquista: bots esperam 60 s na fase 1 (graça) e o aviso de ataque a caminho. Uso: node tests/conquista-alerta.js
const path = require('path');
const { chromium } = require('playwright');
const CONQ = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(CONQ); await p.evaluate(() => localStorage.clear()); await p.goto(CONQ); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
        esconderTela(); laco = () => {}; const o = {};
        // graça da fase 1: nenhuma ordem de bot nos primeiros 60 s
        novoJogo(1); let ordensBot = 0; const ord = ordem; ordem = (...a) => { const e = G.ex.find(x => x.id === a[0]); if (e && e.dono !== 'jogador') ordensBot++; return ord(...a); };
        while (G.t < 59) passoMapa(0.5); o.ordensNaGraca = ordensBot;
        while (G.t < 400 && ordensBot === 0) passoMapa(0.5); o.depoisDaGraca = ordensBot;
        ordem = ord;
        o.fase2MaisLonga = FASES[1].tempo >= 1000;
        // aviso de ataque: exército de bot marchando contra uma província minha, à vista
        novoJogo(1); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; });
        const cap = G.prov[G.capitalJogador], bot = G.fase.bots[0];
        const viz = cap.viz.map(v => G.prov[v]).find(q => q.dono !== 'jogador') || G.prov[cap.viz[0]];
        const e = criarExercito(bot, viz.id, 6); G.rel[bot].estado = 'guerra'; e.rota = [cap.id]; e.missao = 'ataque';
        const lista = ataquesACaminho();
        o.lista = lista.length >= 1 && lista[0].n === 6 && lista[0].alvo.id === cap.id && lista[0].eta >= 1;
        atualizarAlertaAtaque(); const el = document.getElementById('alertaAtq');
        o.faixa = !!el && el.style.display === 'block' && /chega em/.test(el.textContent) && /Bravo|Charlie|Delta|Echo/.test(el.textContent);
        abrirSituacao(); o.painel = /Ataques a caminho/.test(document.getElementById('painel').textContent);
        // fora de visão não aparece (sem vazar): exército longe de tudo que é meu e sem espião
        G.ex = G.ex.filter(x => x !== e); G.revelado = {}; G.espiado = {};
        const longe = Object.values(G.prov).find(q => q.dono !== 'jogador' && q.dono !== 'neutro' && !provVisivel(q.id));
        if (longe) { const e2 = criarExercito(longe.dono, longe.id, 5); G.rel[longe.dono].estado = 'guerra'; const prox = longe.viz.map(v => G.prov[v]).find(q => !provVisivel(q.id)) || longe; e2.rota = [prox.id, cap.id]; o.foraDeVisao = !ataquesACaminho().some(a => a.id === e2.id); }
        else o.foraDeVisao = true;
        // sem ataque: faixa some
        G.ex = G.ex.filter(x => x.dono === 'jogador'); atualizarAlertaAtaque(); o.some = document.getElementById('alertaAtq').style.display === 'none';
        return o;
    });
    if (r.ordensNaGraca !== 0) falhas.push('os bots não deveriam agir nos primeiros 60 s da fase 1: ' + r.ordensNaGraca);
    if (!r.depoisDaGraca) falhas.push('depois da graça os bots deveriam voltar a agir');
    if (!r.fase2MaisLonga) falhas.push('a fase 2 deveria ter mais tempo (o tempo curto era o que travava a vitória)');
    if (!r.lista) falhas.push('ataquesACaminho não listou o exército marchando contra a capital');
    if (!r.faixa) falhas.push('a faixa de aviso não apareceu com quem, quantos e quando');
    if (!r.painel) falhas.push('o painel Situação deveria listar os ataques a caminho');
    if (!r.foraDeVisao) falhas.push('o aviso mostrou um exército fora de visão');
    if (!r.some) falhas.push('a faixa deveria sumir sem ataque');
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Conquista: graça da fase 1 e aviso de ataque funcionam.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
