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
    sair: () => {}, entrar: (u) => usuarios[u], criarConta: (u) => usuarios[u],
    // fila, temporada, ranking e replay público (mesmas regras das funções novas do banco)
    procurar: (u, nome) => {
        const uid = usuarios[u].id;
        let d = db.duelos.find(x => x.publico && x.estado === 'aguardando' && x.jogador_a === uid);
        if (d) return { ...d };
        d = db.duelos.find(x => x.publico && x.estado === 'aguardando' && !x.jogador_b && x.jogador_a !== uid);
        if (d) { d.jogador_b = uid; d.nome_b = nome; d.estado = 'jogando'; return { ...d }; }
        const novo = servidor.criar(u, nome), dd = db.duelos.find(x => x.id === novo.id); dd.publico = true; return { ...dd };
    },
    temporada: (u) => { const t = servidor.trofeus(u); return { pontos: Math.max(0, 3 * t.vitorias - t.derrotas), vitorias: t.vitorias, derrotas: t.derrotas, posicao: 1, jogadores: 2 }; },
    ranking: (u) => ['a', 'b'].map(k => ({ nome: k === 'a' ? 'Alfa' : 'Bravo', pontos: servidor.temporada(k).pontos, eu: k === u })).sort((x, y) => y.pontos - x.pontos).map((x, i) => ({ posicao: i + 1, ...x })),
    temporadas: () => [{ mes: '2026-10-01', pontos: 42 }],
    replay: (u, id) => {
        const d = db.duelos.find(x => x.id === id); if (!d || d.estado !== 'fim') return null;
        return { id, semente: d.semente, nome_a: d.nome_a, nome_b: d.nome_b, wo: d.wo, vencedor: d.vencedor === d.jogador_a ? 'A' : 'B',
            planos: db.planos.filter(p => p.duelo_id === id).map(p => ({ rodada: p.rodada, lado: p.jogador === d.jogador_a ? 'A' : 'B', plano: p.plano })) };
    }
};
usuarios.v = null; // visitante sem conta (só assiste ao replay)

