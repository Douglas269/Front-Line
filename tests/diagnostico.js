// Tela "por que perdi": histórico por dia, causa das mortes, dicas e salvamento. Uso: node tests/diagnostico.js
const { chromium } = require('playwright');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const url = 'file://' + __dirname.replace(/tests$/, '') + 'prototipo/ponto-alpha.html';
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(url); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); });
    await p.goto(url); await p.waitForTimeout(500);
    await p.evaluate(() => { escolherModo('trincheiras'); try { fecharTutorial(); } catch (e) {} try { fecharModalOp(); } catch (e) {} clearInterval(relogioId); });
    const r = await p.evaluate(() => {
        const o = {};
        // dia 1 -> 3 com munição acabando: o retrato do dia é guardado
        endTurn(); gameState.resources.ammoRifle = 20; gameState.resources.ammoHeavy = 2; endTurn();
        o.hist = (gameState.hist || []).length; o.munCritica = diasCriticos().municao;
        // uma morte por fome e uma em combate
        const v = gameState.squad;
        v[0].hunger = 90; v[0].hp = 0; processSquadNeeds();
        v[1].hp = 0; processSquadNeeds();
        o.mortes = gameState.mortes.map(m => m.causa);
        // não duplica
        processSquadNeeds(); o.mortesDepois = gameState.mortes.length;
        // salva e carrega
        saveGame(); const salvo = JSON.parse(localStorage.getItem(SAVE_KEY)); o.salvou = (salvo.hist || []).length === o.hist && (salvo.mortes || []).length === 2;
        // fim de jogo: a tela mostra a causa e as dicas
        gameState.squad.forEach(s => { s.hp = 0; }); gameEnded = false; checkWinLoss();
        const d = document.getElementById('diagnostico');
        o.tela = d ? d.textContent.replace(/\s+/g, ' ') : null;
        return o;
    });
    if (r.hist < 2) falhas.push('o histórico por dia não foi guardado: ' + JSON.stringify(r));
    if (!r.munCritica) falhas.push('a munição crítica não foi detectada');
    if (JSON.stringify(r.mortes) !== JSON.stringify(['fome e sede', 'combate'])) falhas.push('causas das mortes erradas: ' + JSON.stringify(r.mortes));
    if (r.mortesDepois !== 2) falhas.push('a mesma morte foi registrada mais de uma vez');
    if (!r.salvou) falhas.push('histórico e mortes não foram salvos');
    if (!r.tela || !/POR QUE A POSIÇÃO CAIU/.test(r.tela) || !/Causa principal/.test(r.tela) || !/Para a próxima/.test(r.tela) || !/munição/i.test(r.tela)) falhas.push('a tela de derrota não mostra o diagnóstico: ' + r.tela);
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Por que perdi: histórico, causas, dicas e salvamento funcionam.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
