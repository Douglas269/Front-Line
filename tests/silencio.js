// Teste do Trincheiras: ordem tática Silêncio (nível 3+). Uso: node tests/silencio.js   (PRINTS=pasta salva capturas)
const path = require('path');
const { chromium } = require('playwright');
const PAGINA = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'ponto-alpha.html');

(async () => {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    await p.goto(PAGINA, { waitUntil: 'load' });
    await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await p.reload({ waitUntil: 'load' });
    await p.evaluate(() => { try { entrarComoConvidado(); } catch (e) {} try { fecharTutorial(); } catch (e) {} });
    await p.waitForTimeout(600);
    await p.evaluate(() => { jogoPausado = false; menuAberto = false; });
    const ck = await p.evaluate(() => {
        const r = {}, o = () => gameState.tacticalOrders;
        const cena = () => { gameState.squad.forEach(s => Object.assign(s, { hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 85, mental: null, duty: 'WATCH' })); gameState.enemies = []; gameState.barrage = null; gameState.gas = null; gameState.sabotagem = null; gameState.silencio = null; gameState.silencioRecarga = 0; o().SILENCE = false; o().SUPPRESSION = false; o().CONSERVE = false; o().FULL_VIGILANCE = false; gameState.resources.ammoRifle = 800; gameState.day = 3; };
        // liberada só a partir do nível 3
        cena(); gameState.level = 2; toggleTacticalOrder('SILENCE'); r.nivel2NaoLiga = !o().SILENCE;
        gameState.level = 3; renderCorte(true); r.botaoApareceNoNivel3 = !document.getElementById('btn-ord-silence').classList.contains('hidden');
        gameState.level = 2; renderCorte(true); r.botaoEscondidoNoNivel2 = document.getElementById('btn-ord-silence').classList.contains('hidden');
        gameState.level = 3;
        // liga: o esquadrão não atira nem gasta munição, e o inimigo não atira
        cena(); const e = { type: 'infantaria', distance: 100, offsetX: 0, hp: 100, maxHp: 100 }; gameState.enemies = [e];
        toggleTacticalOrder('SILENCE'); r.liga = o().SILENCE && gameState.silencio.ticks === SILENCIO.DURACAO;
        const mun0 = gameState.resources.ammoRifle, hp0 = gameState.squad.map(s => s.hp), tiros0 = gameState.combate.tiros;
        const rnd = Math.random; Math.random = () => 0; // com sorte total, o inimigo atiraria sempre
        for (let i = 0; i < 20; i++) processEnemiesAndCombat();
        Math.random = rnd;
        r.esquadraoNaoAtira = gameState.resources.ammoRifle === mun0 && gameState.combate.tiros === tiros0;
        r.inimigoNaoAtira = gameState.squad.every((s, i) => s.hp === hp0[i]);
        r.inimigoContinuaAvancando = gameState.enemies.length === 0 || gameState.enemies[0].distance < 100;
        // acaba sozinho e recarrega
        for (let i = 0; i < SILENCIO.DURACAO; i++) processEnemiesAndCombat();
        r.acabaSozinho = !o().SILENCE && gameState.silencioRecarga > 0 && gameState.silencioRecarga <= SILENCIO.RECARGA;
        toggleTacticalOrder('SILENCE'); r.recargaImpedeNovoUso = !o().SILENCE;
        gameState.silencioRecarga = 0; toggleTacticalOrder('SILENCE'); r.ligaDeNovoDepoisDaRecarga = o().SILENCE;
        // depois do silêncio o esquadrão volta a atirar
        cena(); gameState.enemies = [{ type: 'infantaria', distance: 100, offsetX: 0, hp: 100, maxHp: 100 }];
        const mun1 = gameState.resources.ammoRifle; for (let i = 0; i < 10; i++) processEnemiesAndCombat();
        r.voltaAAtirar = gameState.resources.ammoRifle < mun1;
        // ordens de fogo rompem o silêncio; ligar o silêncio desliga as de fogo
        cena(); o().SUPPRESSION = true; toggleTacticalOrder('SILENCE'); r.silencioDesligaSupressao = o().SILENCE && !o().SUPPRESSION;
        toggleTacticalOrder('FULL_VIGILANCE'); r.vigiliaRompeSilencio = !o().SILENCE && o().FULL_VIGILANCE && gameState.silencioRecarga > 0;
        // salvar e carregar mantém o silêncio em curso
        cena(); gameState.silencioRecarga = 0; toggleTacticalOrder('SILENCE'); gameState.silencio.ticks = 33; saveGame();
        const salvo = JSON.parse(localStorage.getItem(SAVE_KEY));
        r.salvamentoGuarda = !!salvo.silencio && salvo.silencio.ticks === 33 && salvo.tacticalOrders.SILENCE === true;
        // cena e faixa
        gameState.level = 3; jogoPausado = true; renderCorte(true);
        r.faixaMostraSilencio = /SILÊNCIO/.test(document.getElementById('corte-banner').textContent);
        r.botaoMostraTempo = /ATIVO/.test(document.getElementById('lbl-silencio').textContent) && document.getElementById('btn-ord-silence').classList.contains('btn-active-order');
        return r;
    });
    await p.waitForTimeout(300);
    if (process.env.PRINTS) await p.screenshot({ path: process.env.PRINTS + '/d1-silencio.png' });
    ck.semErrosJS = erros.length === 0;
    console.log(JSON.stringify(ck, null, 1));
    if (erros.length) console.log('ERROS:', erros);
    const falhas = Object.entries(ck).filter(([, v]) => v !== true).map(([k]) => k);
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Silêncio: todas as verificações passaram.');
    await b.close();
    process.exit(falhas.length ? 1 : 0);
})();
