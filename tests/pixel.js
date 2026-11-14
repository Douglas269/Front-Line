// Visual pixel art (teste): Trincheiras e Conquista abrem com ?pixel=1, rodam sem erro e desenham; o modo clássico segue igual.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const erros = []; const R = {};
  const base = 'file://' + __dirname.replace(/tests$/, '') + 'prototipo/';
  for (const q of ['?pixel=1', '']) {
    const p = await b.newPage({ viewport: { width: 400, height: 900 } }); p.on('pageerror', e => erros.push(e.message));
    const U = base + 'ponto-alpha.html' + q;
    await p.goto(U); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); localStorage.setItem('frontline-tutorial-v1', '1'); });
    await p.goto(U); await p.waitForTimeout(500);
    await p.evaluate(() => { fecharMenuModos(); jogoPausado = false; menuAberto = false; gameState.day = 6; });
    for (let i = 0; i < 25; i++) { await p.evaluate(() => { for (let k = 0; k < 10; k++) if (!gameEnded) updateGameTick(); }); await p.waitForTimeout(40); }
    R['trinch' + q] = await p.evaluate(() => ({ pixel: pixelAtivo(), sprites: pxPronto, posNoLado: gameState.enemies.every(e => { const x = posInimigoCena(e).x; return pixelAtivo() ? x >= 118 && x <= 388 : true; }) }));
    R['trinch' + q].desenhou = (await p.locator('#corteCanvas').screenshot()).length > 20000;
    await p.close();
    const c = await b.newPage({ viewport: { width: 400, height: 800 } }); c.on('pageerror', e => erros.push(e.message));
    const V = base + 'conquista.html' + q;
    await c.goto(V); await c.evaluate(() => localStorage.clear()); await c.goto(V); await c.waitForTimeout(400);
    await c.evaluate(() => comecarFase(1)); await c.waitForTimeout(800);
    await c.evaluate(() => { for (let i = 0; i < 200; i++) passoMapa(0.1); }); await c.waitForTimeout(500);
    R['conquista' + q] = await c.evaluate(() => ({ pixel: pixelNoMapa(), tropas: G.ex.length > 0 }));
    await c.close();
  }
  const ok = R['trinch?pixel=1'].pixel && R['trinch?pixel=1'].sprites && R['trinch?pixel=1'].desenhou && R['trinch?pixel=1'].posNoLado && !R['trinch'].pixel && R['trinch'].desenhou && R['conquista?pixel=1'].pixel && !R['conquista'].pixel && erros.length === 0;
  console.log(JSON.stringify({ R, erros: [...new Set(erros)] }, null, 1));
  console.log(ok ? 'Visual pixel: todas as verificações passaram, sem erros de JavaScript.' : 'FALHOU'); await b.close(); process.exit(ok ? 0 : 1);
})();
