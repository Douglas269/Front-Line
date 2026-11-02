// Calibração dos níveis de dificuldade do Ponto Alpha.
// Mede a taxa de vitória em cada nível com dois perfis de jogador:
//   parado: nenhuma ação
//   atento: jogador automático com decisões razoáveis (cozinha, descanso, abrigo, apoios)
// Uso: node tests/niveis.js [níveis separados por vírgula] [partidas por perfil]
//   ex.: node tests/niveis.js 1,4,7,10 30
const path = require('path');
const { chromium } = require('playwright');

const GAME = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'ponto-alpha.html');
const LEVELS = (process.argv[2] || '1,4,7,10').split(',').map(Number);
const N = Number(process.argv[3] || 30);

const INITIAL_SQUAD = [
  { id: 1, rank: 'Sgt.', name: 'Silva', class: 'Fuzileiro Regular', hp: 100, fatigue: 10, hunger: 10, thirst: 10, moral: 85, duty: 'WATCH' },
  { id: 2, rank: 'Cbo.', name: 'Santos', class: 'Metralhador', hp: 100, fatigue: 15, hunger: 15, thirst: 15, moral: 80, duty: 'WATCH' },
  { id: 3, rank: 'Sd.', name: 'Ferreira', class: 'Fuzileiro Regular', hp: 90, fatigue: 20, hunger: 20, thirst: 20, moral: 75, duty: 'REST' },
  { id: 4, rank: 'Sd.', name: 'Costa', class: 'Médico', hp: 100, fatigue: 5, hunger: 10, thirst: 10, moral: 90, duty: 'MAINTENANCE' },
  { id: 5, rank: 'Sd.', name: 'Oliveira', class: 'Engenheiro', hp: 100, fatigue: 10, hunger: 10, thirst: 10, moral: 85, duty: 'RATIONING' },
  { id: 6, rank: 'Sd.', name: 'Mendes', class: 'Atirador de Elite', hp: 95, fatigue: 10, hunger: 15, thirst: 15, moral: 88, duty: 'WATCH' }
];

async function measure(page, level, policy) {
  return page.evaluate(({ init, level, policy, N }) => {
    updateUI = () => {}; logFeed = () => {}; addDiaryEntry = () => {};
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
      if (!vivos.some(s => s.duty === 'WATCH')) {
        const menosCansado = vivos.slice().sort((a, b) => a.fatigue - b.fatigue)[0];
        if (menosCansado) menosCansado.duty = 'WATCH';
      }
      const o = gameState.tacticalOrders;
      o.SHELTER = !!gameState.barrage && gameState.barrage.ticks <= 2;
      o.SUPPRESSION = gameState.enemies.length > 0 && gameState.resources.ammoHeavy > 10 && !o.SHELTER;
      o.CONSERVE = gameState.resources.ammoRifle < 100;
      o.FULL_VIGILANCE = false;
      if (gameState.lastIntelDay !== gameState.day) sendIntelReport();
      const r = gameState.resources;
      if (gameState.enemies.some(e => e.type === 'infantaria' && e.distance < 150) && gameState.prestige >= 100) requestSupport('ARTILLERY');
      if (!gameState.pendingSupply && gameState.prestige >= 120 && (r.rations < 12 || r.water < 15 || r.ammoRifle < 150)) requestSupport('SUPPLY');
      if (vivos.some(s => s.hp < 30) && gameState.prestige >= 150 && gameState.supplyLineEff >= 30) requestSupport('MEDEVAC');
    }

    let vitorias = 0, somaDias = 0;
    for (let run = 0; run < N; run++) {
      gameEnded = false;
      Object.assign(gameState, {
        level, day: 1, timeSeconds: 0, speed: 0, prestige: 150, weather: 'Nublado', supplyLineEff: 85,
        enemies: [], activeCrisis: null, barrage: null, pendingSupply: null, lastIntelDay: 0, effects: [],
        tacticalOrders: { SUPPRESSION: false, SHELTER: false, CONSERVE: false, FULL_VIGILANCE: false },
        resources: { rations: 36, water: 48, ammoRifle: 550, ammoHeavy: 200, medkits: 3 },
        squad: init.map(s => ({ ...s }))
      });
      let ticks = 0;
      while (gameState.day <= 30 && gameState.squad.some(s => s.hp > 0) && ticks < 30 * 240 + 10) {
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
