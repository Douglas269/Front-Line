// "Nova partida" do Trincheiras: depois de escolher a operação a página recarrega e deve abrir já na partida nova,
// sem voltar ao menu de modos. Abrir o site normalmente continua mostrando o menu. Uso: node tests/novo-jogo.js
const { chromium } = require('playwright');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const url = 'file://' + __dirname.replace(/tests$/, '') + 'prototipo/ponto-alpha.html';
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(url); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); });
    await p.goto(url); await p.waitForTimeout(600);
    const menuInicial = await p.evaluate(() => menuAberto);
    if (!menuInicial) falhas.push('abrir o site normalmente deveria mostrar o menu de modos');
    await p.evaluate(() => escolherModo('trincheiras')); await p.waitForTimeout(300);
    await p.evaluate(() => { try { fecharTutorial(); } catch (e) {} });
    // escolhe uma operação em "Nova partida": a página recarrega
    await p.evaluate(() => { novaPartida(); });
    await p.waitForTimeout(300);
    await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.evaluate(() => comecarOperacao('curta'))]);
    await p.waitForTimeout(1200);
    const depois = await p.evaluate(() => ({ menu: menuAberto, escondido: document.getElementById('tela-modos').classList.contains('hidden'), dia: gameState.day, marca: sessionStorage.getItem('frontline-entrar-direto'), op: JSON.parse(localStorage.getItem('frontline-operacao') || 'null') }));
    if (depois.menu || !depois.escondido) falhas.push('depois de escolher a operação, o jogo voltou ao menu de modos: ' + JSON.stringify(depois));
    if (depois.dia !== 1) falhas.push('a partida nova deveria estar no dia 1: ' + JSON.stringify(depois));
    if (depois.marca) falhas.push('a marca de entrada direta deveria ser gasta');
    // recarregar de novo (sem nova partida): volta ao menu
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
    if (!(await p.evaluate(() => menuAberto))) falhas.push('recarregar o site depois disso deveria mostrar o menu de modos');
    // fim de jogo: REINICIAR OPERAÇÃO também abre direto na operação nova
    await p.evaluate(() => { escolherModo('trincheiras'); try { fecharTutorial(); } catch (e) {} }); await p.waitForTimeout(300);
    await p.evaluate(() => endGame('💀', 'POSIÇÃO PERDIDA', 'text-red-600', 'teste')); await p.waitForTimeout(300);
    await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.evaluate(() => [...document.querySelectorAll('#modal-end button')].find(b => /REINICIAR/.test(b.textContent)).click())]);
    await p.waitForTimeout(1000);
    if (await p.evaluate(() => menuAberto)) falhas.push('REINICIAR OPERAÇÃO voltou ao menu de modos');
    // atualizar de versão no meio do jogo volta para o jogo; no menu continua no menu
    await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.evaluate(() => { window.__versaoNova = 'teste1'; atualizarAgora(); })]);
    await p.waitForTimeout(1000);
    if (await p.evaluate(() => menuAberto)) falhas.push('Atualizar no meio do jogo voltou ao menu de modos');
    await p.evaluate(() => { abrirMenuModos && abrirMenuModos(); }); await p.waitForTimeout(300);
    await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.evaluate(() => { window.__versaoNova = 'teste2'; atualizarAgora(); })]);
    await p.waitForTimeout(1000);
    if (!(await p.evaluate(() => menuAberto))) falhas.push('Atualizar estando no menu deveria continuar no menu');
    // entrar pelo menu em Trincheiras: sempre abre a escolha da operação (com "Continuar" só se há partida em andamento)
    const q = await b.newPage({ viewport: { width: 390, height: 844 } }); q.on('pageerror', e => erros.push(e.message));
    await q.goto(url + '?escolha=1'); await q.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); });
    await q.goto(url + '?escolha=1'); await q.waitForTimeout(600);
    await q.evaluate(() => escolherModo('trincheiras')); await q.waitForTimeout(300);
    const esc1 = await q.evaluate(() => { const m = document.getElementById('modal-op'); return { aberto: !!m && !m.classList.contains('hidden'), ops: m ? m.querySelectorAll('button[onclick^="comecarOperacao"]').length : 0, continuar: m ? /CONTINUAR PARTIDA/.test(m.textContent) : null, pausado: perfilAberto }; });
    if (!esc1.aberto || esc1.ops !== 3 || esc1.continuar || !esc1.pausado) falhas.push('ao clicar em Trincheiras deveria abrir a escolha das 3 operações, sem Continuar: ' + JSON.stringify(esc1));
    await q.evaluate(() => { fecharModalOp(); try { fecharTutorial(); } catch (e) {} gameState.day = 4; menuAberto = false; abrirMenuModos(); });
    await q.evaluate(() => escolherModo('trincheiras')); await q.waitForTimeout(300);
    const esc2 = await q.evaluate(() => { const m = document.getElementById('modal-op'); return { aberto: !m.classList.contains('hidden'), continuar: /CONTINUAR PARTIDA · DIA 4/.test(m.textContent) }; });
    if (!esc2.aberto || !esc2.continuar) falhas.push('com partida em andamento a escolha deveria oferecer Continuar: ' + JSON.stringify(esc2));
    await q.evaluate(() => [...document.querySelectorAll('#modal-op button')].find(x => /CONTINUAR PARTIDA/.test(x.textContent)).click());
    if (await q.evaluate(() => !document.getElementById('modal-op').classList.contains('hidden') || perfilAberto)) falhas.push('Continuar deveria fechar a escolha e despausar');
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Nova partida: entra direto no jogo; o site normal continua abrindo no menu.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
