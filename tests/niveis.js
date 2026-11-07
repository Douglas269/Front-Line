// Calibração dos níveis de dificuldade do Ponto Alpha.
// Mede a taxa de vitória em cada nível com dois perfis de jogador:
//   parado: nenhuma ação
//   atento: jogador automático com decisões razoáveis (cozinha, descanso, reparo, abrigo, bloqueio, contra-bateria, apoios)
// Uso: node tests/niveis.js [níveis separados por vírgula] [partidas por perfil]
//   ex.: node tests/niveis.js 1,4,7,10 30
const path = require('path');
const { chromium } = require('playwright');

const GAME = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'ponto-alpha.html');
const LEVELS = (process.argv[2] || '1,4,7,10').split(',').map(Number);
const N = Number(process.argv[3] || 30);

const INITIAL_SQUAD = [
  { id: 1, rank: 'Sgt.', name: 'Silva', class: 'Fuzileiro Regular', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 85, duty: 'WATCH' },
  { id: 2, rank: 'Cbo.', name: 'Santos', class: 'Metralhador', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 80, duty: 'WATCH' },
  { id: 3, rank: 'Sd.', name: 'Ferreira', class: 'Fuzileiro Regular', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 75, duty: 'REST' },
  { id: 4, rank: 'Sd.', name: 'Costa', class: 'Médico', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 90, duty: 'MAINTENANCE' },
  { id: 5, rank: 'Sd.', name: 'Oliveira', class: 'Engenheiro', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 85, duty: 'RATIONING' },
  { id: 6, rank: 'Sd.', name: 'Mendes', class: 'Atirador de Elite', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 88, duty: 'WATCH' }
];

