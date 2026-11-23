// Conquista: com o jogo pausado aparece um botão grande ▶ no meio do mapa; tocar nele continua o jogo.
// Não aparece rodando, com a partida terminada nem durante o tutorial.
const path = require('path'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 390, height: 844 } }); let erros = 0;
  pg.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await pg.goto('file://' + path.join(__dirname, '..', 'prototipo', 'conquista.html')); await pg.waitForTimeout(400);
  const f = [], vis = () => pg.evaluate(() => { const e = document.getElementById('pausaGrande'), r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width >= 80 && r.height >= 80; });
  await pg.evaluate(() => comecarFase(1)); await pg.waitForTimeout(300);
  if (!await vis()) f.push('pausado: o botão grande deveria aparecer (fase 1 começa pausada)');
  await pg.click('#pausaGrande'); await pg.waitForTimeout(300);
  const roda = await pg.evaluate(() => !G.pausado);
  if (!roda) f.push('tocar no botão grande não continuou o jogo');
  if (await vis()) f.push('rodando: o botão grande não deveria aparecer');
  await pg.evaluate(() => pausar(true)); await pg.waitForTimeout(300);
  if (!await vis()) f.push('pausar pelo ⏸ também deveria mostrar o botão grande');
  await pg.evaluate(() => { G.fim = 'derrota'; }); await pg.waitForTimeout(300);
  if (await vis()) f.push('partida terminada: o botão não deveria aparecer');
  await pg.evaluate(() => { G.fim = null; GuiaT.iniciar([{ txt: 'teste', botao: 'ok' }], { aoFim: () => {} }); }); await pg.waitForTimeout(300);
  if (await vis()) f.push('durante o tutorial o botão não deveria aparecer');
  await pg.screenshot({ path: process.env.CAP || '/dev/null' }).catch(() => {});
  console.log(f.length || erros ? 'FALHOU:\n' + f.join('\n') : 'OK: botão grande de continuar aparece pausado, continua ao tocar e some no tutorial/fim'); await b.close(); process.exit(f.length || erros ? 1 : 0);
})();
