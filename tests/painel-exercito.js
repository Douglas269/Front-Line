// Conquista no celular: ao tocar no exército, as ordens aparecem sem rolar o painel e os detalhes abrem num botão.
// Uso: node tests/painel-exercito.js   (PRINTS=pasta salva capturas)
const path = require('path');
const { chromium } = require('playwright');
const CONQ = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');
const PRINTS = process.env.PRINTS;
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    for (const tela of [{ width: 390, height: 844 }, { width: 375, height: 740 }]) {
        const p = await b.newPage({ viewport: tela }); p.on('pageerror', e => erros.push(e.message));
        await p.goto(CONQ); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-conq-guia', 'feito'); }); await p.goto(CONQ); await p.waitForTimeout(600);
        await p.evaluate(() => {
            esconderTela(); novoJogo(3); G.semSalvar = true; // na fase 3 todos os sistemas já estão liberados pausar(true); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; });
            G.sel = { tipo: 'ex', id: G.ex.find(e => e.dono === 'jogador' && e.prov === G.capitalJogador).id }; renderPainel();
            // quais destes botões aparecem inteiros na parte visível do painel, sem rolar
            window.visiveis = (textos) => { const pn = document.getElementById('painel'), r = pn.getBoundingClientRect(); return textos.filter(t => { const bt = [...pn.querySelectorAll('button')].find(x => x.textContent.includes(t)); if (!bt) return true; const q = bt.getBoundingClientRect(); return !(q.height > 0 && q.top >= r.top && q.bottom <= Math.min(r.bottom, innerHeight) + 0.5); }); };
        });
        await p.waitForTimeout(700);
        const nome = `${tela.width}x${tela.height}`;
        const foto = async (n) => { if (PRINTS) await p.screenshot({ path: path.join(PRINTS, `${n}-${nome}.png`) }); };
        await foto('exercito');
        const parado = await p.evaluate(() => visiveis(['Mover', 'Saquear', 'General', 'Dispensar', 'Detalhes']));
        if (parado.length) falhas.push(`${nome}: exército parado, botões fora da área visível: ${parado}`);
        // detalhes: fechados no começo, abrem no botão e continuam abertos quando o painel se redesenha
        const antes = await p.evaluate(() => !!document.querySelector('#painel .ud'));
        if (antes) falhas.push(`${nome}: os detalhes deveriam começar fechados`);
        const abriu = await p.evaluate(() => { const bt = [...document.querySelectorAll('#painel button')].find(x => x.textContent.includes('Detalhes')); if (!bt) return false; bt.click(); G.fac.jogador.comb += 1; renderPainel(); return !!document.querySelector('#painel .ud') && !!document.querySelector('#painel .pv'); });
        if (!abriu) falhas.push(`${nome}: o botão Detalhes deveria mostrar vida, combate, logística e composição`);
        await p.evaluate(() => { document.getElementById('painel').scrollTop = 0; }); await foto('detalhes');
        // trocar de seleção volta o painel para o topo
        const topo = await p.evaluate(() => { const pn = document.getElementById('painel'); pn.scrollTop = 300; G.sel = { tipo: 'prov', id: G.capitalJogador }; renderPainel(); return pn.scrollTop; });
        if (topo !== 0) falhas.push(`${nome}: ao trocar de seleção o painel deveria voltar ao topo (ficou em ${topo})`);
        // em batalha: posturas, resolver rápido e artilharia à vista
        await p.evaluate(() => {
            G.verDetalhes = false;
            const cap = G.prov[G.capitalJogador], alvo = cap.viz.map(id => G.prov[id]).find(q => q.dono === 'neutro');
            const e = G.ex.find(x => x.dono === 'jogador' && x.prov === cap.id); e.de = cap.id; e.prov = alvo.id; e.x = alvo.x; e.y = alvo.y; chegarAqui(e, alvo);
            G.sel = { tipo: 'ex', id: e.id }; renderPainel();
        });
        await p.waitForTimeout(700); await foto('batalha');
        const luta = await p.evaluate(() => visiveis(['Avançar', 'Cobertura', 'Recuar', 'Resolver rápido', 'Artilharia']));
        if (luta.length) falhas.push(`${nome}: em batalha, botões fora da área visível: ${luta}`);
        // com a artilharia inimiga no ar, o aviso e o botão de abrigo continuam à vista
        await p.evaluate(() => { const bt = G.batalhas[0]; G.fac.neutro.mun = 500; artilhariaNaBatalha(bt, 'def'); renderPainel(); });
        await p.waitForTimeout(300); await foto('artilharia');
        const art = await p.evaluate(() => { const a = document.querySelector('#painel .perigo-art'), pn = document.getElementById('painel').getBoundingClientRect(); const q = a && a.getBoundingClientRect(); return !!q && q.top >= pn.top && q.bottom <= Math.min(pn.bottom, innerHeight) && visiveis(['Cobertura']).length === 0; });
        if (!art) falhas.push(`${nome}: aviso de artilharia ou botão de cobertura fora da área visível`);
        await p.close();
    }
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Painel do exército: ordens à vista no celular, detalhes num botão.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
