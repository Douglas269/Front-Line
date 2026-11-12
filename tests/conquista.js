// Teste do modo Conquista (mapa grande, exércitos, espião) e da tela inicial de modos
// Uso: node tests/conquista.js
// 1) a tela inicial do jogo mostra os 3 modos e pausa o relógio até escolher;
// 2) os mapas das 3 fases: províncias ligadas, vizinhança dos dois lados, nomes sem repetir, capitais com saída;
// 3) jogando pela tela, com toques: escolher exército, destino e quantidade, confirmar; espião viaja e não luta;
//    arrastar e dar zoom;
// 4) fases inteiras sem tela com um jogador automático cuidadoso e um descuidado.
const path = require('path');
const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..', 'prototipo');
const JOGO = 'file://' + path.join(RAIZ, 'ponto-alpha.html');
const CONQ = 'file://' + path.join(RAIZ, 'conquista.html');

// Joga N fases sem tela. EST: 'esperto' (espiona, guarda a capital, recruta, avança com vantagem e usa artilharia)
// ou 'ingenuo' (manda o maior exército inteiro para um vizinho qualquer).
function jogar({ N, FASE, EST }) {
    esconderTela(); laco = () => {};
    const res = []; let travou = false;
    for (let j = 0; j < N; j++) {
      novoJogo(FASE);
      const est = { ataquesBot: 0, contraMim: 0, minhasMax: 0 };
      const ord = ordem;
      ordem = (...a) => { const e = G.ex.find(x => x.id === a[0]); const res = ord(...a); if (res && e.dono !== 'jogador' && G.prov[a[1]].dono !== e.dono) { est.ataquesBot++; if (G.prov[a[1]].dono === 'jogador') est.contraMim++; } return res; };
      let pensa = 0, passos = 0;
      while (!G.fim) {
        passoMapa(0.5); passos++;
        if (G.batalha) { const bt = G.batalha; if (bt.souAtq && EST === 'esperto' && bt.def.length >= 3) artilhariaNaBatalha(bt, 'atq'); while (!bt.terminou) bt.passo(0.25); fecharBatalha(); }
        est.minhasMax = Math.max(est.minhasMax, minhas().length);
        if (passos > 20000) { travou = true; break; }
        if ((pensa -= 0.5) > 0) continue; pensa = 3;
        const f = G.fac.jogador, cap = G.prov[G.capitalJogador];
        if (EST === 'parado') continue;
        if (EST === 'ingenuo') {
          const e = exDe('jogador').filter(parado).sort((a, z) => z.s.length - a.s.length)[0];
          if (e && e.s.length >= 4 && Math.random() < 0.3) { const viz = G.prov[e.prov].viz.filter(v => G.prov[v].dono !== 'jogador'); if (viz.length) ordem(e.id, viz[Math.floor(Math.random() * viz.length)], e.s.length, 'ataque'); }
          continue;
        }
        // ---- esperto ----
        const amea = ameaca(cap, 'jogador'), defCap = defesaEm(cap);
        // recruta (capital primeiro se ameaçada)
        const cidades = minhas().filter(ehCidade).sort((a, z) => (z === cap) - (a === cap));
        for (let k = 0; k < 3; k++) { if (f.moedas < custoRecrutar('jogador') + 12) break; recrutar((amea > defCap * 0.8 ? cap : cidades[k % cidades.length]).id); }
        if (amea > defCap && f.moedas >= C.FORTIFICAR && cap.trinch < 100) fortificar(cap.id);
        // defesa da capital: chama tropa vizinha
        if (amea > defCap * 0.9) exDe('jogador').filter(e => parado(e) && e.prov !== cap.id && cap.viz.includes(e.prov)).forEach(e => ordem(e.id, cap.id, e.s.length, 'mover'));
        // ataques
        exDe('jogador').filter(e => parado(e) && e.s.length >= 3).forEach(e => {
          const casa = G.prov[e.prov];
          const maior = Math.max(0, ...G.ex.filter(x => x.dono !== 'jogador' && x.dono !== 'neutro' && (casa.viz.includes(x.prov) || x.rota.includes(casa.id))).map(x => forca(x.s)));
          const ficar = casa === cap ? Math.max(4, Math.ceil(maior * 0.75)) : Math.max(1, Math.ceil(maior * 0.7 / (1 + casa.trinch / 250)));
          const manda = e.s.length - ficar; if (manda < 2) return;
          const env = vivos(e.s).sort((a, z) => eficacia(z) - eficacia(a)).slice(0, manda);
          const alvos = casa.viz.map(id => G.prov[id]).filter(q => q.dono !== 'jogador' && !G.ex.some(x => x.dono === 'jogador' && x.rota.includes(q.id)));
          const avaliados = alvos.map(q => ({ q, def: provVisivel(q.id) ? defesaEm(q) : null }));
          const desconhecido = avaliados.find(a => a.def === null);
          if (desconhecido && f.moedas >= C.ESPIAO + 10) espionar(desconhecido.q.id);
          const margem = f.moedas >= C.ARTILHARIA ? 0.9 : 1.3;
          const boa = avaliados.filter(a => a.def !== null && forca(env) > a.def * margem).sort((a, z) => (z.q.capital - a.q.capital) || (a.def - z.def))[0];
          if (boa) ordem(e.id, boa.q.id, manda, 'ataque');
        });
        // tropas paradas em retaguarda (sem vizinho inimigo) vão para a frente
        exDe('jogador').filter(e => parado(e) && G.prov[e.prov].viz.every(v => G.prov[v].dono === 'jogador') && e.s.length >= (e.prov === cap.id ? 7 : 2)).forEach(e => {
          const frente = minhas().filter(q => q.viz.some(v => G.prov[v].dono !== 'jogador')).map(q => ({ q, c: caminho(e.prov, q.id) })).filter(o => o.c).sort((a, z) => a.c.dist - z.c.dist)[0];
          if (frente) ordem(e.id, frente.q.id, e.prov === cap.id ? e.s.length - 4 : e.s.length, 'mover');
        });
      }
      const pl = placar();
      Object.values(G.fac).forEach(x => { if (!(x.comida >= 0 && x.mun >= 0 && x.moedas >= 0)) travou = 'recurso inválido'; });
      res.push({ fim: G.fim, t: Math.round(G.t), minhas: pl.jogador || 0, total: Object.keys(G.prov).length, ataquesBot: est.ataquesBot, contraMim: est.contraMim });
      ordem = ord;
    }
    return { res, travou };
}