async function measure(page, level, policy) {
  return page.evaluate(({ init, level, policy, N }) => {
    updateUI = () => {}; logFeed = () => {}; addDiaryEntry = () => {};
    if (typeof entrarComoConvidado === 'function') entrarComoConvidado();
    if (typeof fecharTutorial === 'function') fecharTutorial();
    if (typeof relogioId !== 'undefined') clearInterval(relogioId);
    playTacticalBeep = () => {}; playGunshotSound = () => {}; saveGame = () => {}; saveLevel = () => {};

    // Jogador atento: decide antes de cada segundo de jogo
    function atento() {
      const vivos = gameState.squad.filter(s => s.hp > 0);
      const est = gameState.resources;
      const temComida = est.rations > 0 || est.water > 0;
      vivos.forEach(s => {
        // Cozinha: vai comer com fome ou sede >= 40; volta saciado ou sem estoque
        if (s.duty === 'RATIONING') {
          if ((s.hunger < 5 && s.thirst < 5) || !temComida) s.duty = 'WATCH';
        } else if ((s.hunger >= 40 || s.thirst >= 40) && temComida) {
          s.duty = 'RATIONING';
        } else if (s.fatigue > 75) {
          s.duty = 'REST';
        } else if (s.duty === 'REST' && s.fatigue < 15) {
          s.duty = 'WATCH';
        }
      });
      // Engenheiro repara a trincheira abaixo de 70% (até 95%), se não estiver comendo ou descansando
      const eng = vivos.find(s => s.class === 'Engenheiro');
      if (eng && eng.duty !== 'RATIONING' && eng.duty !== 'REST') {
        if (gameState.trench < 70) eng.duty = 'MAINTENANCE';
        else if (eng.duty === 'MAINTENANCE' && gameState.trench >= 95) eng.duty = 'WATCH';
      }
      // Sempre alguém fora da vigília para descarregar o comboio
      if (vivos.length > 1 && vivos.every(s => s.duty === 'WATCH')) {
        vivos.slice().sort((a, b) => b.fatigue - a.fatigue)[0].duty = 'REST';
      }
      if (!vivos.some(s => s.duty === 'WATCH')) {
        const menosCansado = vivos.slice().sort((a, b) => a.fatigue - b.fatigue)[0];
        if (menosCansado) menosCansado.duty = 'WATCH';
      }
      const o = gameState.tacticalOrders;
      o.SHELTER = !!gameState.barrage && gameState.barrage.ticks <= 2;
      // Pares exclusivos: com pouca munição leve economiza; senão, supressão com inimigos à vista
      o.CONSERVE = gameState.resources.ammoRifle < 100;
      o.SUPPRESSION = gameState.enemies.length > 0 && gameState.resources.ammoHeavy > 10 && !o.SHELTER && !o.CONSERVE;
      o.FULL_VIGILANCE = false;
      // Rádio livre para os apoios; contra-bateria se ainda dá tempo antes do impacto
      o.SIGNAL_JAM = false;
      if (gameState.barrage && !gameState.counterBattery && gameState.barrage.ticks >= 8 && gameState.prestige >= custo(50)) requestSupport('COUNTER');
      if (gameState.lastIntelDay !== gameState.day) sendIntelReport();
      const r = gameState.resources;
      if (gameState.enemies.some(e => e.type === 'infantaria' && e.distance < 150) && gameState.prestige >= 100) requestSupport('ARTILLERY');
      const cg = gameState.cargas || {};
      if (!cg.rations && r.rations < 12 && gameState.prestige >= custo(45) + 60) requestSupport('SUPPLY', 'rations');
      if (!cg.water && r.water < 15 && gameState.prestige >= custo(45) + 60) requestSupport('SUPPLY', 'water');
      if (!cg.ammoRifle && r.ammoRifle < 150 && gameState.prestige >= custo(50) + 60) requestSupport('SUPPLY', 'ammoRifle');
      if (vivos.some(s => s.hp < 30) && gameState.prestige >= 150 && gameState.supplyLineEff >= 30) requestSupport('MEDEVAC');
      // Bloqueio de sinal enquanto houver drone observando
      o.SIGNAL_JAM = droneObservando();
    }

    let vitorias = 0, somaDias = 0;
    for (let run = 0; run < N; run++) {
      gameEnded = false;
      Object.assign(gameState, {
        level, day: 1, timeSeconds: 0, prestige: 150, arsenal: novoArsenal(), weather: 'Nublado', supplyLineEff: 85,
        enemies: [], activeCrisis: null, barrage: null, cargas: {}, lastIntelDay: 0, effects: [], trench: 100, crisisCooldown: 240, convoyAmbush: false, weakenNextWave: false, counterBattery: null, nextWaveBoost: 0, general: newGeneral(),
        tacticalOrders: { SUPPRESSION: false, SHELTER: false, CONSERVE: false, FULL_VIGILANCE: false, SIGNAL_JAM: false },
        resources: { rations: 36, water: 48, ammoRifle: 900, ammoHeavy: 350, medkits: 3 },
        squad: init.map(s => ({ ...s }))
      });
      let ticks = 0;
      while (gameState.day <= 30 && gameState.squad.some(s => s.hp > 0) && ticks < 30 * 240 + 10) {
        if (gameState.activeCrisis) {
          // Crise: parado ignora (última opção); atento escolhe a primeira que pode pagar
          const ops = CRISES[gameState.activeCrisis.id].opcoes;
          const i = policy === 'atento' ? ops.findIndex(o => !o.pode || o.pode(gameState)) : ops.length - 1;
          resolveCrisis(i);
          continue;
        }
        if (gameState.timeSeconds >= 240) { endTurn(); continue; }
        if (policy === 'atento') atento();
        updateGameTick(); ticks++;
      }
      if (gameState.day > 30) vitorias++;
      somaDias += Math.min(gameState.day, 31);
    }
    return { vitorias, N, taxa: Math.round(100 * vitorias / N), mediaDias: +(somaDias / N).toFixed(1) };
  }, { init: INITIAL_SQUAD, level, policy, N });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  for (const level of LEVELS) {
    for (const policy of ['parado', 'atento']) {
      const page = await browser.newPage();
      await page.goto(GAME, { waitUntil: 'load' });
      const r = await measure(page, level, policy);
      console.log(`nível ${level} | ${policy.padEnd(6)} | vitórias ${r.vitorias}/${r.N} (${r.taxa}%) | média ${r.mediaDias} dias`);
      await page.close();
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
