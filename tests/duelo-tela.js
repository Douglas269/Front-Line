// Teste do Duelo online de ponta a ponta: dois navegadores jogando um contra o outro
// com um servidor falso que segue as mesmas regras do Supabase (nada é gravado no servidor de verdade).
// Uso: node tests/duelo-tela.js
const path = require('path');
const { chromium } = require('playwright');
const PAGINA = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'duelo.html');

// ---------- Servidor falso (mesmas regras das funções do banco) ----------
const db = { duelos: [], planos: [] };
const usuarios = { a: { id: 'uuid-a', email: 'alfa@teste.com' }, b: { id: 'uuid-b', email: 'bravo@teste.com' } };
let seq = 0;
const participa = (d, uid) => uid === d.jogador_a || uid === d.jogador_b;
const completa = (id, r) => db.planos.filter(p => p.duelo_id === id && p.rodada === r).length >= 2;
const servidor = {
    usuario: (u) => usuarios[u],
    criar: (u, nome) => {
        const d = { id: 'duelo-' + (++seq), codigo: 'TST' + seq + 'X'.repeat(2 - String(seq).length), semente: 424242 + seq, jogador_a: usuarios[u].id, nome_a: nome, jogador_b: null, nome_b: null, rodada: 1, estado: 'aguardando', resultado_a: null, resultado_b: null, vencedor: null, wo: false };
        d.codigo = d.codigo.slice(0, 5);
        db.duelos.push(d); return { ...d };
    },
    entrarCodigo: (u, codigo, nome) => {
        const d = db.duelos.find(x => x.codigo === codigo.toUpperCase().trim());
        if (!d) throw new Error('Duelo não encontrado. Confira o código.');
        if (participa(d, usuarios[u].id)) return { ...d };
        if (d.estado !== 'aguardando' || d.jogador_b) throw new Error('Este duelo já começou ou foi encerrado.');
        d.jogador_b = usuarios[u].id; d.nome_b = nome; d.estado = 'jogando'; return { ...d };
    },
    buscar: (u, id) => {
        const uid = usuarios[u].id, d = db.duelos.find(x => x.id === id);
        if (!d || !participa(d, uid)) throw new Error('não encontrado');
        const planos = db.planos.filter(p => p.duelo_id === id && (p.jogador === uid || completa(id, p.rodada))).map(p => ({ ...p }));
        return { duelo: { ...d }, planos };
    },
    enviar: (u, id, rodada, plano) => {
        const uid = usuarios[u].id, d = db.duelos.find(x => x.id === id);
        if (!d || !participa(d, uid)) throw new Error('Duelo não encontrado.');
        if (d.estado !== 'jogando') throw new Error('O duelo não está em andamento.');
        if (rodada !== d.rodada) throw new Error(`Rodada errada (o duelo está na rodada ${d.rodada}).`);
        if (!db.planos.some(p => p.duelo_id === id && p.rodada === rodada && p.jogador === uid)) db.planos.push({ duelo_id: id, rodada, jogador: uid, plano, criado_em: new Date().toISOString() });
        if (completa(id, rodada) && d.rodada < 5) d.rodada++;
        return { ...d };
    },
    status: (u, id, rodada) => ({ eu: db.planos.some(p => p.duelo_id === id && p.rodada === rodada && p.jogador === usuarios[u].id), adversario: db.planos.some(p => p.duelo_id === id && p.rodada === rodada && p.jogador !== usuarios[u].id) }),
    informar: (u, id, venc) => {
        const uid = usuarios[u].id, d = db.duelos.find(x => x.id === id);
        if (d.estado !== 'jogando') return { ...d };
        if (uid === d.jogador_a) d.resultado_a = venc; else d.resultado_b = venc;
        if (d.resultado_a && d.resultado_a === d.resultado_b) { d.vencedor = d.resultado_a; d.estado = 'fim'; }
        return { ...d };
    },
    wo: () => { throw new Error('Ainda não dá.'); },
    cancelar: (u, id) => { const d = db.duelos.find(x => x.id === id); if (d && d.estado === 'aguardando') d.estado = 'cancelado'; },
    trofeus: (u) => { const uid = usuarios[u].id; const fim = db.duelos.filter(d => d.estado === 'fim' && participa(d, uid)); const v = fim.filter(d => d.vencedor === uid).length; return { trofeus: 3 * v, vitorias: v, derrotas: fim.length - v }; },
    meusDuelos: (u) => db.duelos.filter(d => participa(d, usuarios[u].id) && ['aguardando', 'jogando'].includes(d.estado)).map(d => ({ ...d })),
    sair: () => {}, entrar: (u) => usuarios[u], criarConta: (u) => usuarios[u]
};

