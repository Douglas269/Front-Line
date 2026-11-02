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
    gameState.speed = 0; // sem controle de velocidade na interface; o teste pausa direto
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
    c.cardsRenderizados = document.querySelectorAll('#squad-list > div').length === 6;

    Object.assign(gameState, { day: 1, timeSeconds: 0, enemies: [], activeCrisis: null, resources: { rations: 36, water: 48, ammoRifle: 550, ammoHeavy: 200, medkits: 3 }, squad: init });
    updateUI();
    setSoldierDuty(2, 'REST');
    c.dutyMuda = gameState.squad.find(s => s.id === 2).duty === 'REST';
    switchTab('logistics'); c.abaLogistica = !document.getElementById('panel-logistics').classList.contains('hidden');
    switchTab('radio');
    gameState.prestige = 1000; // garante prestígio para o pedido em qualquer nível
    const pBefore = gameState.prestige; const rBefore = gameState.resources.rations; requestSupport('SUPPLY');
    c.cargaCustaPrestigio = gameState.prestige - pBefore === -custo(120);
    // A carga emergencial demora (30 s reais no nível 1, +5 s por nível) e não chega na hora
    c.cargaNaoChegaNaHora = !!gameState.pendingSupply && gameState.resources.rations === rBefore;
    const espera = gameState.pendingSupply ? gameState.pendingSupply.ticks : 0;
    c.cargaEsperaValida = espera === esperaCarga() * (gameState.supplyLineEff <= 30 ? 2 : 1);
    { const nv = gameState.level; gameState.level = 1; c.carga30sNivel1 = seg(esperaCarga()) === 30;
      gameState.level = 2; c.carga35sNivel2 = seg(esperaCarga()) === 35;
      gameState.level = 25; c.carga150sNivel25 = seg(esperaCarga()) === 150; gameState.level = nv; }
    for (let i = 0; i < espera; i++) processPendingSupply();
    c.cargaChegaDepois = !gameState.pendingSupply && gameState.resources.rations >= rBefore + 20;
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
    prepCombate(); gameState.squad.forEach(s => s.duty = 'WATCH');
    gameState.enemies = [{ type: 'infantaria', distance: 250, hp: 1000, offsetX: 0 }]; processEnemiesAndCombat();
    const danoComVigia = 1000 - gameState.enemies[0].hp;
    prepCombate(); gameState.squad.forEach(s => s.duty = 'REST');
    gameState.enemies = [{ type: 'infantaria', distance: 250, hp: 1000, offsetX: 0 }]; processEnemiesAndCombat();
    const danoSemVigia = 1000 - gameState.enemies[0].hp;
    c.semVigiaAtiraAsCegas = Math.abs(danoSemVigia - danoComVigia * 0.5) < 0.01;
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
    const rAntes3 = gameState.resources.rations; endTurn(); const recebidoNormal = gameState.resources.rations - rAntes3;
    // Comboio a cada 2 dias: num dia ímpar não chega nada
    gameState.day = 6; const rAntes4 = gameState.resources.rations; endTurn();
    c.comboioACada2Dias = gameState.resources.rations === rAntes4 && proximoComboio() === 8;
    Math.random = sorteio2;
    c.comboioPerdeMetadeSemDescarregar = recebidoNormal > 0 && recebidoVigilia === Math.floor(recebidoNormal * 0.5);

    gameState.squad.forEach(s => s.hp = 0); updateGameTick();
    c.fimDeJogo = !document.getElementById('modal-end').classList.contains('hidden') && gameState.speed === 0;

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
      Object.assign(gameState, { day: 1, timeSeconds: 0, speed: 0, prestige: 150, weather: 'Nublado', supplyLineEff: 85, enemies: [], activeCrisis: null,
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
  console.log(JSON.stringify(r, null, 2));
  const falhas = Object.entries(r.checks).filter(([, v]) => v !== true).map(([k]) => k);
  if (falhas.length || r.errosJS.length) { console.log('\nFALHAS:', falhas, r.errosJS); process.exitCode = 1; }
  else console.log('\nTodas as verificações passaram, sem erros de JavaScript.');
}).catch(e => { console.error(e); process.exit(1); });
