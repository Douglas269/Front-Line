// Conquista: painel "Situação" (território, tendência, força conhecida, riscos e chances). Uso: node tests/situacao.js
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
        novoJogo(1); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; });
        o.botao = !!document.querySelector('#ferramentas button[onclick="abrirSituacao()"]');
        // histórico: cresce a cada ciclo e fica limitado
        for (let i = 0; i < 40; i++) passoMapa(C.CICLO); o.hist = (G.histPlacar || []).length;
        abrirSituacao(); const painel = document.getElementById('painel').textContent.replace(/\s+/g, ' ');
        o.titulo = /Situação/.test(painel) && /Províncias/.test(painel) && /Soldados/.test(painel) && /Poder/.test(painel);
        o.linhas = document.querySelectorAll('#painel .sit-l').length === 1 + G.fase.bots.length;
        o.economia = /Economia por ciclo/.test(painel);
        // não vaza: exército de bot longe da visão aparece como parcial ("+"), nunca o número verdadeiro
        const bot = G.fase.bots[0], cap = Object.values(G.prov).find(q => q.dono === bot && q.capital);
        const antes = forcaConhecida(bot);
        const exB = criarExercito(bot, cap.id, 9); G.espiado[bot] = 0; G.revelado = {};
        const vis = exVisivel(exB), f = forcaConhecida(bot);
        o.semVazar = vis ? true : (f.soldados <= antes.soldados + 0 && !f.completo);
        G.espiado[bot] = G.t + 100; const fe = forcaConhecida(bot); o.espiaoRevela = fe.completo && fe.soldados >= 9;
        G.espiado[bot] = 0;
        // risco: província sua vizinha de inimigo em guerra e sem defesa aparece marcada
        const q = Object.values(G.prov).find(x => x.dono === 'jogador' && !x.capital && x.viz.some(v => G.prov[v].dono !== 'jogador' && G.prov[v].dono !== 'neutro')) || Object.values(G.prov).find(x => x.dono === 'jogador' && !x.capital);
        const viz = G.prov[q.viz.find(v => G.prov[v].dono !== 'jogador')]; if (viz && viz.dono !== 'neutro') { G.rel[viz.dono].estado = 'guerra'; }
        G.ex = G.ex.filter(e => !(e.prov === q.id && e.dono === 'jogador'));
        const rc = riscosEChances(); o.risco = rc.riscos.length > 0 || (viz && viz.dono === 'neutro');
        // projeção: com tendência positiva do jogador, estima mais que o atual
        G.histPlacar = [{ t: 0, pl: { jogador: 3, bravo: 3 } }, { t: C.CICLO * 4, pl: { jogador: 5, bravo: 3 } }]; G.t = 60;
        o.proj = projecaoDe('jogador') > 5 && tendenciaDe('bravo') === 0;
        return o;
    });
    if (!r.botao) falhas.push('falta o botão Situação nas ferramentas');
    if (!r.hist || r.hist > 8) falhas.push('histórico de território deveria ter de 1 a 8 amostras: ' + r.hist);
    if (!r.titulo || !r.linhas || !r.economia) falhas.push('o painel não mostra título, tabela por país e economia: ' + JSON.stringify(r));
    if (!r.semVazar) falhas.push('o painel mostrou a tropa verdadeira de um bot fora da visão');
    if (!r.espiaoRevela) falhas.push('com espião o painel deveria mostrar a tropa inteira');
    if (!r.risco) falhas.push('fronteira sem defesa deveria aparecer como risco');
    if (!r.proj) falhas.push('a projeção/tendência não bateu');
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Situação: histórico, tabela, visão limitada, riscos, chances e projeção funcionam.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
