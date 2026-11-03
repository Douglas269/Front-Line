// Testes e simulações do Ponto Alpha.
// Uso: node tests/simulacao.js   (requer o pacote 'playwright' e o Chromium do ambiente)
const path = require('path');
const { chromium } = require('playwright');

const GAME = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'ponto-alpha.html');

const INITIAL_SQUAD = () => [
  { id: 1, rank: 'Sgt.', name: 'Silva', class: 'Fuzileiro Regular', hp: 100, fatigue: 10, hunger: 10, thirst: 10, moral: 85, duty: 'WATCH' },
  { id: 2, rank: 'Cbo.', name: 'Santos', class: 'Metralhador', hp: 100, fatigue: 15, hunger: 15, thirst: 15, moral: 80, duty: 'WATCH' },
  { id: 3, rank: 'Sd.', name: 'Ferreira', class: 'Fuzileiro Regular', hp: 90, fatigue: 20, hunger: 20, thirst: 20, moral: 75, duty: 'REST' },
  { id: 4, rank: 'Sd.', name: 'Costa', class: 'Médico', hp: 100, fatigue: 5, hunger: 10, thirst: 10, moral: 90, duty: 'MAINTENANCE' },
  { id: 5, rank: 'Sd.', name: 'Oliveira', class: 'Engenheiro', hp: 100, fatigue: 10, hunger: 10, thirst: 10, moral: 85, duty: 'RATIONING' },
  { id: 6, rank: 'Sd.', name: 'Mendes', class: 'Atirador de Elite', hp: 95, fatigue: 10, hunger: 15, thirst: 15, moral: 88, duty: 'WATCH' }
];

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(GAME, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Login: abre na primeira vez e pausa o relógio; o teste entra como convidado
  const login = await page.evaluate(() => {
    const abriu = loginAberto && !document.getElementById('tela-login').classList.contains('hidden');
    const t0 = gameState.timeSeconds; updateGameTick(); const pausou = gameState.timeSeconds === t0;
    entrarComoConvidado();
    const fechou = !loginAberto && localStorage.getItem('frontline-modo') === 'convidado';
    return { abriu, pausou, fechou };
  });

  // Tutorial: abre depois do login, na primeira vez, e pausa o relógio; depois é fechado
  const tutorial = await page.evaluate(() => {
    const abriu = tutorialAberto && !document.getElementById('modal-tutorial').classList.contains('hidden');
    const t0 = gameState.timeSeconds; updateGameTick(); const pausou = gameState.timeSeconds === t0;
    passoTutorial(1); const avancou = document.getElementById('tut-step').textContent === `2/${TUTORIAL.length}`;
    fecharTutorial();
    const fechou = !tutorialAberto && localStorage.getItem('frontline-tutorial-v1') === '1';
    return { abriu, pausou, avancou, fechou };
  });

  const results = { checks: {}, sim: {} };

  // Verificações funcionais
  results.checks = await page.evaluate(([init, TUTORIAL_RESULT]) => {
    const c = {};
    Object.assign(c, TUTORIAL_RESULT);
    clearInterval(relogioId); // o teste avança o relógio na mão
    // Fixa o sorteio em tempo bom (Nublado, 90% de eficiência) para o teste ser determinístico
    const sorteioReal = Math.random; Math.random = () => 0.1;
    gameState.day = 1; gameState.timeSeconds = 0; // a página já rodou alguns segundos antes do teste
    for (let i = 0; i < 239; i++) updateGameTick();
    c.diaNaoViraAntesDaHora = gameState.day === 1 && gameState.timeSeconds === 239;
    // Ninguém comendo no último segundo, para medir só a entrega do comboio
    gameState.squad.forEach(s => { if (s.hp > 0) s.duty = 'REST'; });
    const racoesAntesDaEntrega = gameState.resources.rations;
    updateGameTick(); // segundo 240: o dia vira sozinho
    Math.random = sorteioReal;
    c.diaViraSozinho = gameState.day === 2 && gameState.timeSeconds === 0;
    c.racoesEntregues = gameState.resources.rations > racoesAntesDaEntrega;
    // Pausa: nada acontece até continuar
    alternarPausa(true); const tPausa = gameState.timeSeconds; updateGameTick(); updateGameTick();
    c.pausaParaORelogio = gameState.timeSeconds === tPausa && !document.getElementById('map-paused').classList.contains('hidden');
    alternarPausa(false); updateGameTick();
    c.continuarRetomaORelogio = gameState.timeSeconds === tPausa + 1 && document.getElementById('map-paused').classList.contains('hidden');
    gameState.timeSeconds = 0;
    c.cardsRenderizados = modoCorte() ? (document.querySelectorAll('#squad-list > div').length === 1 && document.querySelectorAll('#corte-fichas button').length === 6) : document.querySelectorAll('#squad-list > div').length === 6;

    Object.assign(gameState, { day: 1, timeSeconds: 0, enemies: [], activeCrisis: null, resources: { rations: 36, water: 48, ammoRifle: 550, ammoHeavy: 200, medkits: 3 }, squad: init });
    updateUI();
    setSoldierDuty(2, 'REST');
    c.dutyMuda = gameState.squad.find(s => s.id === 2).duty === 'REST';
    switchTab('logistics'); c.abaLogistica = !document.getElementById('panel-logistics').classList.contains('hidden');
    switchTab('radio');
    gameState.prestige = 1000; // garante prestígio para o pedido em qualquer nível
    const pBefore = gameState.prestige; const rBefore = gameState.resources.rations; requestSupport('SUPPLY', 'rations');
    c.cargaCustaPrestigio = gameState.prestige - pBefore === -custo(45);
    // A carga emergencial demora (150 s reais no nível 1, +10 s por nível) e não chega na hora
    c.cargaNaoChegaNaHora = !!gameState.cargas.rations && gameState.resources.rations === rBefore;
    const espera = gameState.cargas.rations || 0;
    // Itens separados: água e munição podem ir junto; o mesmo item não pode ser pedido duas vezes
    { const p1 = gameState.prestige; requestSupport('SUPPLY', 'rations');
      c.cargaMesmoItemNaoRepete = gameState.prestige === p1;
      requestSupport('SUPPLY', 'water'); requestSupport('SUPPLY', 'ammoHeavy');
      c.cargaItensSeparados = !!gameState.cargas.water && !!gameState.cargas.ammoHeavy && !gameState.cargas.ammoRifle && gameState.prestige === p1 - custo(45) - custo(50); }
    const aguaAntes = gameState.resources.water, pesadaAntes = gameState.resources.ammoHeavy, leveAntes = gameState.resources.ammoRifle;
    c.cargaEsperaValida = espera === esperaCarga() * (gameState.supplyLineEff <= 30 ? 2 : 1);
    { const nv = gameState.level; gameState.level = 1; c.carga150sNivel1 = seg(esperaCarga()) === 150;
      gameState.level = 2; c.carga160sNivel2 = seg(esperaCarga()) === 160;
      gameState.level = 25; c.carga390sNivel25 = seg(esperaCarga()) === 390; gameState.level = nv; }
    for (let i = 0; i < espera; i++) processPendingSupply();
    c.cargaChegaDepois = !gameState.cargas.rations && gameState.resources.rations >= rBefore + 20;
    c.cargaCadaItemChega = gameState.resources.water >= aguaAntes + 30 && gameState.resources.ammoHeavy > pesadaAntes && gameState.resources.ammoRifle === leveAntes;
    // Relatório de patrulha: só um envio por dia
    const pRel = gameState.prestige;
    sendIntelReport(); sendIntelReport();
    c.relatorioUmaVezPorDia = gameState.prestige - pRel === ganho(50);
    gameState.day++; sendIntelReport();
    c.relatorioNovoDia = gameState.prestige - pRel === 2 * ganho(50);
    gameState.day--; gameState.lastIntelDay = 0;
    toggleTacticalOrder('SHELTER'); c.ordemAtiva = gameState.tacticalOrders.SHELTER === true;
    openCrisis('desabamento', {});
    c.modalCrise = !document.getElementById('modal-crisis').classList.contains('hidden');
    document.querySelector('#crisis-options button').click();
    c.modalCriseFecha = document.getElementById('modal-crisis').classList.contains('hidden');
    // Crises: pausam o relógio, entram no salvamento e todas as opções funcionam
    gameState.squad.forEach(s => { s.hp = 100; s.moral = 80; });
    const tAntes = gameState.timeSeconds; openCrisis('franco_atirador', {}); updateGameTick();
    c.crisePausaRelogio = gameState.timeSeconds === tAntes;
    saveGame();
    c.criseEntraNoSalvamento = JSON.parse(localStorage.getItem('frontline-ponto-alpha-v1')).activeCrisis.id === 'franco_atirador';
    resolveCrisis(1); localStorage.removeItem('frontline-ponto-alpha-v1');
    let errosCrise = [];
    Object.keys(CRISES).forEach(id => {
      CRISES[id].opcoes.forEach((op, i) => {
        try {
          Object.assign(gameState, { weather: 'Chuva Forte', prestige: 1000, trench: 80, barrage: null, convoyAmbush: false, enemies: [],
            resources: { rations: 30, water: 40, ammoRifle: 500, ammoHeavy: 100, medkits: 3 } });
          gameState.squad.forEach(s => { s.hp = 100; s.duty = 'WATCH'; s.moral = 80; s.deserted = false; });
          gameState.squad[2].moral = 20;
          const crise = CRISES[id];
          openCrisis(id, crise.preparar ? crise.preparar() : {});
          resolveCrisis(i);
          if (gameState.activeCrisis) errosCrise.push(id + ' opção ' + (i + 1) + ' não fechou');
        } catch (e) { errosCrise.push(id + ' opção ' + (i + 1) + ': ' + e.message); }
      });
    });
    c.todasAsCrisesFuncionam = errosCrise.length === 0;
    if (errosCrise.length) console.error(errosCrise.join(' | '));
    gameState.squad.forEach(s => { s.hp = 100; s.deserted = false; }); gameState.enemies = []; gameState.barrage = null; gameState.convoyAmbush = false; gameState.weakenNextWave = false; gameState.crisisCooldown = 240;

    // Defesas e efeitos dos eventos de combate
    const sorteioOrig = Math.random;
    const prepCombate = () => { gameState.squad.forEach(s => { s.hp = 100; s.moral = 100; s.deserted = false; });
      Object.assign(gameState.tacticalOrders, { SUPPRESSION: false, SHELTER: false, CONSERVE: false, FULL_VIGILANCE: false, SIGNAL_JAM: false });
      gameState.barrage = null; gameState.counterBattery = null; gameState.nextWaveBoost = 0; gameState.resources.ammoRifle = 500; };
    Math.random = () => 0.99; // inimigo não acerta; sem eventos
    // Tiro bala a bala
    prepCombate(); gameState.squad.forEach(s => { s.duty = 'WATCH'; s.cadAcc = 0; s.stats = null; });
    const alvoTeste = { type: 'infantaria', distance: 150 };
    const mendes = gameState.squad.find(s => s.class === 'Atirador de Elite');
    const pComVigia = chanceDeAcerto(mendes, ARMAS[mendes.class], alvoTeste);
    gameState.squad.forEach(s => s.duty = 'REST');
    const pSemVigia = chanceDeAcerto(mendes, ARMAS[mendes.class], alvoTeste);
    c.semVigiaAtiraAsCegas = Math.abs(pSemVigia - pComVigia * 0.5) < 1e-9;
    c.pertoAcertaMais = chanceDeAcerto(mendes, ARMAS[mendes.class], { type: 'infantaria', distance: 20 }) > chanceDeAcerto(mendes, ARMAS[mendes.class], { type: 'infantaria', distance: 280 });
    // 1 segundo real (8 ticks) com todos de vigília: ~16 balas, cada uma descontada do paiol
    const gastoEm1s = (ordens) => { prepCombate(); Object.assign(gameState.tacticalOrders, ordens);
      gameState.squad.forEach(s => { s.duty = 'WATCH'; s.cadAcc = 0; });
      gameState.enemies = [{ type: 'infantaria', distance: 250, hp: 1e9, maxHp: 1e9, offsetX: 0 }];
      for (let k = 0; k < 8; k++) processEnemiesAndCombat(); return 500 - gameState.resources.ammoRifle; };
    const gNormal = gastoEm1s({}), gSup = gastoEm1s({ SUPPRESSION: true }), gEco = gastoEm1s({ CONSERVE: true });
    c.balaABala = gNormal >= 14 && gNormal <= 17 && Number.isInteger(gNormal);
    c.supressaoGastaMais = gSup > gNormal * 2;
    c.economiaGastaMenos = gEco < gNormal / 2;
    c.tirosContados = gameState.combate.tiros > 0;
    // Acerto certo (sorteio 0): a Atiradora derruba e recebe o abate
    prepCombate(); Math.random = () => 0;
    gameState.squad.forEach(s => { s.duty = 'REST'; s.hp = 0; s.cadAcc = 0; s.stats = null; });
    mendes.hp = 100; mendes.duty = 'WATCH'; mendes.cadAcc = 0.99;
    gameState.enemies = [{ type: 'infantaria', distance: 100, hp: 100, maxHp: 100, offsetX: 0 }];
    processEnemiesAndCombat();
    c.abateCreditado = gameState.enemies.length === 0 && mendes.stats.abates === 1 && mendes.stats.acertos === 1;
    // Embaralhar: chance igual para cada soldado ser o primeiro (Fisher-Yates)
    { Math.random = sorteioOrig; const cont = [0, 0, 0, 0, 0, 0]; const base = [0, 1, 2, 3, 4, 5];
      for (let k = 0; k < 60000; k++) cont[embaralhar(base)[0]]++;
      c.embaralharUniforme = cont.every(n => Math.abs(n - 10000) < 500) && base.join() === '0,1,2,3,4,5';
      Math.random = () => 0.99; }
    Math.random = () => 0.99;
    gameState.squad.forEach(s => { s.hp = 100; });
    // Sem munição: pistola, não gasta paiol
    prepCombate(); gameState.resources.ammoRifle = 0; gameState.squad.forEach(s => { s.duty = 'WATCH'; s.cadAcc = 0; });
    gameState.enemies = [{ type: 'infantaria', distance: 250, hp: 1e9, maxHp: 1e9, offsetX: 0 }];
    { const t0 = gameState.combate.tiros; for (let k = 0; k < 8; k++) processEnemiesAndCombat();
      c.semMunicaoUsaPistola = gameState.resources.ammoRifle === 0 && gameState.combate.tiros > t0; }
    gameState.resources.ammoRifle = 500;
    // ===== Defesas: obra, armas pesadas, granadas, arame, blindado e requisições =====
    { const guardado = JSON.stringify({ squad: gameState.squad, timeSeconds: gameState.timeSeconds, trench: gameState.trench, prestige: gameState.prestige, day: gameState.day });
      gameState.arsenal = novoArsenal(); const ars = gameState.arsenal;
      prepCombate(); gameState.enemies = [];
      const eng = gameState.squad.find(s => s.class === 'Engenheiro');
      gameState.squad.forEach(s => { s.duty = 'WATCH'; s.hunger = 0; s.thirst = 0; s.fatigue = 0; });
      eng.duty = 'MAINTENANCE';
      construirPonto(1);
      const trench0 = gameState.trench = 80;
      for (let k = 0; k < 9; k++) { gameState.timeSeconds = (k + 1) * 10 % 240; processSquadNeeds(); }
      c.defObraComEngenheiro = ars.posicoes[1].obra >= 100 && !ars.posicoes[1].construindo;
      c.defObraNaoReparaTrincheira = gameState.trench < 100;
      eng.duty = 'WATCH';
      montarArma(1, 'metralhadora');
      const santos = gameState.squad.find(s => s.class === 'Metralhador');
      c.defMontaMGComMetralhador = ars.posicoes[1].arma === 'metralhadora' && ars.posicoes[1].operador === santos.id && ars.itens.metralhadora === 0;
      // MG atira com munição pesada e o operador larga o fuzil
      Math.random = () => 0.01; santos.cadAcc = 0; santos.stats = null;
      gameState.resources.ammoHeavy = 100;
      gameState.enemies = [{ type: 'infantaria', distance: 200, hp: 1e9, maxHp: 1e9, offsetX: 0 }];
      for (let k = 0; k < 8; k++) processEnemiesAndCombat();
      c.defMGGastaPesada = gameState.resources.ammoHeavy === 96;
      c.defOperadorNaoUsaFuzil = santos.stats.tiros === 4;
      // Operador fora da vigília: arma parada
      santos.duty = 'REST'; const h0 = gameState.resources.ammoHeavy;
      for (let k = 0; k < 8; k++) processEnemiesAndCombat();
      c.defOperadorForaDaVigiliaParaArma = gameState.resources.ammoHeavy === h0;
      santos.duty = 'WATCH';
      // Blindado: fuzil quase não fere; anticarro derruba
      desmontarArma(1); montarArma(1, 'lancaAT'); definirOperador(1, santos.id);
      const blind = { type: 'blindado', distance: 150, hp: 1000, maxHp: 1000, offsetX: 0 };
      c.defBlindagem = blindagem(blind, 'fuzil') === 0.15 && blindagem(blind, 'at') === 1 && blindagem({ type: 'infantaria' }, 'fuzil') === 1;
      gameState.enemies = [blind]; const f0 = ars.itens.foguetesAT;
      processEnemiesAndCombat();
      c.defAnticarroAcertaBlindado = ars.itens.foguetesAT === f0 - 1 && (blind.hp <= 100 || !gameState.enemies.includes(blind));
      gameState.enemies = [{ type: 'infantaria', distance: 150, hp: 1e9, maxHp: 1e9, offsetX: 0 }]; const f1 = ars.itens.foguetesAT;
      ars.posicoes[1].recarga = 0; processEnemiesAndCombat();
      c.defAnticarroIgnoraInfantaria = ars.itens.foguetesAT === f1;
      // Morteiro atinge o grupo inteiro
      desmontarArma(1); montarArma(1, 'morteiro'); definirOperador(1, santos.id);
      gameState.enemies = [0, 1, 2].map(i => ({ type: 'infantaria', distance: 150 + i * 5, hp: 1000, maxHp: 1000, offsetX: i * 10 }));
      const g0 = ars.itens.granadaMorteiro; processEnemiesAndCombat();
      c.defMorteiroAtingeGrupo = ars.itens.granadaMorteiro === g0 - 1 && gameState.enemies.filter(e => e.hp <= 1000 - 100).length === 3;
      // Granadas de mão a menos de 25 m
      gameState.enemies = [{ type: 'infantaria', distance: 20, hp: 1000, maxHp: 1000, offsetX: 0 }]; ars.recargaGranada = 0;
      const gr0 = ars.itens.granadas; processEnemiesAndCombat();
      c.defGranadaAutomatica = ars.itens.granadas === gr0 - 1;
      // Arame farpado segura a infantaria pela metade
      estenderArame();
      const e1 = { type: 'infantaria', distance: 40, hp: 1e9, maxHp: 1e9, offsetX: 0 }; gameState.enemies = [e1];
      gameState.tacticalOrders.SUPPRESSION = false; moverInimigo(gameState, e1);
      c.defArameSegura = Math.abs(e1.distance - (40 - ENEMY_TYPES.infantaria.speed * 0.5)) < 1e-9 && ars.arame < 100;
      // Requisição chega no comboio
      gameState.prestige = 1000; const ped0 = ars.itens.foguetesAT; requisitar('foguetesAT');
      c.defRequisicaoCobra = gameState.prestige === 1000 - custo(80) && ars.pedidos.length === 1;
      Math.random = () => 0.99; entregarArsenal(1);
      c.defRequisicaoChegaNoComboio = ars.itens.foguetesAT === ped0 + 2 && ars.pedidos.length === 0;
      // Salvamento leva o arsenal
      saveGame(); const salvo = JSON.parse(localStorage.getItem(SAVE_KEY));
      c.defEntraNoSalvamento = salvo.arsenal && salvo.arsenal.posicoes[1].arma === 'morteiro';
      // General: blindado só a partir do dia 6
      const d0 = gameState.day; gameState.enemies = []; gameState.barrage = null;
      gameState.day = 7; const antes6 = planoViavel('blindado'); gameState.day = 9; const depois6 = planoViavel('blindado'); gameState.day = d0;
      c.defBlindadoSoDepoisDoDia8 = !antes6 && depois6;
      gameState.enemies = []; Math.random = () => 0.99; gameState.arsenal = novoArsenal();
      const g = JSON.parse(guardado); gameState.squad.forEach((s, i) => Object.assign(s, g.squad[i])); Object.assign(gameState, { timeSeconds: g.timeSeconds, trench: g.trench, prestige: g.prestige, day: g.day }); prepCombate(); }
    // Paiol: munição leve não passa da capacidade
    gameState.resources.ammoRifle = PRESSURE.AMMO_CAP_RIFLE - 10;
    c.paiolLimita = addAmmoRifle(250) === 10 && gameState.resources.ammoRifle === PRESSURE.AMMO_CAP_RIFLE;
    gameState.resources.ammoRifle = 500;
    // Vida do inimigo: (100 + 5·dia) × multiplicadores
    { const d0 = gameState.day; gameState.day = 10; const n = gameState.enemies.length; spawnEnemy('infantaria', 260);
      const e = gameState.enemies[n]; c.vidaInimigoReduzida = Math.abs(e.maxHp - 150 * diff().enemyHpMult) < 0.01;
      gameState.enemies.splice(n, 1); gameState.day = d0; }
    prepCombate(); gameState.squad.forEach(s => s.duty = 'WATCH');
    gameState.tacticalOrders.SIGNAL_JAM = true; Math.random = () => 0.01;
    gameState.enemies = [{ type: 'drone', distance: 250, hp: 1000, offsetX: 0 }]; processEnemiesAndCombat();
    c.bloqueioDerrubaDrone = gameState.enemies.length === 0;
    const pRadio = gameState.prestige; gameState.lastIntelDay = 0; sendIntelReport();
    c.bloqueioOcupaRadio = gameState.prestige === pRadio;
    prepCombate(); gameState.enemies = []; gameState.prestige = 1000; gameState.barrage = { ticks: 20 };
    Math.random = () => 0; requestSupport('COUNTER'); // 2d5 = 2
    for (let k = 0; k < 8; k++) processCounterBattery(); // 2d5 = 2 → 8 ticks (1 s real)
    c.contraBateriaCancela = gameState.barrage === null && gameState.prestige === 1000 - custo(50);
    prepCombate(); Math.random = () => 0.99;
    gameState.enemies = [{ type: 'patrulha', distance: 100, hp: 1e6, offsetX: 0 }];
    for (let k = 0; k < PATROL_MARK_TICKS; k++) processEnemiesAndCombat();
    c.patrulhaMarcaPosicao = gameState.nextWaveBoost === 1 && gameState.enemies.length === 0;
    Math.random = sorteioOrig; prepCombate(); gameState.enemies = [];

    // Ordens contraditórias não ficam ligadas juntas
    Object.assign(gameState.tacticalOrders, { SUPPRESSION: false, SHELTER: false, CONSERVE: false, FULL_VIGILANCE: false, SIGNAL_JAM: false });
    toggleTacticalOrder('SUPPRESSION'); toggleTacticalOrder('CONSERVE');
    toggleTacticalOrder('SHELTER'); toggleTacticalOrder('FULL_VIGILANCE');
    const oo = gameState.tacticalOrders;
    c.ordensContraditoriasExclusivas = oo.CONSERVE && !oo.SUPPRESSION && oo.FULL_VIGILANCE && !oo.SHELTER;
    Object.assign(gameState.tacticalOrders, { SUPPRESSION: false, SHELTER: false, CONSERVE: false, FULL_VIGILANCE: false, SIGNAL_JAM: false }); syncOrderButtons();

    // General inimigo: planeja, executa, aprende e entra no salvamento
    const sorteioG = Math.random; Math.random = () => 0;
    gameState.day = 5; gameState.enemies = []; gameState.barrage = null; gameState.general = newGeneral();
    gameState.general.budget = 12; gameState.general.think = 1;
    randomEventCheck();
    c.generalEscolhePlano = !!gameState.general.plan;
    for (let k = 0; k < 40 && gameState.general.plan; k++) randomEventCheck();
    c.generalExecutaPlano = gameState.enemies.length > 0 || !!gameState.barrage;
    gameState.enemies = []; gameState.barrage = null;
    gameState.general = newGeneral(); gameState.general.budget = 12;
    Object.assign(gameState.general.memoria, { abrigo: 1, contraBateria: 0, bloqueio: 0.3, abatePatrulha: 0.5 });
    generalThink();
    c.generalExploraQuemSeAbriga = gameState.general.plan && gameState.general.plan.id === 'bombAssalto';
    gameState.general.memoria.contraBateria = 1;
    c.generalEncurtaAvisoComContraBateria = barrageWarning() === 32; // 4 s reais
    saveGame();
    c.generalEntraNoSalvamento = JSON.parse(localStorage.getItem('frontline-ponto-alpha-v1')).general.memoria.contraBateria === 1;
    localStorage.removeItem('frontline-ponto-alpha-v1');
    Math.random = sorteioG; gameState.general = newGeneral(); gameState.enemies = []; gameState.barrage = null; gameState.day = 2;

    // Níveis altos: menos comida no comboio, ondas maiores e ataques mais rápidos
    const nivelOrig = gameState.level;
    gameState.level = 1; const comida1 = comidaDoNivel(), onda1 = ondaDoNivel(), ritmo1 = ritmoDoNivel();
    gameState.level = 25; const comida25 = comidaDoNivel(), onda25 = ondaDoNivel(), ritmo25 = ritmoDoNivel();
    gameState.level = nivelOrig;
    c.niveisAltosApertam = comida1 === 1 && Math.abs(comida25 - 0.64) < 0.001 && onda1 === 0 && onda25 === 4 && ritmo1 === 1 && Math.abs(ritmo25 - 1.48) < 0.001;

    // Trincheira rompida: a invasão de infantaria vira massacre
    const sorteioR = Math.random; Math.random = () => 0.99;
    gameState.squad.forEach(s => { s.hp = 100; s.deserted = false; s.duty = 'WATCH'; });
    Object.assign(gameState.tacticalOrders, { SUPPRESSION: false, SHELTER: true, CONSERVE: false, FULL_VIGILANCE: false, SIGNAL_JAM: false });
    gameState.trench = 15; gameState.barrage = null; gameState.counterBattery = null;
    gameState.enemies = [{ type: 'infantaria', distance: 0.5, hp: 1e6, offsetX: 0 }];
    processEnemiesAndCombat();
    c.trincheiraRompidaMassacre = gameState.squad.every(s => s.hp <= 0);
    Math.random = sorteioR; gameState.trench = 100; gameState.enemies = []; gameState.tacticalOrders.SHELTER = false;
    gameState.squad.forEach(s => { s.hp = 100; });

    // Bugs corrigidos na revisão
    gameState.tacticalOrders.SHELTER = true; updateUI();
    c.botaoOrdemReflete = document.getElementById('btn-ord-cover').classList.contains('btn-active-order');
    gameState.tacticalOrders.SHELTER = false; updateUI();
    gameState.barrage = { ticks: 12 }; saveGame();
    c.artilhariaEntraNoSalvamento = JSON.parse(localStorage.getItem('frontline-ponto-alpha-v1')).barrage.ticks === 12;
    gameState.barrage = null; localStorage.removeItem('frontline-ponto-alpha-v1');
    gameState.squad.forEach(s => s.hp = 100); gameState.prestige = 1000; requestSupport('MEDEVAC');
    c.medevacSemFeridoNaoCobra = gameState.prestige === 1000;

    // Trincheira: artilharia estraga, Engenheiro na Manutenção repara
    gameState.squad.forEach(s => { s.hp = 100; s.duty = 'WATCH'; });
    gameState.trench = 100; gameState.barrage = { ticks: 1 }; processBarrage();
    c.artilhariaEstragaTrincheira = gameState.trench === 100 - 3 * TRENCH.DAMAGE_BARRAGE;
    // Visual em corte lateral: cômodos, mover soldados, ninhos e volta ao clássico
    { const sv = gameState.squad, guardaV = CONFIG.visual, guardaS = JSON.stringify(sv.map(m => [m.duty, m.mental, m.hp]));
      sv.forEach(m => { m.hp = 100; m.mental = null; m.deserted = false; });
      CONFIG.visual = 'corte'; aplicarVisual();
      c.corteAtiva = document.body.classList.contains('modo-corte') && !document.getElementById('mapa-corte').classList.contains('hidden');
      sv[0].duty = 'WATCH'; sv[1].duty = 'REST'; sv[2].duty = 'RATIONING'; sv[3].duty = 'MAINTENANCE';
      c.corteComodos = comodoDoSoldado(sv[0]) === 'posto' && comodoDoSoldado(sv[1]) === 'abrigo' && comodoDoSoldado(sv[2]) === 'cozinha' && comodoDoSoldado(sv[3]) === 'oficina';
      moverParaComodo(sv[1].id, 'cozinha'); c.corteMoverTrocaFuncao = sv[1].duty === 'RATIONING';
      c.corteDepositoNaoRecebe = moverParaComodo(sv[1].id, 'deposito') === false && sv[1].duty === 'RATIONING';
      gameState.arsenal = novoArsenal(); c.corteNinhoSemArma = moverParaComodo(sv[0].id, 'ninhos') === false;
      gameState.arsenal.posicoes[1].obra = 100; montarArma(1, 'metralhadora'); definirOperador(1, '');
      moverParaComodo(sv[0].id, 'ninhos'); c.corteNinhoComArma = gameState.arsenal.posicoes[1].operador === sv[0].id && comodoDoSoldado(sv[0]) === 'ninhos';
      moverParaComodo(sv[0].id, 'posto'); c.cortePostoLargaArma = gameState.arsenal.posicoes[1].operador === null;
      renderCorte(); c.corteDesenhaSemErro = true;
      CONFIG.visual = 'classico'; aplicarVisual();
      c.corteVoltaAoClassico = !document.getElementById('mapa-classico').classList.contains('hidden') && document.getElementById('barra-abas').nextElementSibling === document.getElementById('conteudo-abas');
      CONFIG.visual = guardaV; aplicarVisual(); gameState.arsenal = novoArsenal();
      JSON.parse(guardaS).forEach((g, i) => { sv[i].duty = g[0]; sv[i].mental = g[1]; sv[i].hp = g[2]; }); }
    // Configurações: abre, para o relógio, aplica volumes e opções, guarda no aparelho
    { const guardaCfg = JSON.stringify(CONFIG);
      abrirConfig('som'); c.configAbre = configAberto && !document.getElementById('modal-config').classList.contains('hidden');
      const tc = gameState.timeSeconds; updateGameTick(); c.configPausaRelogio = gameState.timeSeconds === tc;
      mudarVolume('volMusica', 30); c.configVolumeMusica = Math.abs(bgmWar.volume - 0.3) < 1e-9;
      mudarVolume('volEfeitos', 40); c.configVolumeEfeitos = Math.abs(volumeEfeitos() - 0.5) < 1e-9;
      CONFIG.tremor = false; const ate0 = tremorAte; tremer(5, 100000); c.configSemTremor = tremorAte === ate0;
      CONFIG.rastros = false; const nr = gameState.effects.length; rastro(gameState.squad[0], { distance: 100, offsetX: 0 }); c.configSemRastros = gameState.effects.length === nr;
      salvarConfig(); c.configSalvaNoAparelho = JSON.parse(localStorage.getItem(CONFIG_KEY)).volMusica === 30;
      ['conta', 'som', 'jogo', 'dados'].forEach(a => abaConfig(a)); c.configAbasRenderizam = document.getElementById('cfg-dados').innerHTML.includes(VERSAO_JOGO);
      fecharConfig(); c.configFecha = !configAberto;
      CONFIG = JSON.parse(guardaCfg); salvarConfig(); }
    // Recursos livres: símbolos OTAN, sons ZzFX, ícones e medalhas
    c.milsymbolCarregou = typeof ms !== 'undefined' && Object.values(SIDC_INIMIGO).concat(Object.values(SIDC_AMIGO), Object.values(SIDC_ARMA), [SIDC_DEPOSITO]).every(x => new ms.Symbol(x, { size: 15 }).isValid());
    c.sonsZzfxGeram = typeof zzfxGerar === 'function' && Object.values(SONS).every(par => { const a = zzfxGerar(...par); let pico = 0; for (const v of a) pico = Math.max(pico, Math.abs(v)); return a.length > 1000 && pico > 0.01; });
    c.iconesCarregaram = typeof icone === 'function' && Object.values(EQUIP).concat(Object.values(MUNICOES), Object.values(CARGAS)).every(e => icone(e.icone).startsWith('<svg')) && [...document.querySelectorAll('[data-icone]')].every(el => el.innerHTML.startsWith('<svg'));
    { const m = gameState.squad[5]; const guardaM = { stats: m.stats, medalhas: m.medalhas, quaseMorreu: m.quaseMorreu, hp: m.hp };
      m.hp = 100; m.medalhas = []; m.stats = { tiros: 50, acertos: 20, abates: 15 }; verificarMedalhas();
      c.medalhaDeCombate = m.medalhas.includes('combate');
      verificarMedalhas(); c.medalhaNaoRepete = m.medalhas.filter(x => x === 'combate').length === 1;
      c.medalhaVitoriaPorNivel = medalhaDaVitoria(1) !== medalhaDaVitoria(25);
      Object.assign(m, guardaM); }
    // Fome, sede e fadiga: ~2 dias de sede, ~3 de fome (nublado), ~2 dias de vigília até a fadiga crítica
    { const w0 = gameState.weather, sorteioX = Math.random; Math.random = () => 0.99; gameState.weather = 'Nublado'; gameState.enemies = [];
      Object.assign(gameState.tacticalOrders, { SUPPRESSION: false, SHELTER: false, CONSERVE: false, FULL_VIGILANCE: false, SIGNAL_JAM: false });
      const s = gameState.squad[0]; const guard = { ...s }; Object.assign(s, { hunger: 0, thirst: 0, fatigue: 0, duty: 'WATCH', hp: 100 });
      const cicloAte = (campo, lim) => { const r = ritmoNecessidades(s)[campo]; return lim / r / 24; };
      c.sedeCriticaEm2Dias = Math.abs(cicloAte('sede', 75) - 2) < 0.1;
      c.fomeCriticaEm3Dias = Math.abs(cicloAte('fome', 75) - 3) < 0.15;
      c.fadigaCriticaEm2DiasDeVigilia = Math.abs(cicloAte('fadiga', 85) - 2) < 0.1;
      gameState.weather = 'Neve'; c.neveDaMaisFome = ritmoNecessidades(s).fome > NECESSIDADES.FOME;
      gameState.weather = 'Chuva Forte'; c.chuvaDaMenosSede = ritmoNecessidades(s).sede < NECESSIDADES.SEDE;
      gameState.weather = 'Nublado'; const base = ritmoNecessidades(s).fadiga;
      gameState.enemies = [{ type: 'infantaria', distance: 200, hp: 100, maxHp: 100, offsetX: 0 }]; gameState.tacticalOrders.SUPPRESSION = true;
      c.supressaoEmCombateCansaMais = ritmoNecessidades(s).fadiga > base + 1;
      gameState.enemies = []; gameState.tacticalOrders.SUPPRESSION = false;
      // Depósito: artilharia e drone destroem parte das rações e da água
      gameState.resources.rations = 40; gameState.resources.water = 40;
      atingirDeposito('Teste', [0.2, 0.2]);
      c.depositoPerdeMantimentos = Math.abs(gameState.resources.rations - 32) < 0.01 && Math.abs(gameState.resources.water - 32) < 0.01;
      Math.random = () => 0; const r0 = gameState.resources.rations; gameState.trench = 100;
      gameState.barrage = { ticks: 1 }; processBarrage();
      c.artilhariaAtingeDeposito = gameState.resources.rations < r0 && gameState.trench === 100 - 3 * TRENCH.DAMAGE_BARRAGE;
      const r1 = gameState.resources.rations; const vivos = gameState.squad.filter(m => m.hp > 0);
      inimigoAtira(gameState, { type: 'drone', distance: 100, hp: 50, maxHp: 50 }, vivos, false);
      c.droneAtingeDeposito = gameState.resources.rations < r1;
      Object.assign(s, guard); gameState.weather = w0; gameState.trench = 100; Math.random = sorteioX; }
    // ===== Artilharia com alvos anunciados, traços e colapso mental =====
    { const sorteioY = Math.random; const guardSquad = JSON.stringify(gameState.squad);
      const sv = gameState.squad; sv.forEach(m => { m.hp = 100; m.moral = 80; m.duty = 'WATCH'; m.mental = null; m.deserted = false; });
      gameState.enemies = []; gameState.barrage = null; gameState.arsenal = novoArsenal();
      Object.assign(gameState.tacticalOrders, { SUPPRESSION: false, SHELTER: false, CONSERVE: false, FULL_VIGILANCE: false, SIGNAL_JAM: false });
      // Alvos escolhidos no aviso e mostrados no card
      Math.random = () => 0.9; gameState.general = gameState.general || newGeneral();
      executarPasso('artilharia');
      c.artilhariaAnunciaAlvos = !!gameState.barrage && gameState.barrage.alvos.length === BARRAGE_SHOTS && gameState.barrage.alvos.every(a => a.tipo === 'soldado');
      const alvoId = gameState.barrage.alvos[0].id; const alvo = sv.find(m => m.id === alvoId);
      c.cardMostraAlvo = soldadoMarcado(alvo);
      // Mesmo alvo nos 3 projéteis: em Descanso leva 30%; de vigília leva 100%
      gameState.barrage.alvos = [0, 1, 2].map(() => ({ tipo: 'soldado', id: alvoId })); gameState.barrage.ticks = 1;
      alvo.duty = 'REST'; processBarrage(); const danoAbrigo = 100 - alvo.hp;
      alvo.hp = 100; alvo.duty = 'WATCH';
      gameState.barrage = { ticks: 1, alvos: [0, 1, 2].map(() => ({ tipo: 'soldado', id: alvoId })) }; processBarrage(); const danoAberto = 100 - alvo.hp;
      c.descansoProtegeDoBombardeio = danoAbrigo > 0 && Math.abs(danoAbrigo - danoAberto * ABRIGO_SUBTERRANEO) < 0.01;
      // Ninho atingido para de funcionar até reparar
      const ars = gameState.arsenal; ars.posicoes[1].obra = 100; montarArma(1, 'metralhadora');
      gameState.barrage = { ticks: 1, alvos: [{ tipo: 'ninho', i: 1 }] }; processBarrage();
      c.ninhoAtingidoParaArma = ars.posicoes[1].obra < 100 && !operadorAtivo(ars.posicoes[1]);
      construirPonto(1); c.ninhoPodeSerReparado = ars.posicoes[1].construindo;
      // Traços
      const silva = sv.find(m => m.name === 'Silva'), ferreira = sv.find(m => m.name === 'Ferreira');
      silva.moral = 50; ferreira.moral = 50; perdaMoral(silva, 2); perdaMoral(ferreira, 2);
      c.tracoVeteranoENovato = silva.moral === 49 && ferreira.moral === 46;
      const oliveira = sv.find(m => m.name === 'Oliveira'); oliveira.duty = 'WATCH';
      c.tracoIncansavel = Math.abs(ritmoNecessidades(oliveira).fadiga - NECESSIDADES.FADIGA.WATCH * 0.8) < 1e-9;
      // Colapso: moral baixa + sorteio baixo = pânico; larga o posto e não obedece
      sv.forEach(m => { m.moral = 80; m.mental = null; });
      ferreira.moral = 10; ferreira.duty = 'WATCH'; Math.random = () => 0.01; processarMental();
      c.panicoLargaPosto = mentalDe(ferreira) === 'panico' && ferreira.duty === 'REST';
      setSoldierDuty(ferreira.id, 'WATCH'); c.panicoNaoObedece = ferreira.duty === 'REST';
      Math.random = () => 0.99; for (let k = 0; k < 6; k++) processarMental();
      c.panicoPassaEVolta = !mentalDe(ferreira) && ferreira.duty === 'WATCH';
      // Apatia reduz o ritmo de tiro; fúria heroica aumenta a pontaria
      const arma = ARMAS[ferreira.class];
      const cad0 = cadenciaDe(ferreira, arma), pre0 = chanceDeAcerto(ferreira, arma, { type: 'infantaria', distance: 150 });
      entrarEmCrise(ferreira, 'apatia'); c.apatiaAtiraMenos = Math.abs(cadenciaDe(ferreira, arma) - cad0 * 0.5) < 1e-9;
      ferreira.mental = null; entrarEmCrise(ferreira, 'heroismo'); c.heroismoAcertaMais = chanceDeAcerto(ferreira, arma, { type: 'infantaria', distance: 150 }) > pre0;
      // Veterano não entra em pânico
      silva.moral = 5; silva.mental = null; Math.random = () => 0.12; processarMental();
      c.veteranoNaoEntraEmPanico = mentalDe(silva) !== 'panico' && mentalDe(silva) !== 'apatia';
      // Entra no salvamento
      ferreira.mental = { tipo: 'apatia', ciclos: 3, dutyAntes: 'WATCH' }; saveGame();
      c.mentalEntraNoSalvamento = JSON.parse(localStorage.getItem(SAVE_KEY)).squad.find(m => m.name === 'Ferreira').mental.tipo === 'apatia';
      const g = JSON.parse(guardSquad); sv.forEach((m, i) => { Object.assign(m, g[i]); m.mental = null; });
      gameState.barrage = null; gameState.arsenal = novoArsenal(); Math.random = sorteioY; }
    gameState.trench = 50; gameState.timeSeconds = 10;
    gameState.squad.find(s => s.class === 'Engenheiro').duty = 'MAINTENANCE';
    processSquadNeeds();
    const desgaste = TRENCH.WEAR + (gameState.weather === 'Chuva Forte' ? TRENCH.WEAR_RAIN : 0);
    c.engenheiroRepara = Math.abs(gameState.trench - (50 - desgaste + TRENCH.REPAIR_ENGINEER)) < 1e-9;

    // Recebimento: todos de vigília -> metade da entrega se perde
    gameState.squad.forEach(s => s.duty = 'WATCH');
    const sorteio2 = Math.random; Math.random = () => 0.1;
    gameState.day = 3; // o próximo dia (4) tem comboio
    const rAntes2 = gameState.resources.rations; endTurn(); const recebidoVigilia = gameState.resources.rations - rAntes2;
    gameState.squad[2].duty = 'REST';
    gameState.day = 5; // o próximo dia (6) tem comboio
    gameState.resources.ammoHeavy = 100; gameState.resources.ammoRifle = 100;
    const rAntes3 = gameState.resources.rations; endTurn(); const recebidoNormal = gameState.resources.rations - rAntes3;
    c.comboioTrazMunicaoPesada = gameState.resources.ammoHeavy > 100;
    c.comboioTrazMaisMunicao = gameState.resources.ammoRifle - 100 >= 250;
    // Comboio a cada 2 dias: num dia ímpar não chega nada
    gameState.day = 6; const rAntes4 = gameState.resources.rations; endTurn();
    c.comboioACada2Dias = gameState.resources.rations === rAntes4 && proximoComboio() === 8;
    Math.random = sorteio2;
    c.comboioPerdeMetadeSemDescarregar = recebidoNormal > 0 && recebidoVigilia === Math.floor(recebidoNormal * 0.5);

    gameState.squad.forEach(s => s.hp = 0); updateGameTick();
    c.fimDeJogo = !document.getElementById('modal-end').classList.contains('hidden') && gameEnded === true;

    // Vencer sobe o nível salvo; perder não muda
    gameEnded = false; localStorage.setItem('frontline-ponto-alpha-nivel', '1'); gameState.level = 1;
    gameState.squad.forEach(s => s.hp = 50); gameState.day = 31; checkWinLoss();
    c.vitoriaSobeNivel = localStorage.getItem('frontline-ponto-alpha-nivel') === '2';
    gameEnded = false; gameState.level = 2; gameState.day = 10; gameState.squad.forEach(s => s.hp = 0); checkWinLoss();
    c.derrotaMantemNivel = localStorage.getItem('frontline-ponto-alpha-nivel') === '2';
    localStorage.setItem('frontline-ponto-alpha-nivel', '1'); gameState.level = 1;
    return c;
  }, [INITIAL_SQUAD(), { loginAbrePrimeiraVez: login.abriu, loginPausaRelogio: login.pausou, convidadoEntra: login.fechou, tutorialAbrePrimeiraVez: tutorial.abriu, tutorialPausaRelogio: tutorial.pausou, tutorialAvanca: tutorial.avancou, tutorialFecha: tutorial.fechou }]);

  // Simulações sem intervenção do jogador (renderização desligada para velocidade; lógica idêntica)
  results.sim = await page.evaluate((init) => {
    const realUI = updateUI; updateUI = () => {};
    const out = { runs: 0, vitorias: 0, extintos: 0, mediaDias: 0, racoesZeraram: 0, aguaZerou: 0, mortesCombate: 0, mortesInvasao: 0, mortesFomeSede: 0, hpNegativo: 0 };
    const N = 60; let soma = 0;
    for (let run = 0; run < N; run++) {
      Object.assign(gameState, { day: 1, timeSeconds: 0, prestige: 150, weather: 'Nublado', supplyLineEff: 85, enemies: [], activeCrisis: null, arsenal: novoArsenal(),
        tacticalOrders: { SUPPRESSION: false, SHELTER: false, CONSERVE: false, FULL_VIGILANCE: false },
        crisisCooldown: 240, convoyAmbush: false, weakenNextWave: false, barrage: null, trench: 100, counterBattery: null, nextWaveBoost: 0, general: newGeneral(),
        resources: { rations: 36, water: 48, ammoRifle: 550, ammoHeavy: 200, medkits: 3 }, squad: init.map(s => ({ ...s })) });
      gameEnded = false; // a verificação de fim de jogo acima pode tê-lo deixado ligado
      let ticks = 0, minR = 1e9, minW = 1e9;
      while (gameState.day <= 30 && gameState.squad.some(s => s.hp > 0) && ticks < 30 * 240 + 10) {
        if (gameState.activeCrisis) { resolveCrisis(CRISES[gameState.activeCrisis.id].opcoes.length - 1); continue; } // parado: ignora
        if (gameState.timeSeconds >= 240) { endTurn(); continue; } // jogador finaliza o turno
        const hpAntes = gameState.squad.map(s => s.hp);
        const invadindo = gameState.enemies.some(e => e.distance <= 0.85);
        updateGameTick(); ticks++;
        minR = Math.min(minR, gameState.resources.rations); minW = Math.min(minW, gameState.resources.water);
        gameState.squad.forEach((s, i) => {
          if (hpAntes[i] > 0 && s.hp <= 0) {
            if (s.hunger >= 75 || s.thirst >= 75) out.mortesFomeSede++;
            else if (invadindo) out.mortesInvasao++;
            else out.mortesCombate++;
          }
          if (s.hp < 0) out.hpNegativo++;
        });
      }
      out.runs++;
      if (gameState.day > 30) out.vitorias++;
      if (gameState.squad.every(s => s.hp <= 0)) out.extintos++;
      soma += gameState.day;
      if (minR === 0) out.racoesZeraram++;
      if (minW === 0) out.aguaZerou++;
    }
    out.mediaDias = +(soma / N).toFixed(1);
    updateUI = realUI;
    return out;
  }, INITIAL_SQUAD());

  await browser.close();
  results.errosJS = errors;
  return results;
}

run().then(r => {
  // Versão: o número no jogo e o versao.json publicado precisam ser iguais (tools/nova-versao.sh)
  { const fs = require('fs'); const html = fs.readFileSync(path.resolve(__dirname, '..', 'prototipo', 'ponto-alpha.html'), 'utf8');
    const m = html.match(/const VERSAO_JOGO = '([^']+)';/); const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'prototipo', 'versao.json'), 'utf8'));
    r.checks.versaoSincronizada = !!m && m[1] === j.versao; }
  console.log(JSON.stringify(r, null, 2));
  const falhas = Object.entries(r.checks).filter(([, v]) => v !== true).map(([k]) => k);
  if (falhas.length || r.errosJS.length) { console.log('\nFALHAS:', falhas, r.errosJS); process.exitCode = 1; }
  else console.log('\nTodas as verificações passaram, sem erros de JavaScript.');
}).catch(e => { console.error(e); process.exit(1); });