async function abrir(browser, quem) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    await p.exposeFunction('apiFalsa', (op, args) => servidor[op](quem, ...args));
    await p.addInitScript(() => {
        window.DUELO_PRAZO = 3; window.DUELO_POLL = 250;
        const ops = ['usuario', 'entrar', 'criarConta', 'sair', 'criar', 'entrarCodigo', 'buscar', 'enviar', 'status', 'informar', 'wo', 'cancelar', 'trofeus', 'meusDuelos'];
        window.DUELO_API = Object.fromEntries(ops.map(op => [op, (...args) => window.apiFalsa(op, args)]));
    });
    await p.goto(PAGINA, { waitUntil: 'load' });
    return { p, erros };
}
const telaDe = (p) => p.evaluate(() => window.__duelo && window.__duelo.estado().tela);

(async () => {
    const browser = await chromium.launch();
    const A = await abrir(browser, 'a'), B = await abrir(browser, 'b');
    const checks = {};
    await A.p.waitForSelector('#bNovo');
    await A.p.screenshot({ path: process.env.PRINTS ? process.env.PRINTS + '/d1-lobby.png' : '/dev/null' }).catch(() => {});
    await A.p.click('#bNovo');
    await A.p.waitForSelector('.codigo');
    const codigo = (await A.p.textContent('.codigo')).trim();
    checks.criaDueloComCodigo = /^[A-Z0-9]{5}$/.test(codigo);
    await B.p.waitForSelector('#cod');
    await B.p.fill('#cod', codigo.toLowerCase());
    await B.p.click('#bEntrarCod');
    // os dois entram na preparação da rodada 1
    await A.p.waitForFunction(() => window.__duelo.estado().tela === 'plano', null, { timeout: 8000 });
    await B.p.waitForFunction(() => window.__duelo.estado().tela === 'plano', null, { timeout: 8000 });
    checks.osDoisPreparam = true;
    if (process.env.PRINTS) await A.p.screenshot({ path: process.env.PRINTS + '/d2-plano.png', fullPage: true });
    // A mexe no plano e dá OK; B deixa o tempo (3 s no teste) acabar → envio automático
    await A.p.click('[data-p="atacar"]');
    await A.p.click('[data-mais="artilharia"]').catch(() => {});
    await A.p.click('#bOk');
    await A.p.waitForFunction(() => window.__duelo.estado().tela === 'espera' || window.__duelo.estado().tela === 'replay', null, { timeout: 8000 });
    checks.okEnviaEEspera = true;
    await B.p.waitForFunction(() => window.__duelo.estado().tela === 'replay', null, { timeout: 12000 });
    checks.tempoAcabaEnviaSozinho = true;
    await A.p.waitForFunction(() => window.__duelo.estado().tela === 'replay', null, { timeout: 8000 });
    if (process.env.PRINTS) { await A.p.waitForTimeout(1500); await A.p.screenshot({ path: process.env.PRINTS + '/d3-replay.png', fullPage: true }); }
    // joga o resto do duelo: pula os replays, OK nos planos
    for (let passo = 0; passo < 80; passo++) {
        const [ta, tb] = [await telaDe(A.p), await telaDe(B.p)];
        if (ta === 'fim' && tb === 'fim') break;
        for (const [J, t] of [[A, ta], [B, tb]]) {
            if (t === 'replay') {
                if (await J.p.$('#bPular')) await J.p.click('#bPular').catch(() => {});
                if (await J.p.$('#bProx')) await J.p.click('#bProx').catch(() => {});
            } else if (t === 'plano' && await J.p.$('#bOk')) {
                await J.p.click('[data-s="0"]').catch(() => {});
                await J.p.click('#bOk').catch(() => {});
            }
        }
        await A.p.waitForTimeout(300);
    }
    const [fa, fb] = [await telaDe(A.p), await telaDe(B.p)];
    checks.duelChegaAoFim = fa === 'fim' && fb === 'fim';
    await A.p.waitForTimeout(800);
    const d = db.duelos[0];
    // os dois celulares calcularam o mesmo placar (cada um vê o seu lado)
    const pa = await A.p.evaluate(() => window.__duelo.estado().jogo.placar), pb = await B.p.evaluate(() => window.__duelo.estado().jogo.placar);
    checks.mesmoResultadoNosDois = JSON.stringify(pa) === JSON.stringify(pb);
    checks.servidorRegistraVencedor = d.estado === 'fim' && !!d.vencedor;
    const tv = servidor.trofeus(d.vencedor === usuarios.a.id ? 'a' : 'b');
    checks.vencedorGanha3Trofeus = tv.trofeus === 3;
    const textoFimA = await A.p.textContent('#app');
    checks.telaFinalMostraVencedor = /VENCEU/.test(textoFimA);
    if (process.env.PRINTS) await A.p.screenshot({ path: process.env.PRINTS + '/d4-fim.png', fullPage: true });
    checks.semErrosJS = A.erros.length === 0 && B.erros.length === 0;
    console.log(JSON.stringify({ placar: pa, rodadas: db.planos.length / 2, vencedor: d.vencedor, errosA: A.erros, errosB: B.erros }));
    const falhas = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Duelo de ponta a ponta: todas as verificações passaram.');
    await browser.close();
    if (falhas.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
