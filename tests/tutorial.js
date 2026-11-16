// Tutorial guiado (Trincheiras e campanha da Conquista): obriga a tocar no que pisca, bloqueia o resto, avança quando a pessoa faz e dá para pular.
// Os modos online não têm tutorial. Usa cliques reais (o bloqueio só aparece com eventos reais).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const erros = [], falhas = [];
  process.on('unhandledRejection', e => { console.log('EXCEÇÃO:', String(e.message).split('\n')[0], '| falhas até aqui:', JSON.stringify(falhas)); process.exit(1); });
  const base = 'file://' + __dirname.replace(/tests$/, '') + 'prototipo/';
  const passo = (p) => p.evaluate(() => GuiaT.passoAtual());
  const aguardaPasso = async (p, n, rotulo) => { try { await p.waitForFunction((x) => GuiaT.passoAtual() === x, n, { timeout: 4000 }); } catch (e) { falhas.push(`${rotulo}: não foi para o passo ${n} (está em ${await passo(p)})`); } };

  // ---------- Trincheiras ----------
  let p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
  await p.goto(base + 'ponto-alpha.html?guia=1'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); });
  await p.goto(base + 'ponto-alpha.html?guia=1'); await p.waitForTimeout(500);
  if (await p.evaluate(() => GuiaT.ativo())) falhas.push('Trincheiras: o tutorial abriu por cima do menu principal (só deve abrir ao entrar no jogo)');
  await p.evaluate(() => escolherModo('trincheiras')); await p.waitForTimeout(500);
  if (!(await p.evaluate(() => GuiaT.ativo()))) falhas.push('Trincheiras: o tutorial não abriu na primeira vez');
  else {
    // passo 0 (leitura): tocar fora do cartão não faz nada
    await p.evaluate(() => document.querySelector('#btn-pause').click());
    if (!(await p.evaluate(() => jogoPausado)) || (await passo(p)) !== 0) falhas.push('passo 0: o toque fora do cartão deveria ser bloqueado');
    await p.click('#guiaT [data-g="ok"]'); await aguardaPasso(p, 1, 'T0');
    // passo 1: só o botão Continuar responde; a aba Logística é bloqueada
    await p.evaluate(() => document.querySelector('#tab-logistics').click());
    if (await p.evaluate(() => !document.getElementById('panel-logistics').classList.contains('hidden'))) falhas.push('passo 1: aba Logística respondeu durante o tutorial');
    await p.click('#btn-pause'); await aguardaPasso(p, 2, 'T1');
    await p.click('#btn-rapido'); await aguardaPasso(p, 3, 'T2');
    await p.click('#btn-rapido'); await aguardaPasso(p, 4, 'T3');
    await p.click('#btn-pause'); await aguardaPasso(p, 5, 'T4');
    // passo 5: tocar no soldado (clique real na cena, no ponto piscando)
    const pt = await p.evaluate(() => { const s = gameState.squad.find(x => x.hp > 0 && x.duty === 'REST') || gameState.squad[0]; const q = posicoesCena[s.id], r = corteCanvas.getBoundingClientRect(); return { x: r.left + q.x * CORTE.escCss, y: r.top + (q.y - 22) * CORTE.escCss, id: s.id }; });
    await p.evaluate(() => corteCanvas.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
    const pt2 = await p.evaluate((id) => { const q = posicoesCena[id], r = corteCanvas.getBoundingClientRect(); return { x: r.left + q.x * CORTE.escCss, y: r.top + (q.y - 22) * CORTE.escCss }; }, pt.id);
    await p.mouse.click(pt2.x + 150, pt2.y - 40); // longe do alvo: bloqueado
    if (await p.evaluate(() => cartaoAberto)) falhas.push('passo 5: toque fora do soldado abriu o cartão');
    await p.mouse.click(pt2.x, pt2.y); await aguardaPasso(p, 6, 'T5');
    // passo 6: trocar a função (programático, o arrastar é testado em outro teste)
    await p.evaluate((id) => moverParaComodo(id, 'cozinha'), pt.id); await aguardaPasso(p, 7, 'T6');
    await p.click('#tab-logistics'); await aguardaPasso(p, 8, 'T7');
    await p.evaluate(() => document.querySelector('#tab-radio').click());
    if (await p.evaluate(() => !document.getElementById('panel-radio').classList.contains('hidden'))) falhas.push('passo 8: aba Rádio respondeu num passo de leitura');
    await p.click('#guiaT [data-g="ok"]'); await aguardaPasso(p, 9, 'T8');
    await p.click('#tab-defense'); await aguardaPasso(p, 10, 'T9');
    await p.click('#guiaT [data-g="ok"]'); await aguardaPasso(p, 11, 'T10');
    await p.click('#btn-ord-cover'); await aguardaPasso(p, 12, 'T11');
    await p.click('#btn-ord-cover'); await aguardaPasso(p, 13, 'T12');
    await p.click('#tab-radio'); await aguardaPasso(p, 14, 'T13');
    await p.click('#btn-intel'); await aguardaPasso(p, 15, 'T14');
    await p.click('#guiaT [data-g="ok"]'); await aguardaPasso(p, 16, 'T15');
    await p.click('#tab-squad'); await aguardaPasso(p, 17, 'T16');
    await p.click('#guiaT [data-g="ok"]'); await p.waitForTimeout(400);
    const fim = await p.evaluate(() => ({ ativo: GuiaT.ativo(), visto: localStorage.getItem('frontline-tutorial-v1'), pausado: jogoPausado, congelado: tutorialAberto }));
    if (fim.ativo || fim.visto !== '1' || fim.pausado || fim.congelado) falhas.push('Trincheiras: fim do tutorial: ' + JSON.stringify(fim));
    // depois do tutorial tudo responde normalmente
    await p.click('#tab-logistics'); if (await p.evaluate(() => document.getElementById('panel-logistics').classList.contains('hidden'))) falhas.push('depois do tutorial, a aba não responde');
  }
  await p.close();

  // pular o tutorial a qualquer momento
  p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
  await p.goto(base + 'ponto-alpha.html?guia=1'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); });
  await p.goto(base + 'ponto-alpha.html?guia=1'); await p.waitForTimeout(500); await p.evaluate(() => escolherModo('trincheiras')); await p.waitForTimeout(400);
  await p.click('#guiaT [data-g="pular"]'); await p.waitForTimeout(300);
  const pulo = await p.evaluate(() => ({ ativo: GuiaT.ativo(), visto: localStorage.getItem('frontline-tutorial-v1') }));
  if (pulo.ativo || pulo.visto !== '1') falhas.push('Trincheiras: pular tutorial: ' + JSON.stringify(pulo));
  await p.close();

  // ---------- Conquista (campanha, fase 1) ----------
  p = await b.newPage({ viewport: { width: 400, height: 800 } }); p.on('pageerror', e => erros.push(e.message));
  const CQ = base + 'conquista.html?guia=1';
  await p.goto(CQ); await p.evaluate(() => localStorage.clear()); await p.goto(CQ); await p.waitForTimeout(400);
  await p.evaluate(() => comecarFase(1)); await p.waitForTimeout(500);
  if (!(await p.evaluate(() => GuiaT.ativo() && G.pausado))) falhas.push('Conquista: tutorial não abriu / não pausou');
  else {
    await p.evaluate(() => document.querySelector('#bConfig').click());
    if (await p.evaluate(() => configConqAberta)) falhas.push('Conquista passo 0: a engrenagem respondeu durante o tutorial');
    await p.click('#guiaT [data-g="ok"]'); await aguardaPasso(p, 1, 'C0');
    const exPt = () => p.evaluate(() => { const e = G.ex.filter(x => x.dono === 'jogador' && !x.rota.length).sort((a, c) => c.s.length - a.s.length)[0], s = paraTela(e.x, e.y + 4), r = cvM.getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; });
    const longe = await p.evaluate(() => { const r = cvM.getBoundingClientRect(); return { x: r.left + 12, y: r.bottom - 12 }; });
    await p.mouse.click(longe.x, longe.y);                         // toque no mapa longe do exército: bloqueado
    if (await p.evaluate(() => G.sel && G.sel.tipo === 'ex')) falhas.push('Conquista passo 1: toque fora do exército selecionou algo');
    const a = await exPt(); await p.mouse.click(a.x, a.y); await aguardaPasso(p, 2, 'C1');
    await p.click('#painel button:has-text("Mover")'); await aguardaPasso(p, 3, 'C2');
    await p.evaluate(() => { const e = G.ex.filter(x => x.dono === 'jogador' && !x.rota.length).sort((a, c) => c.s.length - a.s.length)[0]; const v = G.prov[e.prov].viz.map(i => G.prov[i]); prepararOrdem(e.id, (v.find(q => q.dono === 'neutro') || v.find(q => q.dono !== 'jogador')).id, 'ataque'); });
    await aguardaPasso(p, 4, 'C3');
    if (!(await p.evaluate(() => !!document.querySelector('#painel .prev')))) falhas.push('Conquista passo 4: sem previsão de ataque no painel');
    await p.click('#guiaT [data-g="ok"]'); await aguardaPasso(p, 5, 'C4');
    await p.click('#painel button:has-text("Confirmar")'); await aguardaPasso(p, 6, 'C5');
    const cp = await p.evaluate(() => { const c = G.prov[G.capitalJogador], s = paraTela(c.x, c.y), r = cvM.getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y - 34 }; });
    await p.mouse.click(cp.x, cp.y); await aguardaPasso(p, 7, 'C6');
    await p.click('#painel button:has-text("Recrutar…")'); await aguardaPasso(p, 8, 'C7');
    await p.click('#painel .info-i >> nth=0'); await aguardaPasso(p, 9, 'C8');
    await p.click('#painel button:has-text("Voltar")'); await aguardaPasso(p, 10, 'C9');
    await p.click('#guiaT [data-g="ok"]'); await p.waitForTimeout(400);
    const fim = await p.evaluate(() => ({ ativo: GuiaT.ativo(), visto: localStorage.getItem('frontline-conq-guia'), pausado: G.pausado }));
    if (fim.ativo || fim.visto !== 'feito' || fim.pausado) falhas.push('Conquista: fim do tutorial: ' + JSON.stringify(fim));
  }
  await p.close();
  // não volta depois de visto; pular funciona; online não tem tutorial
  p = await b.newPage({ viewport: { width: 400, height: 800 } }); p.on('pageerror', e => erros.push(e.message));
  await p.goto(CQ); await p.evaluate(() => { localStorage.clear(); }); await p.goto(CQ); await p.waitForTimeout(300);
  await p.evaluate(() => comecarFase(1)); await p.waitForTimeout(300); await p.click('#guiaT [data-g="pular"]'); await p.waitForTimeout(200);
  await p.evaluate(() => comecarFase(1)); await p.waitForTimeout(300);
  if (await p.evaluate(() => GuiaT.ativo() || localStorage.getItem('frontline-conq-guia') !== 'feito')) falhas.push('Conquista: pular tutorial / não voltar');
  const online = await p.evaluate(() => { localStorage.removeItem('frontline-conq-guia'); G.online = true; guiaSeVale(); const r = GuiaT.ativo(); G.online = false; return r; });
  if (online) falhas.push('o modo online não deveria ter tutorial');
  await p.close();

  console.log(JSON.stringify({ erros: [...new Set(erros)], falhas }, null, 1));
  console.log(falhas.length || erros.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Tutorial guiado: todas as verificações passaram, sem erros de JavaScript.');
  await b.close(); process.exit(falhas.length || erros.length ? 1 : 0);
})();