(async () => {
    const falhas = [], info = {};
    const b = await chromium.launch();

    // 1) Tela inicial de modos no jogo
    {
        const p = await b.newPage({ viewport: { width: 360, height: 760 } });
        const erros = []; p.on('pageerror', e => erros.push(e.message));
        await p.goto(JOGO, { waitUntil: 'load' });
        await p.waitForTimeout(300);
        const r = await p.evaluate(() => ({
            visivel: !document.getElementById('tela-modos').classList.contains('hidden'),
            botoes: [...document.querySelectorAll('#tela-modos button, #tela-modos a')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
            links: [...document.querySelectorAll('#tela-modos a')].map(a => a.getAttribute('href')),
            menuAberto
        }));
        const t0 = await p.evaluate(() => { const t = gameState.timeSeconds; for (let i = 0; i < 20; i++) updateGameTick(); return gameState.timeSeconds - t; });
        await p.click('#modo-trincheiras');
        const depois = await p.evaluate(() => ({ menuAberto, escondida: document.getElementById('tela-modos').classList.contains('hidden') }));
        if (!r.visivel || !r.menuAberto) falhas.push('a tela de modos não aparece ao abrir o jogo');
        if (!(r.botoes.some(t => t.startsWith('🪖 Trincheiras')) && r.botoes.some(t => t.includes('Trincheiras online')) && r.botoes.some(t => t.includes('Conquista')))) falhas.push('faltam modos: ' + JSON.stringify(r.botoes));
        if (!r.links.includes('duelo.html') || !r.links.includes('conquista.html')) falhas.push('links dos modos errados: ' + r.links);
        if (t0 !== 0) falhas.push('o relógio andou com a tela de modos aberta');
        if (depois.menuAberto || !depois.escondida) falhas.push('escolher Trincheiras não fecha a tela de modos');
        if (erros.length) falhas.push('erros no jogo: ' + erros[0]);
        await p.close();
    }

    const ctx = await b.newContext({ viewport: { width: 360, height: 760 }, hasTouch: true });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    await p.goto(CONQ, { waitUntil: 'load' });
    await p.waitForTimeout(400);

    // 2) Mapas das 3 fases
    info.mapas = await p.evaluate(() => FASES.map(F => {
        novoJogo(F.n);
        const ps = Object.values(G.prov), ids = ps.map(q => q.id);
        const vis = new Set([ids[0]]), fila = [ids[0]];
        while (fila.length) { const a = fila.pop(); G.prov[a].viz.forEach(v => { if (!vis.has(v)) { vis.add(v); fila.push(v); } }); }
        return {
            fase: F.n, provincias: ps.length, ligado: vis.size === ps.length,
            vizinhosDosDoisLados: ps.every(q => q.viz.every(v => G.prov[v].viz.includes(q.id))),
            nomesUnicos: new Set(ps.map(q => q.nome)).size === ps.length,
            capitais: ps.filter(q => q.capital).length, capitaisComSaida: ps.filter(q => q.capital).every(q => q.viz.length >= 3),
            dentroDoMundo: ps.every(q => q.poli.every(pt => pt.x >= 0 && pt.y >= 0 && pt.x <= MAPA.W && pt.y <= MAPA.H))
        };
    }));
    info.mapas.forEach((m, k) => {
        const minimo = [20, 30, 40][k];
        if (m.provincias < minimo) falhas.push(`fase ${m.fase}: mapa pequeno (${m.provincias} províncias)`);
        ['ligado', 'vizinhosDosDoisLados', 'nomesUnicos', 'capitaisComSaida', 'dentroDoMundo'].forEach(c => { if (!m[c]) falhas.push(`fase ${m.fase}: ${c}`); });
        if (m.capitais !== FASES_BOTS[k] + 1) falhas.push(`fase ${m.fase}: ${m.capitais} capitais`);
    });

    // 3) Jogando pela tela
    await p.reload({ waitUntil: 'load' });
    await p.evaluate(() => { try { localStorage.removeItem('frontline-conquista-fase'); } catch (e) {} mostrarInicio(); });
    const trancadas = await p.$$eval('button.fase', bs => bs.map(x => x.disabled));
    if (JSON.stringify(trancadas) !== '[false,true,true]') falhas.push('fases 2 e 3 deveriam começar trancadas: ' + trancadas);
    await p.click('button.fase');
    await p.waitForTimeout(400);
    const caixa = await p.$eval('#mapa', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; });
    const naTela = (wx, wy) => p.evaluate(([x, y]) => paraTela(x, y), [wx, wy]);
    const ck = {};
    const cap = await p.evaluate(() => { const c = G.prov[G.capitalJogador]; const e = exParadosEm(c.id, 'jogador')[0]; return { x: e.x, y: e.y, n: e.s.length, viz: c.viz }; });
    let s = await naTela(cap.x, cap.y);
    await p.mouse.click(caixa.x + s.x, caixa.y + s.y + 6);
    ck.tocaNoExercito = await p.evaluate(() => !!G.sel && G.sel.tipo === 'ex');
    await p.click('#painel button:has-text("Mover /")');
    const alvo = await p.evaluate((viz) => { const q = viz.map(id => G.prov[id]).find(q => q.dono !== 'jogador'); return { id: q.id, x: q.x, y: q.y }; }, cap.viz);
    s = await naTela(alvo.x, alvo.y + 25);
    await p.mouse.click(caixa.x + s.x, caixa.y + s.y);
    ck.escolheDestino = await p.evaluate((id) => !!G.pendente && G.pendente.destId === id, alvo.id);
    await p.click('#painel .passo >> nth=0'); await p.click('#painel .passo >> nth=0');
    await p.click('#painel button:has-text("Confirmar")');
    ck.mandaSoQuemEscolheu = await p.evaluate((n) => { const m = exDe('jogador').find(e => e.rota.length); const fica = exDe('jogador').find(e => !e.rota.length && e.prov === G.capitalJogador); return !!m && !!fica && m.s.length === n - 2 && fica.s.length === 2; }, cap.n);
    // espião: viaja, revela e nunca abre batalha nem mata ninguém
    const longe = await p.evaluate(() => { const c = G.prov[G.capitalJogador]; const q = Object.values(G.prov).filter(q => q.dono !== 'jogador').sort((a, b) => Math.hypot(b.x - c.x, b.y - c.y) - Math.hypot(a.x - c.x, a.y - c.y))[0]; G.sel = { tipo: 'prov', id: q.id }; renderPainel(); return q.id; });
    ck.longeNaNevoa = await p.evaluate((id) => !provVisivel(id), longe);
    await p.click('#painel button:has-text("Espião")');
    ck.espiaoSai = await p.evaluate(() => G.espioes.length === 1);
    ck.espiaoNaoLuta = await p.evaluate((id) => {
        const vidas = () => G.ex.filter(e => e.prov === id).flatMap(e => e.s).reduce((t, x) => t + x.vida, 0);
        const antes = vidas(); const cb = criarBatalha; let batalhaDoEspiao = false;
        criarBatalha = (e, q, d) => { if (q.id === id && e.dono === 'jogador') batalhaDoEspiao = true; return cb(e, q, d); };
        G.ex.filter(e => e.dono === 'jogador').forEach(e => { e.rota = []; }); // só o espião se mexe
        Object.keys(G.pensar).forEach(k => { G.pensar[k] = 1e9; });
        for (let i = 0; i < 600 && G.espioes.length; i++) passoMapa(0.25);
        criarBatalha = cb;
        return !batalhaDoEspiao && Math.abs(vidas() - antes) < 1e-6 && G.espioes.length === 0;
    }, longe);
    ck.espiaoRevela = await p.evaluate((id) => provVisivel(id) && !!G.ultimoRelatorio, longe);
    // arrastar e zoom
    const c0 = await p.evaluate(() => ({ ...cam }));
    await p.mouse.move(caixa.x + 180, caixa.y + 300); await p.mouse.down(); await p.mouse.move(caixa.x + 100, caixa.y + 220, { steps: 6 }); await p.mouse.up();
    const c1 = await p.evaluate(() => ({ ...cam }));
    ck.arrasta = Math.abs(c1.x - c0.x) + Math.abs(c1.y - c0.y) > 20;
    await p.click('#zoom button >> nth=1');
    ck.zoom = await p.evaluate((z) => cam.z < z, c1.z);
    ck.semRolagemLateral = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    // mover livre pelo seu território, mudar o rumo em marcha e recrutar em qualquer província
    Object.assign(ck, await p.evaluate(() => {
        novoJogo(1); Object.keys(G.pensar).forEach(k => { G.pensar[k] = 1e9; });
        const r = {}, cap = G.prov[G.capitalJogador];
        const anel = [...new Set(cap.viz.flatMap(v => [v, ...G.prov[v].viz]))].filter(id => id !== cap.id).slice(0, 6);
        anel.forEach(id => { const q = G.prov[id]; if (q.capital) return; G.ex = G.ex.filter(e => !(e.prov === id && e.dono !== 'jogador')); q.dono = 'jogador'; });
        const campo = minhas().find(q => !ehCidade(q));
        G.fac.jogador.moedas = 500;
        r.recrutaEmQualquerProvincia = recrutar(campo.id) === 1 && recrutar(campo.id, 5) === 5;
        const e = exParadosEm(cap.id, 'jogador')[0];
        const longe = minhas().filter(q => q !== cap).sort((a, z) => Math.hypot(z.x - cap.x, z.y - cap.y) - Math.hypot(a.x - cap.x, a.y - cap.y))[0];
        const m = ordem(e.id, longe.id, 3, 'mover');
        r.moveSoPeloSeuTerritorio = !!m && m.rota.every(id => G.prov[id].dono === 'jogador');
        for (let i = 0; i < 6; i++) passoMapa(0.5);
        const outro = minhas().find(q => q !== longe && q !== cap && q.id !== m.rota[0]);
        r.mudaORumoEmMarcha = ordem(m.id, outro.id, 0, 'mover') === m && m.rota[m.rota.length - 1] === outro.id;
        for (let i = 0; i < 400 && m.rota.length; i++) passoMapa(0.5);
        r.chegaNoNovoDestino = exParadosEm(outro.id, 'jogador').some(x => x.s.length >= 3);
        // batalha: ninguém passa da trincheira
        const q = Object.values(G.prov).find(x => x.dono === 'neutro' && exParadosEm(x.id, 'neutro').length);
        const ex = criarExercito('jogador', q.viz[0], 8); const bt = criarBatalha(ex, q, exParadosEm(q.id, 'neutro'));
        let menor = Infinity; for (let i = 0; i < 600 && !bt.terminou; i++) { bt.passo(0.25); bt.atq.forEach(a => { menor = Math.min(menor, a.dist); }); }
        r.ninguemPassaDaTrincheira = menor >= 0;
        G.ex = G.ex.filter(x => x !== ex);
        return r;
    }));
    Object.entries(ck).forEach(([k, v]) => { if (!v) falhas.push('tela: ' + k); });
    info.tela = ck;

    // 3b) Salvamento e pausa: joga, recarrega a página, continua igual; pausa no mapa e na batalha
    {
        const q = await ctx.newPage(); const errosS = []; q.on('pageerror', e => errosS.push(e.message));
        await q.goto(CONQ, { waitUntil: 'load' });
        await q.evaluate(() => localStorage.clear()); await q.reload({ waitUntil: 'load' });
        const sv = { semContinuarSemSalvamento: !(await q.$('button:has-text("CONTINUAR")')) };
        await q.click('button.fase');
        const antes = await q.evaluate(() => {
            Object.keys(G.pensar).forEach(k => { G.pensar[k] = 40; });
            for (let i = 0; i < 360; i++) { passoMapa(0.5); if (G.batalha) { const bt = G.batalha; while (!bt.terminou) bt.passo(0.25); fecharBatalha(); } }
            salvarPartida();
            return JSON.stringify({ t: Math.round(G.t), donos: Object.values(G.prov).map(x => x.dono), tropa: tropaDe('jogador'), ex: G.ex.length, moedas: Math.floor(G.fac.jogador.moedas) });
        });
        await q.reload({ waitUntil: 'load' });
        sv.mostraContinuar = !!(await q.$('button:has-text("CONTINUAR")'));
        await q.click('button:has-text("CONTINUAR")');
        const depois = await q.evaluate(() => JSON.stringify({ t: Math.round(G.t), donos: Object.values(G.prov).map(x => x.dono), tropa: tropaDe('jogador'), ex: G.ex.length, moedas: Math.floor(G.fac.jogador.moedas) }));
        sv.voltaIgual = antes === depois;
        sv.voltaPausado = await q.evaluate(() => G.pausado === true);
        const t1 = await q.evaluate(() => G.t); await q.waitForTimeout(800);
        sv.pausaParaOTempo = await q.evaluate((t) => G.t === t, t1);
        sv.daOrdemPausado = await q.evaluate(() => { const e = exDe('jogador').find(x => parado(x) && x.s.length >= 2); return !e || !!ordem(e.id, G.prov[e.prov].viz[0], 1, 'mover'); });
        await q.click('#bPausa'); await q.waitForTimeout(800);
        sv.despausaAnda = await q.evaluate((t) => G.t > t, t1);
        await q.evaluate(() => { const c = G.prov[G.capitalJogador]; const ex = criarExercito('jogador', c.id, 6); const m = Object.values(G.prov).find(x => x.dono === 'neutro' && exParadosEm(x.id, 'neutro').length); abrirBatalha(criarBatalha(ex, m, exParadosEm(m.id, 'neutro'))); });
        await q.waitForTimeout(300); await q.click('#bPausaBat');
        const b1 = await q.evaluate(() => G.batalha.t); await q.waitForTimeout(600);
        sv.pausaNaBatalha = await q.evaluate((t) => G.batalha.t === t, b1);
        await q.click('#bPausaBat');
        sv.fimApagaSalvamento = await q.evaluate(() => { document.getElementById('batalha').style.display = 'none'; G.batalha = null; G.t = G.fase.tempo; passoMapa(0.1); return !!G.fim && !lerSalvamento(); });
        Object.entries(sv).forEach(([k, v]) => { if (!v) falhas.push('salvar/pausar: ' + k); });
        if (errosS.length) falhas.push('erros no salvamento: ' + errosS[0]);
        info.salvarPausar = sv;
        await q.close();
    }

    // 3c) Som: música do mapa e da batalha, tiros, explosão e o botão de desligar (lembrado no aparelho)
    {
        const bs = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
        const q = await bs.newPage({ viewport: { width: 360, height: 760 } }); const errosSom = []; q.on('pageerror', e => errosSom.push(e.message));
        await q.goto(CONQ, { waitUntil: 'load' }); await q.evaluate(() => localStorage.clear()); await q.reload({ waitUntil: 'load' });
        await q.click('button.fase'); await q.waitForTimeout(600);
        const so = {};
        so.musicaDoMapa = await q.evaluate(() => SOM.ctx && SOM.ctx.state === 'running' && SOM.faixa === 'mapa' && !SOM.mapa.paused);
        await q.evaluate(() => { window._ef = {}; const o = som; som = (t, f) => { window._ef[t] = (window._ef[t] || 0) + 1; return o(t, f); };
            const c = G.prov[G.capitalJogador]; const ex = criarExercito('jogador', c.id, 8); const m = Object.values(G.prov).find(x => x.dono === 'neutro' && exParadosEm(x.id, 'neutro').length);
            G.fac.jogador.moedas = 100; abrirBatalha(criarBatalha(ex, m, exParadosEm(m.id, 'neutro'))); });
        await q.waitForTimeout(300);
        so.musicaDaBatalha = await q.evaluate(() => SOM.faixa === 'batalha' && !SOM.batalha.paused && SOM.mapa.paused);
        await q.click('#bArt'); await q.click('#bVel'); await q.waitForTimeout(4000);
        so.tirosEExplosao = await q.evaluate(() => (window._ef.tiro || 0) > 3 && window._ef.explosao >= 1);
        await q.click('#bPausaBat'); await q.evaluate(() => { const bt = G.batalha; G.pausado = false; while (!bt.terminou) bt.passo(0.25); });
        await q.waitForTimeout(2400);
        so.voltaMusicaDoMapa = await q.evaluate(() => !G.batalha && SOM.faixa === 'mapa' && !SOM.mapa.paused);
        await q.click('#bSom');
        so.desliga = await q.evaluate(() => !SOM.ligado && SOM.mapa.paused && SOM.batalha.paused);
        await q.reload({ waitUntil: 'load' });
        so.lembraDesligado = await q.evaluate(() => !SOM.ligado && document.getElementById('bSom').textContent === '🔇');
        Object.entries(so).forEach(([k, v]) => { if (!v) falhas.push('som: ' + k); });
        if (errosSom.length) falhas.push('erros no som: ' + errosSom[0]);
        info.som = so;
        await bs.close();
    }

    // 4) Fases inteiras sem tela
    const rodadas = [[1, 'esperto', 8], [1, 'ingenuo', 6], [2, 'esperto', 2], [3, 'esperto', 2]];
    info.fases = {};
    for (const [FASE, EST, N] of rodadas) {
        const r = await p.evaluate(jogar, { N, FASE, EST });
        if (r.travou) falhas.push(`fase ${FASE} ${EST}: ${r.travou === true ? 'travou' : r.travou}`);
        const cont = {}; r.res.forEach(x => { cont[x.fim] = (cont[x.fim] || 0) + 1; });
        const venceu = r.res.filter(x => x.fim === 'vitoria' || x.fim === 'pontos').length;
        info.fases[`fase${FASE}-${EST}`] = { resultados: cont, venceu: `${venceu}/${N}`, provinciasNoFim: +(r.res.reduce((t, x) => t + x.minhas, 0) / N).toFixed(1), ataquesDosBots: +(r.res.reduce((t, x) => t + x.ataquesBot, 0) / N).toFixed(1) };
        if (FASE === 1 && EST === 'esperto' && venceu < 2) falhas.push('quem joga bem quase nunca vence a fase 1: ' + JSON.stringify(cont));
        if (FASE === 1 && EST === 'ingenuo' && venceu > N / 2) falhas.push('quem joga mal vence demais: ' + JSON.stringify(cont));
        if (r.res.some(x => !x.fim)) falhas.push(`fase ${FASE}: partida sem fim`);
        if (r.res.every(x => x.ataquesBot < 3)) falhas.push(`fase ${FASE}: os bots quase não atacam`);
    }
    if (erros.length) falhas.push('erros na Conquista: ' + erros[0]);
    await b.close();

    console.log(JSON.stringify(info, null, 1));
    if (falhas.length) { console.log('FALHAS: ' + JSON.stringify(falhas)); process.exit(1); }
    console.log('Conquista e tela de modos: todas as verificações passaram, sem erros de JavaScript.');
})();
const FASES_BOTS = [3, 4, 4];
