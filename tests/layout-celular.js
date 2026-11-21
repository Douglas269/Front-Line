// Percorre as telas dos modos em 390×844 e roda a auditoria de layout (tests/layout-audit.js). Uso: node tests/layout-celular.js
const path = require('path');
const { chromium } = require('playwright');
const auditoria = require('./layout-audit.js');
const R = path.resolve(__dirname, '..', 'prototipo');
const JOGO = 'file://' + path.join(R, 'ponto-alpha.html'), CONQ = 'file://' + path.join(R, 'conquista.html');
const achados = [];
async function ver(p, nome) { const r = await p.evaluate(`(${auditoria.toString()})()`); r.forEach(x => achados.push(nome + ' → ' + x.join(' | '))); }
(async () => {
    const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const erros = [];
    p.on('pageerror', e => erros.push(e.message));
    // Trincheiras
    await p.goto(JOGO + '?titulo=1'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-modo', 'convidado'); }); await p.goto(JOGO + '?titulo=1'); await p.waitForTimeout(900);
    await ver(p, 'Trincheiras: título');
    await p.evaluate(() => jogarDoTitulo()); await p.waitForTimeout(400); await ver(p, 'Trincheiras: menu de modos');
    await p.evaluate(() => { escolherModo('trincheiras', true); try { fecharTutorial(); } catch (e) {} clearInterval(relogioId); }); await p.waitForTimeout(500); await ver(p, 'Trincheiras: jogo');
    for (const aba of ['LOGÍSTICA', 'RÁDIO', 'DIÁRIO', 'DEFESAS']) { await p.evaluate((n) => { [...document.querySelectorAll('nav button, footer button, button')].find(x => x.textContent.trim().toUpperCase() === n && x.getBoundingClientRect().top > 700)?.click(); }, aba); await p.waitForTimeout(250); await ver(p, 'Trincheiras: aba ' + aba); }
    await p.evaluate(() => abrirModalOp('nova')); await p.waitForTimeout(250); await ver(p, 'Trincheiras: escolha da operação');
    await p.evaluate(() => { fecharModalOp(); abrirMenuModos(); }); await p.waitForTimeout(200);
    // Conquista
    await p.goto(CONQ); await p.evaluate(() => localStorage.clear()); await p.goto(CONQ); await p.waitForTimeout(800);
    await ver(p, 'Conquista: seleção de fase');
    await p.evaluate(() => { comecarFase(1); }); await p.waitForTimeout(600); await ver(p, 'Conquista: mapa');
    for (const [nome, fn] of [['Situação', 'abrirSituacao()'], ['Economia', 'abrirEconomia()'], ['Pesquisa', "G.sel={tipo:'pesquisa'};renderPainel()"], ['Diplomacia', "G.sel={tipo:'diplo'};renderPainel()"], ['Generais', "G.sel={tipo:'generais'};renderPainel()"]]) { await p.evaluate(fn); await p.waitForTimeout(200); await ver(p, 'Conquista: painel ' + nome); }
    await p.evaluate(() => { G.fim = 'tempo'; mostrarFim(); }); await p.waitForTimeout(300); await ver(p, 'Conquista: fim da fase');
    await b.close();
    const unicos = [...new Set(achados)];
    console.log(unicos.length ? unicos.join('\n') : 'Layout de celular: nenhum problema achado.');
    if (erros.length) console.log('ERROS JS:', erros.slice(0, 3).join(' | '));
    process.exit(unicos.length ? 1 : 0);
})();