async function jogarAteOFim(jogadores) {
    for (let passo = 0; passo < 120; passo++) {
        const telas = await Promise.all(jogadores.map(J => telaDe(J.p)));
        if (telas.every(t => t === 'fim')) return true;
        for (let k = 0; k < jogadores.length; k++) {
            const J = jogadores[k], t = telas[k];
            if (t === 'replay') { if (await J.p.$('#bPular:visible')) await J.p.click('#bPular').catch(() => {}); if (await J.p.$('#bProx')) await J.p.click('#bProx').catch(() => {}); }
            else if (t === 'plano' && await J.p.$('#bOk')) await J.p.click('#bOk').catch(() => {});
        }
        await jogadores[0].p.waitForTimeout(250);
    }
    return false;
}
async function abrir(browser, quem) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    await p.exposeFunction('apiFalsa', (op, args) => servidor[op](quem, ...args));
    await p.addInitScript(() => {
        window.DUELO_PRAZO = 3; window.DUELO_POLL = 250; window.DUELO_FILA_BOT = 2;
        const ops = ['usuario', 'entrar', 'criarConta', 'sair', 'criar', 'entrarCodigo', 'buscar', 'enviar', 'status', 'informar', 'wo', 'cancelar', 'trofeus', 'meusDuelos', 'procurar', 'temporada', 'ranking', 'temporadas', 'replay'];
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
    if (process.env.PRINTS) { await A.p.waitForTimeout(2500); await A.p.screenshot({ path: process.env.PRINTS + '/d3-replay.png' }); }
    // o replay mostra uma trincheira por vez e termina com o resumo do que decidiu a rodada
    checks.replayUmaTrincheiraPorVez = await A.p.evaluate(() => document.querySelectorAll('canvas#cvReplay').length === 1 && !!document.querySelector('.abas [data-aba="1"]'));
    await A.p.click('#bPular');
    await A.p.waitForSelector('.decidiu li');
    checks.replayTemResumo = (await A.p.$$('.decidiu li')).length >= 1;
    checks.semMenuDuplicado = await B.p.evaluate(() => document.querySelectorAll('a[href]').length <= 1);
    if (process.env.PRINTS) await A.p.screenshot({ path: process.env.PRINTS + '/d3b-resumo.png' });
    // joga o resto do duelo: pula os replays, OK nos planos
    for (let passo = 0; passo < 80; passo++) {
        const [ta, tb] = [await telaDe(A.p), await telaDe(B.p)];
        if (ta === 'fim' && tb === 'fim') break;
        for (const [J, t] of [[A, ta], [B, tb]]) {
            if (t === 'replay') {
                if (await J.p.$('#bPular:visible')) await J.p.click('#bPular').catch(() => {});
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
    // ---- Liga e temporada no lobby, ranking ----
    await A.p.click('#bLobby'); await A.p.waitForSelector('#bFila');
    const lobbyTxt = await A.p.textContent('#app');
    checks.lobbyTemUmSoLinkDeMenu = await A.p.evaluate(() => document.querySelectorAll('#app a[href]').length === 1 && /Menu principal/.test(document.querySelector('#app a[href]').textContent));
    checks.lobbyMostraLigaETemporada = /Liga (Bronze|Prata|Ouro|Platina|Diamante)/.test(lobbyTxt) && /Temporada de/.test(lobbyTxt) && /🥇 out/.test(lobbyTxt);
    if (process.env.PRINTS) await A.p.screenshot({ path: process.env.PRINTS + '/d5-lobby-liga.png', fullPage: true });
    await A.p.click('#bRanking'); await A.p.waitForSelector('.euRank');
    checks.rankingMostraVoce = /Alfa|Bravo/.test(await A.p.textContent('#app'));
    await A.p.click('#bVoltarR'); await A.p.waitForSelector('#bFila');
    // ---- Fila: os dois entram, se encontram, escolhem doutrinas diferentes e jogam até o fim ----
    await B.p.click('#bLobby').catch(() => {}); await B.p.waitForSelector('#bFila');
    await A.p.click('#bFila'); await A.p.waitForTimeout(400); await B.p.click('#bFila');
    await A.p.waitForFunction(() => window.__duelo.estado().tela === 'plano', null, { timeout: 8000 });
    await B.p.waitForFunction(() => window.__duelo.estado().tela === 'plano', null, { timeout: 8000 });
    checks.filaJuntaOsDois = true;
    await A.p.click('[data-dout="fortaleza"]'); await B.p.click('[data-dout="artilharia"]');
    if (process.env.PRINTS) await A.p.screenshot({ path: process.env.PRINTS + '/d6-doutrina.png', fullPage: true });
    await A.p.click('#bOk'); await B.p.click('#bOk');
    checks.duelDaFilaChegaAoFim = await jogarAteOFim([A, B]);
    const dFila = db.duelos.find(x => x.publico && x.estado === 'fim');
    const p1 = db.planos.filter(x => x.duelo_id === dFila.id && x.rodada === 1);
    checks.doutrinasGravadas = p1.some(x => x.plano.doutrina === 'fortaleza') && p1.some(x => x.plano.doutrina === 'artilharia');
    // ---- Replay público: um visitante sem conta abre o link e assiste até o fim ----
    const V = await abrir(browser, 'v');
    await V.p.goto(PAGINA + '?replay=' + dFila.id, { waitUntil: 'load' });
    await V.p.waitForSelector('#cvReplay');
    checks.replayAbreSemConta = true;
    for (let k = 0; k < 8 && !(await V.p.$('#bDeNovo')); k++) { if (await V.p.$('#bPular:visible')) await V.p.click('#bPular').catch(() => {}); if (await V.p.$('#bProx')) await V.p.click('#bProx').catch(() => {}); await V.p.waitForTimeout(200); }
    checks.replayMostraOVencedor = /venceu/.test(await V.p.textContent('#app'));
    if (process.env.PRINTS) await V.p.screenshot({ path: process.env.PRINTS + '/d7-replay-publico.png', fullPage: true });
    // ---- Treino contra o bot: joga até o fim e não mexe nos troféus ----
    const trofeusAntes = servidor.trofeus('a').trofeus;
    await A.p.click('#bLobby'); await A.p.waitForSelector('#bTreino'); await A.p.click('#bTreino');
    await A.p.waitForFunction(() => window.__duelo.estado().tela === 'plano', null, { timeout: 8000 });
    checks.treinoContraBotTermina = await jogarAteOFim([A]);
    checks.treinoNaoValeTrofeus = servidor.trofeus('a').trofeus === trofeusAntes && /não vale/.test(await A.p.textContent('#app'));
    // ---- Ninguém na fila: cai no bot sozinho ----
    await A.p.click('#bLobby'); await A.p.waitForSelector('#bFila'); await A.p.click('#bFila');
    await A.p.waitForFunction(() => window.__duelo.estado().tela === 'plano' && /🤖/.test(document.body.textContent), null, { timeout: 10000 });
    checks.filaVaziaViraBot = true;
    checks.semErrosJS = A.erros.length === 0 && B.erros.length === 0 && V.erros.length === 0;
    console.log(JSON.stringify({ placar: pa, rodadas: db.planos.filter(x => x.duelo_id === d.id).length / 2, vencedor: d.vencedor, errosA: A.erros, errosB: B.erros, errosV: V.erros }));
    const falhas = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Duelo de ponta a ponta: todas as verificações passaram.');
    await browser.close();
    if (falhas.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
