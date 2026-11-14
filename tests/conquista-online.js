// Teste da Conquista online de ponta a ponta: 3 navegadores (anfitrião + 2) numa rede falsa
// (mesmo jeito do canal do Supabase: broadcast + presence; nada vai para o servidor de verdade).
// Uso: node tests/conquista-online.js
const path = require('path');
const { chromium } = require('playwright');
const PAGINA = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');

const canais = {}; // nome -> [{ page, meta }]
async function presencaDe(nome) { const l = (canais[nome] || []).map(x => x.meta); for (const x of canais[nome] || []) await x.page.evaluate((l) => window.__presenca(l), l).catch(() => {}); }
async function abrir(browser, nomeJog) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const erros = []; page.on('pageerror', e => erros.push(e.message));
    await page.exposeFunction('redeOp', async (op, args) => {
        if (op === 'conectar') { const [nome, meta] = args; (canais[nome] = canais[nome] || []).push({ page, meta }); await presencaDe(nome); }
        else if (op === 'enviar') { const [nome, payload] = args; for (const x of canais[nome] || []) if (x.page !== page) x.page.evaluate((p) => window.__entrega(p), payload).catch(() => {}); }
        else if (op === 'sair') { const [nome] = args; canais[nome] = (canais[nome] || []).filter(x => x.page !== page); await presencaDe(nome); }
    });
    await page.addInitScript(() => {
        window.CONQ_ESTADO_MS = 300;
        window.CONQ_REDE = { conectar(nome, meta, ao) { window.__ao = ao; window.redeOp('conectar', [nome, meta]); return { enviar: (p) => window.redeOp('enviar', [nome, p]), sair: () => window.redeOp('sair', [nome]) }; } };
        window.__entrega = (p) => window.__ao && window.__ao.mensagem(p);
        window.__presenca = (l) => window.__ao && window.__ao.presenca(l);
    });
    await page.goto(PAGINA, { waitUntil: 'load' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    return { page, erros, nomeJog };
}
const est = (J) => J.page.evaluate(() => window.__online.estado());

(async () => {
    const browser = await chromium.launch();
    const ck = {};
    const H = await abrir(browser, 'Alfa'), A = await abrir(browser, 'Bia'), B = await abrir(browser, 'Caio');
    // anfitrião cria a sala
    await H.page.click('#bOnline'); await H.page.fill('#onNome', 'Alfa');
    await H.page.click('text=CRIAR UMA SALA'); await H.page.waitForSelector('.codigoOn');
    const codigo = (await H.page.textContent('.codigoOn')).trim();
    ck.salaComCodigo = /^[A-Z0-9]{5}$/.test(codigo);
    // os outros entram com o código
    for (const J of [A, B]) {
        await J.page.click('#bOnline'); await J.page.fill('#onNome', J.nomeJog); await J.page.fill('#onCodigo', codigo.toLowerCase());
        await J.page.click('text=ENTRAR NA SALA'); await J.page.waitForSelector('.codigoOn');
    }
    await H.page.waitForFunction(() => document.querySelectorAll('.lista-tropas .linha-tropa:not(.trancada)').length === 3, null, { timeout: 5000 });
    ck.salaMostraOsTres = true;
    ck.salaContaOsBotsCerto = /3 comandantes \+ 2 bots/.test(await H.page.textContent('#telaCaixa'));
    if (process.env.PRINTS) await H.page.screenshot({ path: process.env.PRINTS + '/o1-sala.png' });
    await H.page.click('button:has-text("COMEÇAR (")');
    await A.page.waitForFunction(() => window.__online.estado().cliente && G.capitalJogador, null, { timeout: 6000 });
    await B.page.waitForFunction(() => window.__online.estado().cliente && G.capitalJogador, null, { timeout: 6000 });
    const [eh, ea, eb] = [await est(H), await est(A), await est(B)];
    // quem chega depois que o jogo começou recebe aviso (não fica preso esperando)
    const D = await abrir(browser, 'Dani');
    await D.page.click('#bOnline'); await D.page.fill('#onNome', 'Dani'); await D.page.fill('#onCodigo', codigo); await D.page.click('text=ENTRAR NA SALA');
    await D.page.waitForFunction(() => /JÁ COMEÇOU/.test(document.getElementById('telaCaixa').textContent), null, { timeout: 5000 }).then(() => { ck.atrasadoRecebeAviso = true; }).catch(() => { ck.atrasadoRecebeAviso = false; });
    await D.page.evaluate(() => sairDaSala());
    ck.papeisCertos = eh.papel === 'host' && ea.cliente && eb.cliente && ea.minha !== eb.minha;
    // cada um se vê como "Você" na própria capital, e as capitais são diferentes
    const capA = await A.page.evaluate(() => ({ id: G.capitalJogador, dono: G.prov[G.capitalJogador].dono, eu: FACCOES.jogador.nome }));
    const capB = await B.page.evaluate(() => G.capitalJogador);
    const capH = await H.page.evaluate(() => G.capitalJogador);
    ck.cadaUmSeVeComoVoce = capA.dono === 'jogador' && capA.eu === 'Você' && new Set([capA.id, capB, capH]).size === 3;
    ck.anfitriaoVeOsNomes = await H.page.evaluate((m) => FACCOES[m].nome === 'Bia', ea.minha);
    // ordem do cliente chega ao anfitrião e o exército anda
    const ordem = await A.page.evaluate(() => {
        const e = exParadosEm(G.capitalJogador, 'jogador')[0], destino = G.prov[G.capitalJogador].viz.find(v => G.prov[v].dono !== 'jogador');
        prepararOrdem(e.id, destino, 'ataque'); G.pendente.qtd = 4; confirmarOrdem();
        return { exId: e.id, destino };
    });
    await H.page.waitForFunction((o) => G.ex.some(e => e.rota.length && e.rota[e.rota.length - 1] === o.destino && e.s.length === 4), ordem, { timeout: 5000 });
    ck.ordemChegaAoAnfitriao = true;
    await A.page.waitForFunction((o) => G.ex.some(e => e.dono === 'jogador' && e.rota.length && e.rota[e.rota.length - 1] === o.destino), ordem, { timeout: 5000 });
    ck.clienteVeAMarcha = true;
    if (process.env.PRINTS) { await A.page.evaluate(() => { G.sel = { tipo: 'prov', id: G.capitalJogador }; G.noticias = []; renderPainel(); }); await A.page.waitForTimeout(500); await A.page.screenshot({ path: process.env.PRINTS + '/o2-cliente.png' }); }
    // recrutamento do cliente
    const antes = await H.page.evaluate((m) => tropaDe(m), eb.minha);
    await B.page.evaluate(() => { recrutar(G.capitalJogador, 2, 'inf'); });
    await H.page.waitForFunction(([m, n]) => tropaDe(m) >= n + 2, [eb.minha, antes], { timeout: 5000 });
    ck.recrutamentoChega = true;
    // o tempo anda no anfitrião: a conquista aparece para o cliente que atacou
    await H.page.evaluate(() => { for (let i = 0; i < 120; i++) passoMapa(0.5); });
    await A.page.waitForTimeout(900);
    ck.conquistaApareceParaOCliente = await A.page.evaluate((o) => G.prov[o.destino].dono === 'jogador' || G.noticias.some(n => /segurou|conquistou/.test(n.txt)), ordem);
    ck.clienteNaoSimula = await A.page.evaluate(() => Object.keys(G.pensar).length > 0 && !(G.batalhas && G.batalhas.length)); // não roda bots nem batalhas
    // quem sai vira bot no anfitrião
    await B.page.evaluate(() => sairDaSala());
    await H.page.waitForFunction((m) => G.pensar[m] !== undefined && /bot/.test(FACCOES[m].nome), eb.minha, { timeout: 5000 });
    ck.quemSaiViraBot = true;
    // fim: as outras capitais caem → o anfitrião vence e o cliente vê o resultado
    await H.page.evaluate(() => { ['bravo', 'charlie', 'delta', 'echo'].forEach(b => { if (!G.eliminados[b]) eliminar(b, 'jogador'); }); verificarFim(); });
    await A.page.waitForFunction(() => G.fim === 'online' && /VENCEU/.test(document.getElementById('telaCaixa').textContent), null, { timeout: 5000 });
    if (process.env.PRINTS) await A.page.screenshot({ path: process.env.PRINTS + '/o3-fim.png' });
    ck.fimChegaAoCliente = await A.page.evaluate(() => /ALFA VENCEU/.test(document.getElementById('telaCaixa').textContent));
    ck.anfitriaoVence = await H.page.evaluate(() => G.vencedor === 'jogador' && /VOCÊ VENCEU/.test(document.getElementById('telaCaixa').textContent));
    ck.botoesVoltamDepoisDoOnline = await A.page.evaluate(() => { sairDaSala(); comecarFase(1); return getComputedStyle(document.getElementById('bPausa')).display !== 'none' && getComputedStyle(document.getElementById('bVelMapa')).display !== 'none'; });
    ck.semErrosJS = H.erros.length + A.erros.length + B.erros.length + D.erros.length === 0;
    await browser.close();
    console.log(JSON.stringify(ck, null, 1));
    const erros = [...H.erros, ...A.erros, ...B.erros]; if (erros.length) console.log('ERROS: ' + erros.slice(0, 3).join(' | '));
    const falhas = Object.entries(ck).filter(([, v]) => !v).map(([k]) => k);
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Conquista online: todas as verificações passaram.');
    if (falhas.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
