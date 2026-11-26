// Conquista: barra da luta, resumo da batalha, conquista animada e veteranos. Uso: node tests/emocao.js
const path = require('path');
const { chromium } = require('playwright');
const CONQ = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(CONQ); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-conq-guia', 'feito'); }); await p.goto(CONQ); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
        esconderTela(); laco = () => {};
        const o = {};
        novoJogo(1); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; });
        const cap = G.prov[G.capitalJogador], alvo = cap.viz.map(id => G.prov[id]).find(q => q.dono === 'neutro');
        G.ex = G.ex.filter(e => e.prov !== alvo.id); criarExercito('neutro', alvo.id, 2); alvo.trinch = 0;
        const e = criarExercito('jogador', cap.id, 14); const vet = e.s[0]; vet.lutas = 1; vet.nome = 'Silva';
        o.semBonus = patenteDe({ lutas: 1 }) === null && patenteDe({ lutas: 2 }).nome === 'Veterano' && patenteDe({ lutas: 5 }).nome === 'Elite';
        o.bonus = [eficacia({ vida: 100, fome: 0, cansaco: 0, lutas: 2 }), eficacia({ vida: 100, fome: 0, cansaco: 0, lutas: 5 }), eficacia({ vida: 100, fome: 0, cansaco: 0 })];
        e.prov = alvo.id; e.de = cap.id; e.x = alvo.x; e.y = alvo.y; chegarAqui(e, alvo);
        const bt = G.batalhas[0]; o.barra = /você está/.test(painelBatalha(bt)) || /luta parelha/.test(painelBatalha(bt));
        G.sel = { tipo: 'ex', id: e.id }; renderPainel(); o.barraNaTela = !!document.querySelector('#painel .luta');
        for (let i = 0; i < 3000 && G.batalhas.length; i++) { vet.vida = 100; avancarBatalhas(0.1); }
        o.venceu = alvo.dono === 'jogador';
        o.promovido = vet.lutas === 2 && patenteDe(vet).nome === 'Veterano';
        o.abates = e.s.concat(G.ex.flatMap(x => x.s)).some(s => (s.abates || 0) > 0);
        const card = document.getElementById('resumoBatalha');
        o.cartao = !!card && card.style.display === 'block' && /é sua/.test(card.textContent) && /Perdas/.test(card.textContent) && /Promovido/.test(card.textContent);
        o.festa = (G.festas || []).some(f => f.prov === alvo.id && f.minha);
        desenharMapa(); o.desenhou = true;
        card.querySelector('.fechar').click(); o.fecha = card.style.display === 'none';
        const meu = exParadosEm(alvo.id, 'jogador')[0] || e; G.sel = { tipo: 'ex', id: meu.id }; G.verDetalhes = false; renderPainel(); o.resumoVet = /★ \d+ veterano/.test(document.getElementById('painel').textContent);
        G.verDetalhes = true; renderPainel(); o.listaVet = /Veteranos/.test(document.getElementById('painel').textContent) && /Silva/.test(document.getElementById('painel').textContent);
        // veteranos e abates continuam depois de salvar e carregar
        G.semSalvar = false; salvarPartida(); carregarPartida(); o.salva = G.ex.some(x => x.s.some(s => s.nome === 'Silva' && s.lutas === 2)); apagarSalvamento();
        // batalha entre outros países não abre cartão
        novoJogo(1); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; }); esconderResumo();
        const q = Object.values(G.prov).find(x => x.dono === 'neutro' && !x.capital); const bx = criarExercito('bravo', q.viz[0], 12); chegarAqui(Object.assign(bx, { prov: q.id }), q);
        for (let i = 0; i < 3000 && G.batalhas.length; i++) avancarBatalhas(0.1);
        o.alheia = document.getElementById('resumoBatalha').style.display === 'none';
        return o;
    });
    const ck = (c, m) => { if (!c) falhas.push(m); };
    ck(r.semBonus && Math.abs(r.bonus[0] - 1.1) < 1e-9 && Math.abs(r.bonus[1] - 1.2) < 1e-9 && r.bonus[2] === 1, 'patentes e bônus: ' + r.bonus);
    ['barra', 'barraNaTela', 'venceu', 'promovido', 'abates', 'cartao', 'festa', 'desenhou', 'fecha', 'resumoVet', 'listaVet', 'salva', 'alheia'].forEach(k => ck(r[k], 'falhou: ' + k));
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Emoção no resultado: barra, cartão, animação e veteranos funcionam.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
