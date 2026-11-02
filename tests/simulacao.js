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

  const results = { checks: {}, sim: {} };

  // Verificações funcionais
  results.checks = await page.evaluate((init) => {
    const c = {};
    gameState.speed = 0; // sem controle de velocidade na interface; o teste pausa direto
    // Fixa o sorteio em tempo bom (Nublado, 90% de eficiência) para o teste ser determinístico
    const sorteioReal = Math.random; Math.random = () => 0.1;
    for (let i = 0; i < 240; i++) updateGameTick();
    c.tempoNaoMudaODia = gameState.day === 1 && gameState.timeSeconds === 240;
    c.periodoCongela = (updateGameTick(), gameState.timeSeconds === 240);
    const racoesAntesDaEntrega = gameState.resources.rations;
    endTurn();
    Math.random = sorteioReal;
    c.finalizarTurnoAvancaDia = gameState.day === 2 && gameState.timeSeconds === 0;
    c.racoesEntregues = gameState.resources.rations > racoesAntesDaEntrega;
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
    // A carga emergencial demora (2d5 × 15 s) e não chega na hora
    c.cargaNaoChegaNaHora = !!gameState.pendingSupply && gameState.resources.rations === rBefore;
    const espera = gameState.pendingSupply ? gameState.pendingSupply.ticks : 0;
    c.cargaEsperaValida = espera >= 30 && espera <= 300;
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
    triggerCrisisModal(CRISES_POOL[1]);
    c.modalCrise = !document.getElementById('modal-crisis').classList.contains('hidden');
    document.querySelector('#crisis-options button').click();
    c.modalCriseFecha = document.getElementById('modal-crisis').classList.contains('hidden');
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
  }, INITIAL_SQUAD());

  // Simulações sem intervenção do jogador (renderização desligada para velocidade; lógica idêntica)
  results.sim = await page.evaluate((init) => {
    const realUI = updateUI; updateUI = () => {};
    const out = { runs: 0, vitorias: 0, extintos: 0, mediaDias: 0, racoesZeraram: 0, aguaZerou: 0, mortesCombate: 0, mortesInvasao: 0, mortesFomeSede: 0, hpNegativo: 0 };
    const N = 60; let soma = 0;
    for (let run = 0; run < N; run++) {
      Object.assign(gameState, { day: 1, timeSeconds: 0, speed: 0, prestige: 150, weather: 'Nublado', supplyLineEff: 85, enemies: [], activeCrisis: null,
        tacticalOrders: { SUPPRESSION: false, SHELTER: false, CONSERVE: false, FULL_VIGILANCE: false },
        resources: { rations: 36, water: 48, ammoRifle: 550, ammoHeavy: 200, medkits: 3 }, squad: init.map(s => ({ ...s })) });
      gameEnded = false; // a verificação de fim de jogo acima pode tê-lo deixado ligado
      let ticks = 0, minR = 1e9, minW = 1e9;
      while (gameState.day <= 30 && gameState.squad.some(s => s.hp > 0) && ticks < 30 * 240 + 10) {
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
