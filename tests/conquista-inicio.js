// Conquista: a fase 1 começa pausada (o relógio não anda até o jogador tocar em ▶); as outras fases começam rodando.
const path = require('path'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 390, height: 844 } }); let erros = 0;
  pg.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await pg.goto('file://' + path.join(__dirname, '..', 'prototipo', 'conquista.html')); await pg.waitForTimeout(400);
  const f = [];
  const r1 = await pg.evaluate(async () => { comecarFase(1); const t0 = G.t; await new Promise(r => setTimeout(r, 1200)); return { pausada: G.pausado, parado: G.t === t0, faixa: getComputedStyle(document.getElementById('faixaPausa')).display, botao: document.getElementById('bPausa').textContent }; });
  if (!r1.pausada || !r1.parado) f.push('fase 1 deveria começar pausada e com o relógio parado: ' + JSON.stringify(r1));
  if (r1.faixa === 'none' || r1.botao !== '▶') f.push('faixa PAUSADO e botão ▶ deveriam aparecer: ' + JSON.stringify(r1));
  const r2 = await pg.evaluate(() => { pausar(false); return G.pausado; });
  if (r2) f.push('tocar em ▶ não despausou');
  const r3 = await pg.evaluate(() => { try { localStorage.setItem('frontline-conquista-guia', '1'); } catch (e) {} comecarFase(2); return G.pausado; });
  if (r3) f.push('fase 2 não deveria começar pausada');
  console.log(f.length || erros ? 'FALHOU:\n' + f.join('\n') : 'OK: fase 1 começa pausada, ▶ despausa, fase 2 roda direto'); await b.close(); process.exit(f.length || erros ? 1 : 0);
})();
