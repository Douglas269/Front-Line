// Combustível e excesso de tropas na Conquista: o blindado gasta só em marcha/ataque; sem combustível anda devagar e atira menos;
// a fábrica e os morros produzem; a penalidade de excesso começa em 15 regimentos; o nome do exército muda pela quantidade.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const erros = [], falhas = [];
  const URL = 'file://' + __dirname.replace(/tests$/, '') + 'prototipo/conquista.html';
  const p = await b.newPage({ viewport: { width: 400, height: 800 } }); p.on('pageerror', e => erros.push(e.message));
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.goto(URL); await p.waitForTimeout(300);
  const R = await p.evaluate(() => {
    const r = {};
    const novo = () => { comecarFase(1); G.pausado = true; Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; }); };
    novo();
    // 1) produção: morro dá combustível; fábrica dá mais
    const morro = Object.values(G.prov).find(q => q.dono === 'jogador' || q.dono === 'neutro');
    const prodCap = producaoDe(G.prov[G.capitalJogador]).comb, morroP = { ...morro, tipo: 'morro', obras: {} };
    r.prodMorro = producaoDe(morroP).comb === C.PROD.morro.comb * fatorMoral(morroP);
    r.prodCapital = prodCap === C.PROD.capital.comb * fatorMoral(G.prov[G.capitalJogador]);
    morroP.obras.fabrica = true; r.fabrica = producaoDe(morroP).comb - producaoDe({ ...morroP, obras: {} }).comb; r.fabricaEsperada = fatorMoral(morroP);
    // 2) consumo: só blindado em marcha/ataque
    novo(); { const f = G.fac.jogador; f.comb = 50; const cap = G.prov[G.capitalJogador];
        const ex = exParadosEm(cap.id, 'jogador')[0]; ex.s.push(soldado('Tanque', 'blind'));
        cicloEconomia(); r.parado = f.combGasto;
        ex.rota = [Object.values(G.prov).find(q => q.id !== cap.id && cap.viz.includes(q.id)).id];
        cicloEconomia(); r.marcha = f.combGasto; ex.rota = []; }
    // 3) sem combustível: blindado anda a 25% e a batalha dá metade da chance
    novo(); { const f = G.fac.jogador, cap = G.prov[G.capitalJogador]; const ex = exParadosEm(cap.id, 'jogador')[0]; ex.s.push(soldado('Tanque', 'blind'));
        ex.rota = [cap.viz[0]]; f.comb = 30; const v1 = velEx(ex); f.comb = 0; const v0 = velEx(ex); r.velRatio = +(v0 / v1).toFixed(3); ex.rota = [];
        r.semCombChance = semComb({ tipo: 'blind' }, 'jogador'); f.comb = 5; r.comChance = semComb({ tipo: 'blind' }, 'jogador'); r.infSemComb = semComb({ tipo: 'inf' }, 'jogador'); f.comb = 0; }
    // 4) excesso de tropas: 14 sem penalidade; 15 com 3%; piso 60%; batalha usa o fator
    r.stack14 = stackEfic(14); r.stack15 = +stackEfic(15).toFixed(2); r.stack100 = stackEfic(100);
    // 5) nome do exército pela quantidade
    r.nomes = [1, 2, 4, 8, 15].map(n => nomeFormacao(n).split(' · ')[0]);
    // 6) save antigo sem combustível é migrado
    novo(); { G.pausado = false; salvarPartida(); const d = JSON.parse(localStorage.getItem(SAVE_CONQ)); Object.values(d.fac).forEach(f => { delete f.comb; }); localStorage.setItem(SAVE_CONQ, JSON.stringify(d)); carregarPartida(); r.saveAntigo = G.fac.jogador.comb === C.COMB_INICIAL; }
    // 7) bots e combustível (issue #10): só recrutam blindado com reserva, fabricam quando falta e deixam blindado sem combustível em casa
    { novo(); G.t = 1000; const bot = G.fase.bots[0], f = G.fac[bot]; // G.t alto: fora da graça da fase 1
      const contaBlind = () => G.ex.filter(e => e.dono === bot).reduce((t, e) => t + e.s.filter(x => x.tipo === 'blind').length, 0);
      const orig = Math.random; Math.random = () => 0.5;
      f.comb = 0; f.moedas = 400; f.aco = 400; const antes = contaBlind();
      for (let i = 0; i < 40; i++) { f.moedas = 400; f.aco = 400; f.comb = 0; pensarBot(bot); }
      r.botSemCombNaoRecrutaBlind = contaBlind() === antes;
      Math.random = orig;
      // ordem(): com lista de aptos, o blindado não vai na divisão
      const casa = provDe(bot).find(q => q.capital) || provDe(bot)[0], viz = G.prov[casa.viz[0]];
      const ex = criarExercito(bot, casa.id, 3); ex.s.push(soldado('Tanque', 'blind'));
      const aptos = ex.s.filter(x => x.tipo !== 'blind'), tanque = ex.s.find(x => x.tipo === 'blind');
      const novoEx = ordem(ex.id, viz.id, 3, 'ataque', aptos);
      r.ordemDeixaBlindado = !!novoEx && !novoEx.s.includes(tanque) && ex.s.includes(tanque);
      // fábrica passa na frente quando o combustível está baixo e há blindado
      novo(); G.t = 1000; const bot2 = G.fase.bots[0], f2 = G.fac[bot2]; f2.comb = 1;
      const capB = provDe(bot2).find(q => q.capital); const ex2 = exParadosEm(capB.id, bot2)[0] || criarExercito(bot2, capB.id, 3); ex2.s.push(soldado('Tanque', 'blind'));
      const o2 = Math.random; Math.random = () => 0.1; f2.moedas = 900; capB.obras = {}; capB.obra = null;
      pensarBot(bot2); Math.random = o2;
      r.botFazFabricaSemCombustivel = !!(capB.obra && capB.obra.tipo === 'fabrica') || !!capB.obras.fabrica || (capB.obra && /fabrica|fábrica/i.test(JSON.stringify(capB.obra)));
    }
    return r;
  });
  const ck = (ok, m) => { if (!ok) falhas.push(m + ' ' + JSON.stringify(R)); };
  ck(R.prodMorro && R.prodCapital, 'morro e capital produzem combustível');
  ck(Math.abs(R.fabrica - 0.5 * R.fabricaEsperada) < 0.01, "fábrica dá +0,5 de combustível (vezes a moral)");
  ck(R.parado === 0, 'blindado parado não gasta combustível');
  ck(R.marcha === 1, 'blindado em marcha gasta 1 por ciclo');
  ck(R.velRatio === 0.25, 'sem combustível o blindado anda a 25%');
  ck(R.semCombChance === 0.5 && R.comChance === 1 && R.infSemComb === 1, 'sem combustível o blindado atira com metade da chance; infantaria não');
  ck(R.stack14 === 1 && R.stack15 === 0.97 && R.stack100 === 0.6, 'penalidade de excesso: 14 sem perda, 15 com 3%, piso 60%');
  ck(R.nomes.join('|') === '🪖 Regimento (III)|🪖 Brigada (X)|🪖 Divisão (XX)|🪖 Corpo de Exército (XXX)|🪖 Exército (XXXX)', 'nomes: ' + R.nomes.join('|'));
  ck(R.botSemCombNaoRecrutaBlind, 'bot sem combustível não recruta blindado');
  ck(R.ordemDeixaBlindado, 'ordem com lista de aptos deixa o blindado em casa');
  ck(R.botFazFabricaSemCombustivel, 'bot com blindado e pouco combustível constrói a fábrica primeiro');
  ck(R.saveAntigo, 'save antigo sem combustível é migrado');
  // terreno: infantaria defendendo em cidade, floresta ou morro; blindado atacando em campo
  const T = await p.evaluate(() => ({ cidade: bonusTerreno('inf', 'cidade', 'def'), capital: bonusTerreno('inf', 'capital', 'def'), floresta: bonusTerreno('inf', 'floresta', 'def'), morro: bonusTerreno('inf', 'morro', 'def'), campo: bonusTerreno('inf', 'campo', 'def'), blindCampo: bonusTerreno('blind', 'campo', 'atq'), blindCidade: bonusTerreno('blind', 'cidade', 'atq'), infAtaca: bonusTerreno('inf', 'campo', 'atq') }));
  ck(T.cidade === 1.3 && T.capital === 1.3 && T.floresta === 1.25 && T.morro === 1.15 && T.campo === 1, 'infantaria defende melhor em cidade/floresta/morro');
  ck(T.blindCampo === 1.25 && T.blindCidade === 1 && T.infAtaca === 1, 'blindado ataca melhor em campo');
  // painel da unidade: cabeçalho, combate, logística, composição; separar e renomear
  await p.evaluate(() => { comecarFase(1); G.pausado = true; G.fac.jogador.comb = 0; G.verDetalhes = true; }); // combate, logística e composição ficam em "Detalhes"
  const UD = await p.evaluate(() => {
    const cap = G.prov[G.capitalJogador], e = exParadosEm(cap.id, 'jogador')[0]; e.s.push(soldado('T', 'blind'), soldado('A', 'art'));
    G.sel = { tipo: 'ex', id: e.id }; renderPainel(); const t = document.getElementById('painel').textContent;
    const antes = e.s.length; const novo = separarRegimentos(e.id, 1);
    renomearFormacao(e.id, 'Primeira de Ferro');
    G.sel = { tipo: 'ex', id: e.id }; renderPainel(); const t2 = document.getElementById('painel').textContent;
    return { cabecalho: /Vida/.test(t) && /Moral/.test(t) && /Combate/.test(t) && /Logística/.test(t) && /Composição/.test(t), semComb: /sem combustível/.test(t), separou: !!novo && e.s.length === antes - 1 && novo.s.length === 1, nome: e.nome === 'Primeira de Ferro' && document.getElementById('painel').innerHTML.includes('value="Primeira de Ferro"') };
  });
  ck(UD.cabecalho && UD.semComb, 'painel da unidade mostra vida, moral, combate, logística e composição (e o aviso sem combustível)');
  ck(UD.separou, 'separar um regimento cria um exército novo');
  ck(UD.nome, 'a formação pode ser renomeada');
  console.log(JSON.stringify({ erros: [...new Set(erros)], falhas }, null, 1));
  console.log(falhas.length || erros.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Combustível e excesso de tropas: todas as verificações passaram, sem erros de JavaScript.');
  await b.close(); process.exit(falhas.length || erros.length ? 1 : 0);
})();
