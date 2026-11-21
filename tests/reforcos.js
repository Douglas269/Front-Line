// Reforços do Alto Comando: oferta nos dias 5/10/15/20/25, escolha, efeitos, salvamento e recarga. Uso: node tests/reforcos.js
const { chromium } = require('playwright');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const base = 'file://' + __dirname.replace(/tests$/, '') + 'prototipo/ponto-alpha.html';
    const url = base + '?reforcos=1';
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(url); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); });
    await p.goto(url); await p.waitForTimeout(500);
    await p.evaluate(() => { escolherModo('trincheiras'); try { fecharTutorial(); } catch (e) {} try { fecharModalOp(); } catch (e) {} clearInterval(relogioId); });
    const r = await p.evaluate(() => {
        const o = {};
        for (let i = 0; i < 3; i++) endTurn();            // dia 4: nada
        o.antes = !!gameState.reforcoOferta;
        endTurn();                                          // dia 5: oferta
        o.oferta = (gameState.reforcoOferta || []).length;
        const m = document.getElementById('modal-reforco');
        o.janela = !!m && !m.classList.contains('hidden') && m.querySelectorAll('button').length === 3 && perfilAberto && /▲/.test(m.textContent) && /▼/.test(m.textContent);
        o.pausa = (() => { const t0 = gameState.timeSeconds; updateGameTick(); return gameState.timeSeconds === t0; })();
        // recarregar com a oferta aberta: o save guarda a oferta
        saveGame(); const s = JSON.parse(localStorage.getItem(SAVE_KEY)); o.salvaOferta = (s.reforcoOferta || []).length === 3 && s.reforcoDia === 5;
        // escolhe o 1º: aplica, fecha e despausa
        const id = gameState.reforcoOferta[0], dmg0 = diff().enemyDmgMult;
        escolherReforco(id);
        o.id = id; o.escolhido = gameState.reforcos.length === 1 && !gameState.reforcoOferta && !perfilAberto && document.getElementById('modal-reforco').classList.contains('hidden');
        o.chip = !document.getElementById('reforcos-chip').classList.contains('hidden') && /Reforços/.test(document.getElementById('reforcos-chip').textContent);
        // não oferece de novo no mesmo dia, nem em dia sem oferta
        endTurn(); o.dia6 = !gameState.reforcoOferta;
        // efeitos pontuais
        gameState.reforcos = ['mira', 'imprensa', 'abrigo', 'parapeito']; const d = diff(); gameState.reforcos = [];
        const d0 = diff();
        o.efeitos = d.rewardMult > d0.rewardMult * 1.1 && d.supplyMult < d0.supplyMult && d.enemyDmgMult < d0.enemyDmgMult * 1.0;
        gameState.reforcos = ['paiol']; gameState.reforcoOferta = ['paiol', 'mira', 'maca']; gameState.resources.ammoRifle = 100; escolherReforco('paiol'); o.paiol = gameState.resources.ammoRifle >= 450;
        // 5 ofertas ao longo da partida, sem repetir reforço
        gameState.reforcos = []; gameState.reforcoDia = 0;
        for (let d2 = 6; d2 <= 25; d2++) { endTurn(); if (gameState.reforcoOferta) escolherReforco(gameState.reforcoOferta[0]); }
        o.total = gameState.reforcos.length; o.unicos = new Set(gameState.reforcos).size === gameState.reforcos.length;
        return o;
    });
    if (r.antes) falhas.push('não deveria haver oferta antes do dia 5');
    if (r.oferta !== 3) falhas.push('no dia 5 deveria haver 3 reforços na oferta: ' + JSON.stringify(r));
    if (!r.janela) falhas.push('a janela de escolha não abriu corretamente (3 botões, ▲ e ▼, jogo pausado)');
    if (!r.pausa) falhas.push('o relógio deveria parar durante a escolha');
    if (!r.salvaOferta) falhas.push('a oferta pendente não foi salva');
    if (!r.escolhido) falhas.push('escolher deveria aplicar, fechar a janela e despausar');
    if (!r.chip) falhas.push('o reforço escolhido não aparece na tela');
    if (!r.dia6) falhas.push('não deveria ofertar de novo no dia seguinte');
    if (!r.efeitos) falhas.push('os efeitos nos multiplicadores não bateram: ' + JSON.stringify(r));
    if (!r.paiol) falhas.push('o Paiol ampliado deveria dar munição na hora');
    if (r.total !== 4 || !r.unicos) falhas.push('esperava 4 reforços (dias 10 a 25) sem repetir: ' + JSON.stringify(r));
    // modo automático (teste/robô): escolhe sozinho, sem janela
    const q = await b.newPage({ viewport: { width: 390, height: 844 } }); q.on('pageerror', e => erros.push(e.message));
    await q.goto(base); await q.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); }); await q.goto(base); await q.waitForTimeout(400);
    await q.evaluate(() => { escolherModo('trincheiras'); try { fecharTutorial(); } catch (e) {} clearInterval(relogioId); for (let i = 0; i < 5; i++) endTurn(); });
    const auto = await q.evaluate(() => ({ n: (gameState.reforcos || []).length, pausado: perfilAberto }));
    if (auto.n !== 1 || auto.pausado) falhas.push('em teste automático deveria escolher sozinho sem pausar: ' + JSON.stringify(auto));
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Reforços: oferta, escolha, efeitos, salvamento e modo automático funcionam.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
