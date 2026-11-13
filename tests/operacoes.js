// Teste das novidades do modo Trincheiras (07-operacoes.js)
// Uso: node tests/operacoes.js
// Operação curta e desafio do dia, Quartel (insígnias e melhorias), cartas, apelidos e memorial,
// obras da trincheira, ordens permanentes e salvamento. Nada vai para o servidor (jogador convidado).
const path = require('path');
const { chromium } = require('playwright');
const JOGO = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'ponto-alpha.html');

(async () => {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    const ck = {};
    const abrirLimpo = async (antes) => {
        await p.goto(JOGO, { waitUntil: 'load' });
        await p.evaluate((a) => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); localStorage.setItem('frontline-ponto-alpha-tutorial', '1'); if (a) Object.entries(a).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v))); }, antes || null);
        await p.reload({ waitUntil: 'load' });
        await p.evaluate(() => { try { fecharMenuModos(); entrarComoConvidado(); fecharTutorial(); } catch (e) {} clearInterval(relogioId); });
    };

    // 1) Partida comum continua sendo a campanha de 30 dias
    await abrirLimpo();
    Object.assign(ck, await p.evaluate(() => ({ campanhaPadrao: gameState.op.tipo === 'longa' && GAME_CONFIG.TOTAL_DAYS === 30, botaoQuartel: !!document.getElementById('btn-quartel') })));
    // Nova partida abre a escolha da operação
    await p.evaluate(() => novaPartida());
    ck.novaPartidaMostraOpcoes = await p.evaluate(() => { const t = document.getElementById('modal-op').textContent; return /Campanha/.test(t) && /Operação curta/.test(t) && /Desafio do dia/.test(t) && perfilAberto === true; });
    await p.evaluate(() => fecharModalOp());

    // 2) Quartel: compra com insígnias e o bônus vale na próxima partida
    await abrirLimpo({ 'frontline-quartel': { insignias: 10, compras: {} } });
    const semBonus = await p.evaluate(() => gameState.resources.rations);
    await p.click('#btn-quartel');
    await p.evaluate(() => comprarQuartel('racao'));
    ck.compraGastaInsignias = await p.evaluate(() => lerQuartel().insignias === 7 && lerQuartel().compras.racao === true);
    await p.evaluate(() => { skipPageHideSave = true; localStorage.setItem('frontline-proxima-op', JSON.stringify({ tipo: 'curta' })); localStorage.removeItem(SAVE_KEY); });
    await p.reload({ waitUntil: 'load' }); await p.evaluate(() => { clearInterval(relogioId); });
    Object.assign(ck, await p.evaluate((sem) => ({
        operacaoCurta: gameState.op.tipo === 'curta' && GAME_CONFIG.TOTAL_DAYS === 10 && !!SITUACOES[gameState.op.situacao],
        bonusDoQuartelValeu: gameState.op.bonus.includes('racao') && gameState.resources.rations >= Math.round(sem * 1.25) - (gameState.op.situacao === 'municao' ? 0 : 0)
    }), semBonus));
    // vence a operação curta: não sobe o nível e dá insígnias
    Object.assign(ck, await p.evaluate(() => {
        const nivel = loadLevel(), ins = lerQuartel().insignias;
        gameEnded = false; gameState.squad.forEach(s => { s.hp = 80; }); gameState.day = 11; checkWinLoss();
        return { vitoriaDaOperacao: gameEnded && /OPERAÇÃO CUMPRIDA/.test(document.getElementById('end-title').textContent), naoMudaONivel: loadLevel() === nivel, ganhaInsignias: lerQuartel().insignias === ins + OPERACOES.curta.insignias };
    }));

    // 3) Desafio do dia: a mesma sorte em duas aberturas, nível 6, sem bônus do Quartel, pontuação no fim
    const desafio = async () => {
        await p.evaluate(() => { skipPageHideSave = true; localStorage.setItem('frontline-proxima-op', JSON.stringify({ tipo: 'desafio' })); localStorage.removeItem(SAVE_KEY); });
        await p.reload({ waitUntil: 'load' });
        return p.evaluate(() => { clearInterval(relogioId); fecharMenuModos(); const rs = []; gameState.squad.forEach(s => { s.hunger = 0; s.thirst = 0; }); for (let i = 0; i < 400; i++) { updateGameTick(); if (i % 100 === 99) rs.push(gameState.enemies.length + ':' + Math.round(gameState.trench * 10) + ':' + gameState.squad.map(s => Math.round(s.hp)).join('.')); }
                return { semente: gameState.op.semente, situacao: gameState.op.situacao, general: JSON.stringify(gameState.general), sorteio: rs.join('|'), nivel: gameState.level, bonus: gameState.op.bonus.length, dia: gameState.op.dia }; });
    };
    const d1 = await desafio(), d2 = await desafio();
    ck.desafioMesmaSorte = d1.semente === d2.semente && d1.general === d2.general && d1.sorteio === d2.sorteio && d1.situacao === d2.situacao;
    ck.desafioNivel6SemBonus = d1.nivel === 6 && d1.bonus === 0;
    Object.assign(ck, await p.evaluate(() => {
        gameEnded = false; gameState.squad.forEach(s => { s.hp = 0; }); gameState.day = 5; checkWinLoss();
        const txt = document.getElementById('end-relatorio').textContent;
        return { desafioMostraPontos: /DESAFIO DE/.test(txt) && /pontos/.test(txt), desafioPedeContaParaRanking: /Entre na sua conta/.test(txt) };
    }));

    // 4) Obras da trincheira: custam prestígio, a Manutenção constrói, e o efeito vale
    await abrirLimpo();
    Object.assign(ck, await p.evaluate(() => {
        const r = {};
        gameState.prestige = 500;
        r.obraTrancadaSemRequisito = !comecarObraT('abrigo');
        r.obraComeca = comecarObraT('sacos') && gameState.obrasT.atual === 'sacos' && gameState.prestige < 500;
        gameState.squad.forEach(s => { s.duty = s.class === 'Engenheiro' ? 'MAINTENANCE' : 'REST'; s.hunger = 0; s.thirst = 0; });
        for (let i = 0; i < 400 && !obraFeita('sacos'); i++) { gameState.timeSeconds = 10 * (i % 20); processSquadNeeds(); }
        r.obraFicaPronta = obraFeita('sacos') && !gameState.obrasT.atual;
        gameState.trench = 100; trenchDamage(20, 'teste'); r.sacosProtegem = Math.abs(gameState.trench - 85) < 0.01;
        r.proximaLiberada = obraDisponivel('abrigo');
        return r;
    }));

    // 5) Ordens permanentes
    Object.assign(ck, await p.evaluate(() => {
        const r = {};
        gameState.squad.forEach(s => { s.hp = 100; s.duty = 'REST'; s.fatigue = 10; s.hunger = 0; s.thirst = 0; s.moral = 80; });
        gameState.ordens.vigiaMin = 3; gameState.timeSeconds = 10; cumprirOrdens();
        r.ordemVigiaMinima = gameState.squad.filter(s => s.duty === 'WATCH').length >= 3;
        gameState.ordens.reparo = 70; gameState.trench = 50; cumprirOrdens();
        r.ordemReparo = gameState.squad.some(s => s.duty === 'MAINTENANCE');
        gameState.trench = 100; cumprirOrdens();
        r.reparoVoltaAoPosto = !gameState.squad.some(s => s.duty === 'MAINTENANCE' && s.ordemMotivo === 'reparo');
        r.painelDeOrdens = /ORDENS PERMANENTES/.test(document.getElementById('ordens-permanentes').textContent);
        return r;
    }));

    // 6) Histórias: carta, apelido e memorial
    Object.assign(ck, await p.evaluate(() => {
        const r = {};
        gameState.day = 1; gameState.squad.forEach(s => { s.hp = 100; });
        endTurn(); // dia 2: chega uma carta
        r.cartaNoDiario = (gameState.cartas || []).length === 1 && /✉️ Carta de/.test(document.getElementById('diary-entries').textContent);
        const s = gameState.squad[0]; s.stats = { tiros: 50, acertos: 20, abates: 12 };
        endTurn();
        r.apelidoGanho = s.apelido === 'Olho de Águia';
        abrirPerfil(s.id); r.fichaMostraApelido = /Olho de Águia/.test(document.getElementById('perfil-nome').textContent); fecharPerfil();
        const m = gameState.squad[1]; m.hp = 0; gameState.timeSeconds = 20; processSquadNeeds();
        const mem = JSON.parse(localStorage.getItem('frontline-memorial') || '[]');
        r.memorialRegistra = mem.length === 1 && mem[0].nome === PERFIS[m.id].nome;
        abrirModalOp('memorial'); r.memorialNoQuartel = new RegExp(PERFIS[m.id].nome).test(document.getElementById('modal-op').textContent); fecharModalOp();
        return r;
    }));

    // 7) Salvamento: operação, obras, ordens e cartas voltam depois de recarregar
    await p.evaluate(() => { saveGame(); });
    await p.reload({ waitUntil: 'load' });
    ck.salvamentoGuardaTudo = await p.evaluate(() => { clearInterval(relogioId); return gameState.op.tipo === 'longa' && obraFeita('sacos') && gameState.ordens.vigiaMin === 3 && gameState.cartas.length >= 1; });

    // 8) Desempenho: 30 partidas inteiras seguidas sem travar (o salvamento não pode pesar)
    ck.trintaPartidasSemTravar = await p.evaluate(() => {
        const realUI = updateUI; updateUI = () => {};
        const init = gameState.squad.map(s => ({ ...s, hp: 100, duty: 'WATCH' }));
        for (let run = 0; run < 30; run++) {
            Object.assign(gameState, { day: 1, timeSeconds: 0, enemies: [], activeCrisis: null, trench: 100, general: newGeneral(), resources: { rations: 36, water: 48, ammoRifle: 550, ammoHeavy: 200, medkits: 3 }, squad: init.map(s => ({ ...s })) });
            gameEnded = false; let t = 0;
            while (gameState.day <= 30 && gameState.squad.some(s => s.hp > 0) && t < 7300) { if (gameState.activeCrisis) { resolveCrisis(CRISES[gameState.activeCrisis.id].opcoes.length - 1); continue; } if (gameState.timeSeconds >= 240) { endTurn(); continue; } updateGameTick(); t++; }
        }
        updateUI = realUI; return true;
    });

    ck.semErrosJS = erros.length === 0;
    await b.close();
    const falhas = Object.entries(ck).filter(([, v]) => !v).map(([k]) => k);
    console.log(JSON.stringify(ck, null, 1));
    if (erros.length) console.log('ERROS: ' + erros.slice(0, 3).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Operações, Quartel, histórias, obras e ordens: todas as verificações passaram.');
    if (falhas.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
