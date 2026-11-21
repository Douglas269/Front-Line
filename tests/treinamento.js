// Trincheiras: treinamento com prestígio, ofensiva em ondas, avanço 4× e resumo do dia. Uso: node tests/treinamento.js
const { chromium } = require('playwright');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const url = 'file://' + __dirname.replace(/tests$/, '') + 'prototipo/ponto-alpha.html';
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(url); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); });
    await p.goto(url); await p.waitForTimeout(500);
    await p.evaluate(() => { escolherModo('trincheiras'); try { fecharTutorial(); } catch (e) {} try { fecharModalOp(); } catch (e) {} clearInterval(relogioId); });
    const r = await p.evaluate(() => {
        const o = {}; const s = gameState.squad[0];
        // treinamento
        gameState.prestige = 1000; const p0 = gameState.prestige;
        const base = chanceDeAcerto(s, { cadencia: 0.25, precisao: 0.3, dano: 40 }, null);
        o.treinou = treinar(s.id, 'tiro') === true && s.treino.tiro === 1 && gameState.prestige < p0;
        o.precisaoSobe = chanceDeAcerto(s, { cadencia: 0.25, precisao: 0.3, dano: 40 }, null) > base;
        treinar(s.id, 'tiro'); treinar(s.id, 'tiro'); o.teto = treinar(s.id, 'tiro') === false && s.treino.tiro === 3;
        gameState.prestige = 0; o.semPrestigio = treinar(s.id, 'resist') === false;
        gameState.prestige = 1000; treinar(s.id, 'resist');
        s.hp = 50; gameState.timeSeconds = 10; processSquadNeeds(); o.regenera = s.hp > 50;
        saveGame(); const sv = JSON.parse(localStorage.getItem(SAVE_KEY)); o.salva = sv.squad[0].treino && sv.squad[0].treino.tiro === 3 && sv.squad[0].treino.resist === 1;
        o.tela = !!document.getElementById('def-treino') || (renderMelhorias(true), !!document.getElementById('def-treino'));
        // ofensiva em ondas
        gameState.level = 13; gameState.day = 9; gameState.timeSeconds = 100; gameState.enemies = [];
        gameState.ofensiva = { dia: 9, hora: 0, anunciada: true, ativa: false, feita: false };
        processarOfensiva(); o.ondasAgendadas = (gameState.ofensiva.dec || []).length;
        const n0 = gameState.enemies.filter(e => e.type === 'infantaria').length;
        for (let i = 0; i < 90; i++) { gameState.barrage = null; processarOfensiva(); }
        const n1 = gameState.enemies.filter(e => e.type === 'infantaria').length;
        o.ondasChegam = n1 > n0 && gameState.ofensiva.dec.length === 0;
        gameState.level = 3; gameState.ofensiva = { dia: 9, hora: 0, anunciada: true, ativa: false, feita: false }; gameState.enemies = []; processarOfensiva(); o.nivelBaixoDia9 = (gameState.ofensiva.dec || []).length === 1;
        // 4x
        gameState.enemies = []; gameState.barrage = null; gameState.activeCrisis = null; gameState.ofensiva = null; gameEnded = false;
        velocidadeRapida = true; fatorRapido = 2; atualizarBotaoRapido4();
        gameState.timeSeconds = 10; const t2 = gameState.timeSeconds; passoDoRelogio(); const d2 = gameState.timeSeconds - t2;
        alternarRapido4(); gameState.timeSeconds = 10; passoDoRelogio(); const d4 = gameState.timeSeconds - 10;
        o.rapido = [d2, d4]; o.botao4 = !document.getElementById('btn-rapido4').classList.contains('hidden');
        velocidadeRapida = false; atualizarBotaoRapido4(); o.botao4Some = document.getElementById('btn-rapido4').classList.contains('hidden');
        // resumo do dia
        gameState.day = 3; document.getElementById('diary-entries').innerHTML = ''; endTurn(); endTurn();
        o.resumo = /Resumo do dia 4/.test(document.getElementById('diary-entries').textContent);
        return o;
    });
    if (!r.treinou || !r.precisaoSobe) falhas.push('treinar Tiro deveria gastar prestígio e subir a precisão: ' + JSON.stringify(r));
    if (!r.teto) falhas.push('o treino deveria parar no nível 3');
    if (!r.semPrestigio) falhas.push('sem prestígio não treina');
    if (!r.regenera) falhas.push('Resistência deveria recuperar vida');
    if (!r.salva) falhas.push('o treino deveria ir para o save');
    if (!r.tela) falhas.push('a lista de treinamento não apareceu na aba Defesas');
    if (r.ondasAgendadas !== 2 || !r.ondasChegam) falhas.push('a ofensiva do nível 13 deveria trazer 2 ondas extras que chegam: ' + JSON.stringify(r));
    if (!r.nivelBaixoDia9) falhas.push('no nível 3, dia 9, a ofensiva deveria trazer 1 onda extra');
    if (!(r.rapido[1] > r.rapido[0]) || !r.botao4 || !r.botao4Some) falhas.push('o 4× deveria andar mais que o 2× e o botão aparecer só no rápido: ' + JSON.stringify(r.rapido));
    if (!r.resumo) falhas.push('faltou o resumo do dia no diário');
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Treinamento, ofensiva em ondas, 4× e resumo do dia funcionam.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
