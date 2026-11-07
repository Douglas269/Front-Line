// Análise de balanceamento: jogador automático "humano" e métricas detalhadas por nível
// Uso: DIF_MODO=soldado DEF=1 node tests/balanco.js <níveis> <partidas> [ajuste em JS]
//   ex.: DIF_MODO=veterano DEF=1 node tests/balanco.js 1,13,25 40
// DEF=1: o jogador automático também constrói e usa as defesas (metralhadora, morteiro, anticarro, arame).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const GAME = path.resolve(__dirname, '..', 'prototipo', 'ponto-alpha.html'); const LEVELS = (process.argv[2] || '1,13,25').split(',').map(Number); const N = +(process.argv[3] || 20);
const AJUSTE = process.argv[4] || ''; const DIF = process.env.DIF_MODO || ''; const USA_DEF = process.env.DEF === '1';
const src = fs.readFileSync(path.join(__dirname, 'niveis.js'), 'utf8');
const INIT = eval(src.slice(src.indexOf('const INITIAL_SQUAD = ') + 22, src.indexOf('];', src.indexOf('const INITIAL_SQUAD')) + 1));

(async () => {
  const b = await chromium.launch();
  for (const level of LEVELS) {
    const p = await b.newPage(); await p.goto('file://' + GAME, { waitUntil: 'load' });
    const r = await p.evaluate(({ init, level, N, AJUSTE, USA_DEF, DIF }) => {
      const msgs = [];
      logFeed = (m) => msgs.push(m); updateUI = () => {}; addDiaryEntry = () => {};
      entrarComoConvidado(); fecharTutorial(); clearInterval(relogioId);
      playTacticalBeep = () => {}; playGunshotSound = () => {}; saveGame = () => {}; saveLevel = () => {};
      if (AJUSTE) (new Function(AJUSTE))(); if (DIF) CONFIG.dificuldade = DIF;
      const pedidos = { SUPPLY: 0, ARTILLERY: 0, MEDEVAC: 0, COUNTER: 0 };
      const rs = requestSupport; requestSupport = (t) => { const p0 = gameState.prestige; rs(t); if (gameState.prestige < p0) pedidos[t]++; };
      // Jogador atento "humano": supressão só quando a infantaria aperta; economiza com paiol baixo
      function atento() {
        const vivos = gameState.squad.filter(s => s.hp > 0), est = gameState.resources;
        const temComida = est.rations > 0 || est.water > 0;
        const ameaca = gameState.enemies.some(e => e.type !== 'drone' && e.distance < 140);
        vivos.forEach(s => {
          if (s.duty === 'RATIONING') { if ((s.hunger < 5 && s.thirst < 5) || !temComida) s.duty = 'WATCH'; }
          else if ((s.hunger >= 40 || s.thirst >= 40) && temComida && !ameaca) s.duty = 'RATIONING';
          else if (s.fatigue > 75 && !gameState.enemies.length) s.duty = 'REST';
          else if (s.duty === 'REST' && (s.fatigue < 15 || ameaca)) s.duty = 'WATCH';
        });
        const eng = vivos.find(s => s.class === 'Engenheiro');
        if (eng && eng.duty !== 'RATIONING' && eng.duty !== 'REST' && !ameaca) {
          if (gameState.trench < 70) eng.duty = 'MAINTENANCE'; else if (eng.duty === 'MAINTENANCE' && gameState.trench >= 95) eng.duty = 'WATCH';
        }
        if (vivos.length > 1 && vivos.every(s => s.duty === 'WATCH') && !gameState.enemies.length) vivos.slice().sort((a, b) => b.fatigue - a.fatigue)[0].duty = 'REST';
        if (!vivos.some(s => s.duty === 'WATCH')) { const m = vivos.slice().sort((a, b) => a.fatigue - b.fatigue)[0]; if (m) m.duty = 'WATCH'; }
        const o = gameState.tacticalOrders;
        const inf = gameState.enemies.filter(e => e.type === 'infantaria');
        const perto = inf.filter(e => e.distance < 150).length;
        o.SHELTER = !!gameState.barrage && gameState.barrage.ticks <= 16;
        o.SUPPRESSION = !o.SHELTER && perto >= 3 && est.ammoRifle > 150;
        o.CONSERVE = !o.SUPPRESSION && est.ammoRifle < 300;
        o.FULL_VIGILANCE = false; o.SIGNAL_JAM = false;
        if (gameState.barrage && !gameState.counterBattery && gameState.barrage.ticks >= 24 && gameState.prestige >= custo(50)) requestSupport('COUNTER');
        if (gameState.lastIntelDay !== gameState.day) sendIntelReport();
        if (perto >= 5 && gameState.prestige >= custo(100)) requestSupport('ARTILLERY');
        const cg = gameState.cargas || {};
        if (!cg.rations && est.rations < 10 && gameState.prestige >= custo(45) + 50) requestSupport('SUPPLY', 'rations');
        if (!cg.water && est.water < 12 && gameState.prestige >= custo(45) + 50) requestSupport('SUPPLY', 'water');
        if (!cg.ammoRifle && est.ammoRifle < 250 && gameState.prestige >= custo(50) + 50) requestSupport('SUPPLY', 'ammoRifle');
        if (vivos.some(s => s.hp < 30) && gameState.prestige >= custo(150) && gameState.supplyLineEff >= 30) requestSupport('MEDEVAC');
        o.SIGNAL_JAM = droneObservando();
        if (USA_DEF) defesas(vivos, ameaca);
      }
      // Usa as defesas: obra com o Engenheiro, MG no centro (Santos), morteiro (Ferreira), AT (Silva), arame e requisições
      const PLANO = [[1, 'metralhadora', 'Metralhador'], [0, 'morteiro', 'Fuzileiro Regular'], [2, 'lancaAT', 'Fuzileiro Regular']];
      function defesas(vivos, ameaca) {
        const ars = gameState.arsenal;
        const eng = vivos.find(s => s.class === 'Engenheiro');
        const emObra = ars.posicoes.find(p => p.construindo);
        if (!emObra) { const prox = PLANO.find(([i]) => ars.posicoes[i].obra < 100); if (prox) construirPonto(prox[0]); }
        if (eng && ars.posicoes.some(p => p.construindo) && !ameaca && eng.duty !== 'RATIONING' && eng.duty !== 'REST') eng.duty = 'MAINTENANCE';
        const usados = ars.posicoes.map(p => p.operador).filter(Boolean);
        PLANO.forEach(([i, arma, classe], k) => {
          const p = ars.posicoes[i];
          if (p.obra >= 100 && !p.arma && ars.itens[arma] > 0) montarArma(i, arma);
          if (p.arma && (!p.operador || !vivos.some(s => s.id === p.operador))) {
            const cand = vivos.filter(s => !usados.includes(s.id) && s.class !== 'Engenheiro' && s.class !== 'Médico');
            const op = cand.find(s => s.class === classe) || cand[0];
            if (op) { definirOperador(i, op.id); usados.push(op.id); }
          }
          // operador fica de vigília quando há ameaça
          const op = vivos.find(s => s.id === p.operador);
          if (op && ameaca && op.duty === 'REST') op.duty = 'WATCH';
        });
        if (ars.arame <= 0 && ars.itens.arame > 0 && gameState.enemies.some(e => e.type === 'infantaria')) estenderArame();
        if (ars.itens.foguetesAT < 1 && !ars.pedidos.includes('foguetesAT') && gameState.prestige >= custo(80) + 120) requisitar('foguetesAT');
        if (ars.itens.granadaMorteiro < 4 && !ars.pedidos.includes('granadaMorteiro') && gameState.prestige >= custo(60) + 150) requisitar('granadaMorteiro');
      }
      const A = { art: 0, drones: 0, patr: 0, sobFogo: 0, simult: 0, comAlvo: 0, blindados: 0, blindTrinc: 0, vit: 0, dias: 0, combTicks: 0, semMunTicks: 0, diaSemMun: [], diaSemPesada: [], semRacao: 0, semAgua: 0, ticks: 0, rompida: 0, trenchMin: 0, mortes: {}, tiros: 0, acertos: 0, abates: 0, prestigio: 0, ondas: 0, invasoes: 0, fomeAlta: 0, diaPrimeiraMorte: [], estoque: {} };
      for (let run = 0; run < N; run++) {
        gameEnded = false; msgs.length = 0;
        Object.assign(gameState, { arsenal: novoArsenal(), level, day: 1, timeSeconds: 0, prestige: 150, weather: 'Nublado', supplyLineEff: 85,
          enemies: [], activeCrisis: null, barrage: null, cargas: {}, lastIntelDay: 0, effects: [], trench: 100, crisisCooldown: 240, convoyAmbush: false, weakenNextWave: false, counterBattery: null, nextWaveBoost: 0, general: newGeneral(), combate: { tiros: 0, acertos: 0, abates: 0 },
          tacticalOrders: { SUPPRESSION: false, SHELTER: false, CONSERVE: false, FULL_VIGILANCE: false, SIGNAL_JAM: false },
          resources: { rations: 36, water: 48, ammoRifle: 900, ammoHeavy: 350, medkits: 3 }, squad: init.map(s => ({ ...s })) });
        let ticks = 0, semMunDia = null, semPesDia = null, tmin = 100, primeira = null;
        while (gameState.day <= 30 && gameState.squad.some(s => s.hp > 0) && ticks < 30 * 240 + 10) {
          if (gameState.activeCrisis) { const ops = CRISES[gameState.activeCrisis.id].opcoes; resolveCrisis(ops.findIndex(o => !o.pode || o.pode(gameState))); continue; }
          atento();
          const vivos0 = gameState.squad.filter(s => s.hp > 0).map(s => s.id);
          const nMsg = msgs.length;
          if (gameState.enemies.length) { A.combTicks++; if (gameState.resources.ammoRifle < 1) A.semMunTicks++; }
          if (gameState.resources.ammoRifle < 1 && semMunDia === null) semMunDia = gameState.day;
          if (gameState.resources.ammoHeavy < 5 && semPesDia === null) semPesDia = gameState.day;
          if (gameState.resources.rations <= 0) A.semRacao++;
          if (gameState.resources.water <= 0) A.semAgua++;
          if (gameState.squad.some(s => s.hp > 0 && (s.hunger >= 75 || s.thirst >= 75))) A.fomeAlta++;
          if (trincheiraRompida()) A.rompida++;
          tmin = Math.min(tmin, gameState.trench);
          { const f = gameState.day <= 10 ? 'd1a10' : gameState.day <= 20 ? 'd11a20' : 'd21a30'; const e = A.estoque[f] || (A.estoque[f] = { leve: 0, pesada: 0, morteiro: 0, at: 0, n: 0 }); const it = gameState.arsenal.itens; e.leve += gameState.resources.ammoRifle; e.pesada += gameState.resources.ammoHeavy; e.morteiro += it.granadaMorteiro; e.at += it.foguetesAT; e.n++; }
          const cb = gameState.combate; const t0 = cb.tiros, a0 = cb.acertos, k0 = cb.abates;
          updateGameTick(); ticks++; A.ticks++;
          if (gameState.combate === cb) { A.tiros += cb.tiros - t0; A.acertos += cb.acertos - a0; A.abates += cb.abates - k0; }
          const novas = msgs.slice(nMsg).join(' ');
          gameState.squad.filter(s => s.hp <= 0 && vivos0.includes(s.id)).forEach(s => {
            if (primeira === null) primeira = gameState.day;
            const nome = s.rank + ' ' + s.name;
            let c = 'fome/sede';
            if (s.deserted) c = 'deserção';
            else if (novas.includes('BOMBARDEIO: ' + nome)) c = 'artilharia';
            else if (novas.includes('COMBATE: ' + nome)) c = 'tiro inimigo';
            else if (novas.includes('TRINCHEIRA: ' + nome)) c = novas.includes('MASSACRE') ? 'massacre' : 'invasão';
            else if (novas.includes(nome + ' morreu')) c = 'crise';
            A.mortes[c] = (A.mortes[c] || 0) + 1;
          });
          if (/Tropa inimiga avança/.test(novas)) A.ondas++;
          if (/ARTILHARIA INIMIGA: impacto/.test(novas)) A.art++;
          if (/DRONE INIMIGO/.test(novas)) A.drones++;
          if (/PATRULHA INIMIGA/.test(novas)) A.patr++;
          const perto = gameState.enemies.some(e => e.distance < 140 && e.type !== 'drone');
          if (perto) A.sobFogo++;
          if (perto && gameState.barrage) A.simult++;
          if (/BLINDADO INIMIGO avançando/.test(novas)) A.blindados++;
          if (/BLINDADO PASSOU/.test(novas)) A.blindTrinc++;
          A.invasoes += (novas.match(/INVASÃO DE TRINCHEIRA|ENTROU PELA TRINCHEIRA/g) || []).length;
        }
        if (gameState.day > 30) A.vit++;
        A.dias += Math.min(gameState.day, 31); A.diaSemMun.push(semMunDia); A.diaSemPesada.push(semPesDia); A.trenchMin += tmin; A.diaPrimeiraMorte.push(primeira);
        A.prestigio += gameState.prestige;
      }
      const med = (l) => { const v = l.filter(x => x !== null).sort((a, b) => a - b); return v.length ? `dia ${v[Math.floor(v.length / 2)]} (${v.length}/${l.length})` : 'nunca'; };
      const pc = (x) => Math.round(100 * x / A.ticks) + '%';
      return { nivel: level, vitorias: `${A.vit}/${N}`, mediaDias: +(A.dias / N).toFixed(1), primeiraMorte: med(A.diaPrimeiraMorte),
        combateSemMunLeve: Math.round(100 * A.semMunTicks / Math.max(1, A.combTicks)) + '%', zeraLeve: med(A.diaSemMun), zeraPesada: med(A.diaSemPesada),
        semRacao: pc(A.semRacao), semAgua: pc(A.semAgua), fomeOuSede75: pc(A.fomeAlta),
        trincheiraMin: Math.round(A.trenchMin / N), rompida: pc(A.rompida),
        porMinuto: (() => { const min = A.ticks / 8 / 60; return { ondas: +(A.ondas / min).toFixed(2), artilharia: +(A.art / min).toFixed(2), drones: +(A.drones / min).toFixed(2), patrulhas: +(A.patr / min).toFixed(2), blindados: +(A.blindados / min).toFixed(2) }; })(),
        tempoSobFogo: Math.round(100 * A.sobFogo / A.ticks) + '%', artilhariaDuranteCombate: Math.round(100 * A.simult / Math.max(1, A.sobFogo)) + '%',
        blindados: +(A.blindados / N).toFixed(1), blindadosNaTrincheira: +(A.blindTrinc / N).toFixed(1), precisao: Math.round(100 * A.acertos / Math.max(1, A.tiros)) + '%', abates: +(A.abates / N).toFixed(1), tirosPorAbate: Math.round(A.tiros / Math.max(1, A.abates)),
        ondas: +(A.ondas / N).toFixed(1), invasoes: +(A.invasoes / N).toFixed(1), prestigioFinal: Math.round(A.prestigio / N),
        pedidosPorPartida: Object.fromEntries(Object.entries(pedidos).map(([k, v]) => [k, +(v / N).toFixed(1)])), mortes: A.mortes,
        estoqueMedio: Object.fromEntries(Object.entries(A.estoque).map(([k, e]) => [k, { leve: Math.round(e.leve / e.n), pesada: Math.round(e.pesada / e.n), morteiro: Math.round(e.morteiro / e.n), at: Math.round(e.at / e.n) }])) };
    }, { init: INIT, level, N, AJUSTE, USA_DEF, DIF });
    console.log(JSON.stringify(r));
    await p.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
