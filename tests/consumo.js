// Conquista: consumo por ciclo das tropas pesadas (aço e combustível) e as penalidades de falta e de sublotação.
// Uso: node tests/consumo.js
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
        const novo = () => { novoJogo(1); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; }); const e = exParadosEm(G.capitalJogador, 'jogador')[0]; G.ex = G.ex.filter(x => x.dono !== 'jogador' || x === e); return e; };
        const perto = (a, z) => Math.abs(a - z) < 1e-9;
        // 1) aço: artilharia e blindado gastam todo ciclo, mesmo parados; infantaria, metralhadora e cavalaria não
        let e = novo(); e.s = ['inf', 'metr', 'cav'].map(t => soldado('l', t)); o.acoLeve = manutencaoAcoDe('jogador');
        e.s.push(soldado('a', 'art'), soldado('b', 'blind'), soldado('b2', 'blind')); o.acoPesado = manutencaoAcoDe('jogador');
        let f = G.fac.jogador; f.aco = 20; f.moedas = 500; const renda = rendaDe('jogador', 'aco'); cicloEconomia();
        o.desconto = perto(f.aco, 20 + renda - o.acoPesado); o.semFalta = !f.faltaAco;
        // 2) falta de aço: avisa uma vez, a tropa pesada não se cura e causa menos dano; a leve segue normal
        e = novo(); e.s = [soldado('i', 'inf'), ...Array.from({ length: 12 }, () => soldado('b', 'blind'))]; f = G.fac.jogador; f.aco = 0; f.moedas = 500; f.comida = 500;
        e.s[0].vida = 50; e.s[1].vida = 100; G.noticias = []; cicloEconomia(); cicloEconomia();
        o.falta = !!f.faltaAco && f.aco === 0; o.curaLeve = e.s[0].vida > 50; o.curaPesada = e.s[1].vida;
        o.avisos = G.noticias.filter(n => /Falta de aço/.test(n.txt)).length;
        o.dano = [fatorFaltaAco({ tipo: 'blind' }, 'jogador'), fatorFaltaAco({ tipo: 'art' }, 'jogador'), fatorFaltaAco({ tipo: 'inf' }, 'jogador')];
        f.aco = 100; cicloEconomia(); o.voltou = !f.faltaAco && fatorFaltaAco({ tipo: 'blind' }, 'jogador') === 1;
        // 3) combustível: artilharia em marcha também gasta (bem menos que o blindado); sem ele fica lenta e atira com metade da chance
        e = novo(); e.s = [soldado('a', 'art'), soldado('b', 'blind')]; f = G.fac.jogador; f.comb = 50; f.moedas = 500; f.aco = 100;
        cicloEconomia(); o.parado = f.combGasto; e.rota = [G.prov[e.prov].viz[0]]; cicloEconomia(); o.marcha = f.combGasto;
        e.rota = []; e.s = [soldado('a', 'art')]; const v1 = velEx(e); f.comb = 0; o.velArt = velEx(e) / v1; o.tiroArt = [semComb({ tipo: 'art' }, 'jogador'), semComb({ tipo: 'inf' }, 'jogador')];
        // 4) sublotação: com mais soldados do que as províncias sustentam, o exército rende menos em batalha (a milícia não tem limite)
        e = novo(); const max = maoDeObraMax('jogador'); e.s = Array.from({ length: max }, () => soldado('i')); o.cheio = fatorLotacao('jogador');
        e.s.push(...Array.from({ length: Math.ceil(max / 4) }, () => soldado('i'))); o.sobra = fatorLotacao('jogador');
        e.s.push(...Array.from({ length: max * 3 }, () => soldado('i'))); o.piso = fatorLotacao('jogador'); o.milicia = fatorLotacao('neutro');
        // 5) bots: não criam tropa pesada se o aço que entra não paga o consumo
        novo(); const bot = G.fase.bots[0], fb = G.fac[bot]; G.pesq[bot].feitas = { metr: true, art: true, blind: true, cav: true };
        o.botPode = botSustentaAco(bot, 'inf') && !botSustentaAco(bot, 'blind') === (rendaDe(bot, 'aco') - manutencaoAcoDe(bot) < TROPAS.blind.manutAco);
        criarExercito(bot, Object.values(G.prov).find(q => q.dono === bot).id, 0, Array.from({ length: 20 }, () => soldado('x', 'blind')));
        o.botTrava = !botSustentaAco(bot, 'blind') && !botSustentaAco(bot, 'art') && botSustentaAco(bot, 'cav');
        // 6) telas: economia, ficha e painel da unidade mostram o consumo de aço
        e = novo(); e.s = [soldado('b', 'blind'), soldado('a', 'art')]; o.telaEco = /Aço/.test(painelEconomia()) && /0,3/.test(painelEconomia());
        o.ficha = /0\.2⚙/.test(fichaTropa('blind')) && !/⚙ por ciclo/.test(fichaTropa('inf'));
        o.unidade = /Aço: <b>0\.30<\/b>/.test(painelUnidadeDetalhe(e));
        G.fac.jogador.faltaAco = true; G.sel = { tipo: 'ex', id: e.id }; G.verDetalhes = false; renderPainel(); o.alerta = /Falta de aço/.test(document.getElementById('painel').textContent);
        return o;
    });
    const ck = (c, m) => { if (!c) falhas.push(m); };
    ck(r.acoLeve === 0 && Math.abs(r.acoPesado - 0.5) < 1e-9, 'aço por ciclo: artilharia 0,1 e blindado 0,2; leves não gastam ' + [r.acoLeve, r.acoPesado]);
    ck(r.desconto && r.semFalta, 'o ciclo desconta o aço consumido');
    ck(r.falta && r.curaLeve && r.curaPesada === 100, 'sem aço a tropa pesada não se cura; a leve sim ' + r.curaPesada);
    ck(r.avisos === 1, 'o aviso de falta de aço aparece uma vez, não todo ciclo: ' + r.avisos);
    ck(r.dano[0] < 1 && r.dano[1] < 1 && r.dano[2] === 1 && r.voltou, 'sem aço a tropa pesada causa menos dano, e volta ao normal com aço');
    ck(r.parado === 0 && Math.abs(r.marcha - 1.2) < 1e-9, 'combustível: blindado 1 e artilharia 0,2 só em marcha ou luta ' + [r.parado, r.marcha]);
    ck(Math.abs(r.velArt - 0.25) < 1e-9 && r.tiroArt[0] === 0.5 && r.tiroArt[1] === 1, 'sem combustível a artilharia fica lenta e atira pela metade');
    ck(r.cheio === 1 && r.sobra < 1 && r.sobra > 0.7 && r.piso === 0.7 && r.milicia === 1, 'sublotação reduz a eficácia, com piso de 70% ' + [r.cheio, r.sobra, r.piso, r.milicia]);
    ck(r.botPode && r.botTrava, 'bots respeitam o consumo de aço');
    ck(r.telaEco && r.ficha && r.unidade && r.alerta, 'as telas mostram o consumo e o alerta ' + [r.telaEco, r.ficha, r.unidade, r.alerta]);
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Consumo por ciclo: aço, combustível, sublotação, bots e telas funcionam.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
