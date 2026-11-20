// Teste do layout de computador (painéis laterais com o diário e a logística). Uso: node tests/layout-pc.js (PRINTS=pasta salva capturas)
const path = require('path');
const { chromium } = require('playwright');
const PAGINA = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'ponto-alpha.html');
(async () => {
    const b = await chromium.launch(); const ck = {}; const erros = [];
    const abre = async (w, h) => {
        const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
        await p.goto(PAGINA, { waitUntil: 'load' }); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload({ waitUntil: 'load' });
        await p.evaluate(() => { try { entrarComoConvidado(); } catch (e) {} try { fecharTutorial(); } catch (e) {} });
        await p.evaluate(() => { jogoPausado = false; menuAberto = false; const m = document.getElementById('tela-modos'); if (m) m.classList.add('hidden'); });
        await p.waitForTimeout(1200); return p;
    };
    // tela larga: painéis visíveis, com conteúdo, e atualizando ao vivo
    let p = await abre(1280, 800);
    const larga = await p.evaluate(async () => {
        const e = document.getElementById('lateral-esq'), d = document.getElementById('lateral-dir');
        const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 200;
        const antes = document.getElementById('lateral-esq-corpo').innerHTML.length;
        addDiaryEntry('Teste do layout de computador: entrada nova.'); espelharLaterais();
        return { visiveis: vis(e) && vis(d), diario: /DIÁRIO DE GUERRA|Teste do layout/.test(document.getElementById('lateral-esq-corpo').innerText), nova: /Teste do layout de computador/.test(document.getElementById('lateral-esq-corpo').innerText),
            logistica: document.getElementById('lateral-dir-corpo').innerText.length > 50, semIdsDuplicados: document.querySelectorAll('#diary-entries').length === 1 && document.querySelectorAll('#panel-logistics').length === 1,
            colunaCentral: Math.round(document.querySelector('.max-w-md').getBoundingClientRect().width) > 380, antes };
    });
    ck.pc_paineisVisiveis = larga.visiveis; ck.pc_diarioNaEsquerda = larga.diario; ck.pc_entradaNovaApareceAoVivo = larga.nova; ck.pc_logisticaNaDireita = larga.logistica; ck.pc_semIdsDuplicados = larga.semIdsDuplicados; ck.pc_colunaCentralMantida = larga.colunaCentral;
    if (process.env.PRINTS) await p.screenshot({ path: process.env.PRINTS + '/o-pc.png' });
    await p.context().close();
    // celular: nada muda
    p = await abre(390, 844);
    ck.cel_paineisEscondidos = await p.evaluate(() => ['lateral-esq', 'lateral-dir'].every(id => getComputedStyle(document.getElementById(id)).display === 'none'));
    await p.context().close();
    // tela média (tablet): também sem painéis
    p = await abre(1000, 800);
    ck.tablet_paineisEscondidos = await p.evaluate(() => ['lateral-esq', 'lateral-dir'].every(id => getComputedStyle(document.getElementById(id)).display === 'none'));
    await p.context().close();
    ck.semErrosJS = erros.length === 0;
    console.log(JSON.stringify(ck, null, 1)); if (erros.length) console.log('ERROS:', erros);
    const falhas = Object.entries(ck).filter(([, v]) => v !== true).map(([k]) => k);
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Layout de computador: todas as verificações passaram.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
