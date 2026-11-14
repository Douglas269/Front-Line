// Conquista: tutorial jogando (pulável), previsão de ataque, alerta de ataque, reunir tropas e mini mapa (fases altas)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const erros = [], falhas = [];
  const base = 'file://' + __dirname.replace(/tests$/, '') + 'prototipo/conquista.html';
  const novo = async (q) => { const p = await b.newPage({ viewport: { width: 400, height: 800 } }); p.on('pageerror', e => erros.push(e.message)); await p.goto(base + q); await p.evaluate(() => localStorage.clear()); await p.goto(base + q); await p.waitForTimeout(300); return p; };
  const txt = (p) => p.evaluate(() => document.getElementById('guia').textContent);
  let p = await novo('?guia=1');
  await p.evaluate(() => comecarFase(1)); await p.waitForTimeout(300);
  if (!/1\/5/.test(await txt(p))) falhas.push('tutorial abre no passo 1');
  await p.evaluate(() => { const e = G.ex.find(x => x.dono === 'jogador'); G.sel = { tipo: 'ex', id: e.id }; renderPainel(); }); await p.waitForTimeout(250);
  if (!/2\/5/.test(await txt(p))) falhas.push('passo 2 depois de selecionar o exército');
  await p.evaluate(() => { const e = G.ex.find(x => x.dono === 'jogador'); prepararOrdem(e.id, G.prov[e.prov].viz.map(v => G.prov[v]).find(v => v.dono !== 'jogador').id, 'ataque'); }); await p.waitForTimeout(250);
  const prev = await p.evaluate(() => ({ tem: !!document.querySelector('.prev'), t: (document.querySelector('.prev') || {}).textContent || '' }));
  if (!/3\/5/.test(await txt(p)) || !prev.tem || !/Sua força/.test(prev.t)) falhas.push('passo 3 com previsão: ' + JSON.stringify(prev));
  await p.evaluate(() => confirmarOrdem()); await p.waitForTimeout(250);
  if (!/4\/5/.test(await txt(p))) falhas.push('passo 4 depois de confirmar');
  await p.evaluate(() => guiaPular());
  const pulo = await p.evaluate(() => ({ some: document.getElementById('guia').style.display === 'none', salvo: localStorage.getItem('frontline-conq-guia') }));
  if (!pulo.some || pulo.salvo !== 'feito') falhas.push('pular tutorial: ' + JSON.stringify(pulo));
  await p.evaluate(() => comecarFase(1)); await p.waitForTimeout(250);
  if (await p.evaluate(() => document.getElementById('guia').style.display) !== 'none') falhas.push('tutorial não volta depois de pulado');
  await p.close();
  // fase alta: alerta, mini mapa, reunir (e previsão sem visão)
  p = await novo('');
  await p.evaluate(() => comecarFase(4)); await p.waitForTimeout(400);
  const f4 = await p.evaluate(() => {
    const minha = Object.values(G.prov).find(q => q.dono === 'jogador'), ini = Object.values(G.prov).find(q => q.dono !== 'jogador' && q.dono !== 'neutro');
    G.espiado[ini.dono] = G.t + 500;
    const e = criarExercito(ini.dono, ini.id, 6); const c = rotaPara(e, minha.id); e.rota = c.rota; e.missao = 'ataque'; e.alertado = true;
    G.sel = { tipo: 'prov', id: minha.id }; renderPainel(); atualizarTopo();
    const cont = (t) => (document.getElementById('painel').textContent.match(new RegExp(t, 'g')) || []).length;
    const r = { alerta: document.getElementById('alertaAtaque').style.display === 'block' && /em ~\d+s/.test(document.getElementById('alertaAtaque').textContent), mini: document.getElementById('miniMapa').style.display === 'block', reunir: cont('Reunir tropas aqui') };
    G.ex.filter(x => x.dono === 'jogador').forEach(x => { x.rota = []; });
    const outra = Object.values(G.prov).filter(q => q.dono === 'jogador' && q.id !== minha.id)[0];
    if (outra) { const ex2 = G.ex.find(x => x.dono === 'jogador' && x.prov === outra.id); if (ex2) { reunirAqui(minha.id); r.reuniu = ex2.rota.length > 0 || ex2.prov === minha.id; } }
    return r;
  });
  if (!f4.alerta || !f4.mini || f4.reunir !== 1) falhas.push('fase 4: ' + JSON.stringify(f4));
  await p.close();
  p = await novo(''); await p.evaluate(() => comecarFase(2)); await p.waitForTimeout(300);
  const f2 = await p.evaluate(() => ({ a: document.getElementById('alertaAtaque').style.display, m: document.getElementById('miniMapa').style.display }));
  if (f2.a !== 'none' || f2.m !== 'none') falhas.push('fases baixas sem alerta e mini mapa: ' + JSON.stringify(f2));
  console.log(JSON.stringify({ erros: [...new Set(erros)], falhas }, null, 1));
  console.log(falhas.length || erros.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Guia da Conquista: todas as verificações passaram, sem erros de JavaScript.');
  await b.close(); process.exit(falhas.length || erros.length ? 1 : 0);
})();
