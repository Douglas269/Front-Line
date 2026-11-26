// Conquista: reforços permanentes entre as fases e sistemas liberados aos poucos. Uso: node tests/campanha.js (PRINTS=pasta)
const path = require('path');
const { chromium } = require('playwright');
const CONQ = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(CONQ); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-conq-guia', 'feito'); }); await p.goto(CONQ); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
        laco = () => {}; const o = {};
        // fase 1 sem diplomacia nem generais; a pesquisa e a situação ficam
        comecarFase(1); atualizarTopo(); const vis = (t) => { const x = [...document.querySelectorAll('#ferramentas button')].find(q => q.title === t); return x.style.display !== 'none'; };
        o.fase1Enxuta = !vis('Diplomacia') && !vis('Generais') && vis('Pesquisa') && vis('Situação');
        const inimiga = Object.values(G.prov).find(q => q.dono !== 'jogador' && q.dono !== 'neutro'); G.sel = { tipo: 'prov', id: inimiga.id }; renderPainel();
        o.semBotaoNoPainel = !/🤝 Diplomacia/.test([...document.querySelectorAll('#painel button.acao')].map(x => x.textContent).join('|'));
        // vencer a fase 1: 3 ofertas, escolher 1, a oferta não muda ao recarregar e não se repete
        G.t = 100; G.fim = 'vitoria'; mostrarFim();
        const botoes = () => [...document.querySelectorAll('#ofertaReforco button.reforco')];
        o.tresOfertas = botoes().length === 3 && botoes().every(x => /▲/.test(x.textContent) && /▼/.test(x.textContent));
        const o1 = ofertaDeReforco(1).join(); mostrarInicio(); o.ofertaGuardada = ofertaDeReforco(1).join() === o1 && botoes().length === 3;
        o.recusaForaDaOferta = escolherReforco(1, Object.keys(REFORCOS_CQ).find(id => !ofertaDeReforco(1).includes(id))) === false;
        const id = ofertaDeReforco(1)[0]; botoes()[0].click(); o.escolheu = (lerMeta().reforcos || []).join() === id && ofertaDeReforco(1).length === 0;
        mostrarInicio(); o.listaOsMeus = /Seus reforços \(1\)/.test(document.getElementById('telaCaixa').textContent) && !document.getElementById('ofertaReforco');
        // com a fase 2 liberada aparece a diplomacia; a 3 libera os generais
        comecarFase(2); atualizarTopo(); o.fase2 = vis('Diplomacia') && !vis('Generais'); comecarFase(3); atualizarTopo(); o.fase3 = vis('Diplomacia') && vis('Generais');
        // cada reforço muda o que promete
        const com = (lista, f) => { const m = lerMeta(); m.reforcos = lista; gravarMeta(m); comecarFase(1); return f(); };
        const base = com([], () => ({ ...G.fac.jogador, tropa: tropaDe('jogador'), prod: producaoDe(G.prov[G.capitalJogador]), vel: velEx(exDe('jogador')[0]), art: custoArtilharia('jogador') }));
        o.calejados = com(['calejados'], () => tropaDe('jogador') === base.tropa - 2 && exDe('jogador').every(e => e.s.every(s => s.lutas === 2)));
        o.artilheiros = com(['artilheiros'], () => custoArtilharia('jogador') === base.art - 10 && G.fac.jogador.mun === base.mun - 40 && custoArtilharia('bravo') === base.art);
        o.engenharia = com(['engenharia'], () => { G.fac.jogador.moedas = 200; G.fac.jogador.aco = 50; construir(G.capitalJogador, 'hospital'); return Math.abs(G.prov[G.capitalJogador].obra.resta - OBRAS.hospital.tempo * 0.65) < 0.01; });
        o.siderurgia = com(['siderurgia'], () => G.fac.jogador.aco === base.aco + 10 && Math.abs(producaoDe(G.prov[G.capitalJogador]).aco - base.prod.aco * 1.3) < 0.01);
        o.intendencia = com(['intendencia'], () => G.fac.jogador.moedas === base.moedas + 40 && G.fac.jogador.comida === base.comida + 25);
        o.motorizada = com(['motorizada'], () => Math.abs(velEx(exDe('jogador')[0]) - base.vel * 1.12) < 0.01);
        o.voluntarios = com(['voluntarios'], () => tropaDe('jogador') === base.tropa + 3);
        o.bastiao = com(['bastiao'], () => G.prov[G.capitalJogador].trinch === 100 && G.prov[G.capitalJogador].obras.forte);
        o.celeiro = com(['celeiro'], () => Math.abs(producaoDe(G.prov[G.capitalJogador]).comida - base.prod.comida * 1.15) < 0.01 && producaoDe(G.prov[G.capitalJogador]).mun < base.prod.mun);
        o.naoValeParaBot = com(['celeiro', 'motorizada'], () => { const q = Object.values(G.prov).find(x => x.dono === 'bravo'); const a = producaoDe(q).comida; G.reforcos = []; return Math.abs(producaoDe(q).comida - a) < 1e-9; });
        // salvamento guarda os reforços; online não usa
        com(['motorizada'], () => { salvarPartida(); }); const m = lerMeta(); m.reforcos = []; gravarMeta(m); carregarPartida(); o.salva = G.reforcos.join() === 'motorizada';
        G.online = { papel: 'host' }; o.online = reforcosAtivos().length === 0; G.online = null; apagarSalvamento();
        // perder não dá reforço
        localStorage.removeItem('frontline-conquista-meta'); comecarFase(1); G.fim = 'derrota'; mostrarFim(); o.derrotaSemOferta = !document.getElementById('ofertaReforco');
        return o;
    });
    Object.entries(r).forEach(([k, v]) => { if (!v) falhas.push('falhou: ' + k); });
    if (process.env.PRINTS) { await p.evaluate(() => { localStorage.removeItem('frontline-conquista-meta'); comecarFase(1); G.t = 200; G.fim = 'vitoria'; mostrarFim(); }); await p.screenshot({ path: path.join(process.env.PRINTS, 'reforco.png') }); }
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Campanha: reforços e liberação gradual funcionam.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
