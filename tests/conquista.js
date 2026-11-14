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
        const minimo = [20, 20, 30, 30, 35, 40][k];
        if (m.provincias < minimo) falhas.push(`fase ${m.fase}: mapa pequeno (${m.provincias} províncias)`);
        ['ligado', 'vizinhosDosDoisLados', 'nomesUnicos', 'capitaisComSaida', 'dentroDoMundo'].forEach(c => { if (!m[c]) falhas.push(`fase ${m.fase}: ${c}`); });
        if (m.capitais !== FASES_BOTS[k] + 1) falhas.push(`fase ${m.fase}: ${m.capitais} capitais`);
    });

    // 3) Jogando pela tela
    await p.reload({ waitUntil: 'load' });
    await p.evaluate(() => { try { localStorage.removeItem('frontline-conquista-fase'); localStorage.removeItem('frontline-conquista-meta'); } catch (e) {} mostrarInicio(); });
    const trancadas = await p.$$eval('button.fase', bs => bs.map(x => x.disabled));
    if (JSON.stringify(trancadas) !== '[false,true,true,true,true,true]') falhas.push('só a fase 1 deveria começar liberada: ' + trancadas);
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
            for (let i = 0; i < 360; i++) passoMapa(0.5);
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
        sv.fimApagaSalvamento = await q.evaluate(() => { G.t = G.fase.tempo; passoMapa(0.1); return !!G.fim && !lerSalvamento(); });
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
            Object.keys(G.pensar).forEach(k => { G.pensar[k] = 1e9; });
            const c = G.prov[G.capitalJogador], e = exParadosEm(c.id, 'jogador')[0], alvo = c.viz.map(id => G.prov[id]).find(x => x.dono === 'neutro' && exParadosEm(x.id, 'neutro').length);
            G.fac.jogador.moedas = 100; ordem(e.id, alvo.id, 6, 'ataque'); window._alvo = alvo.id;
            for (let i = 0; i < 400 && !G.batalhas.length; i++) passoMapa(0.25); });
        await q.waitForTimeout(400);
        so.musicaDaBatalha = await q.evaluate(() => G.batalhas.length > 0 && SOM.faixa === 'batalha' && !SOM.batalha.paused && SOM.mapa.paused);
        await q.evaluate(() => { acaoBatalha(window._alvo, 'art'); }); await q.waitForTimeout(3000);
        so.tirosEExplosao = await q.evaluate(() => (window._ef.tiro || 0) > 3 && window._ef.explosao >= 1);
        await q.evaluate(() => { for (let i = 0; i < 3000 && G.batalhas.length; i++) passoMapa(0.25); });
        await q.waitForTimeout(500);
        so.voltaMusicaDoMapa = await q.evaluate(() => !G.batalhas.length && SOM.faixa === 'mapa' && !SOM.mapa.paused);
        await q.click('#bSom');
        so.desliga = await q.evaluate(() => !SOM.ligado && SOM.mapa.paused && SOM.batalha.paused);
        await q.reload({ waitUntil: 'load' });
        so.lembraDesligado = await q.evaluate(() => !SOM.ligado && document.getElementById('bSom').textContent === '🔇');
        Object.entries(so).forEach(([k, v]) => { if (!v) falhas.push('som: ' + k); });
        if (errosSom.length) falhas.push('erros no som: ' + errosSom[0]);
        info.som = so;
        await bs.close();
    }

    // 3d0) Tropas no mapa: cada tipo tem figura e cor; inimigo pintado com a cor do país; etiquetas e legenda aparecem
    {
        const bs = await chromium.launch({ args: ['--allow-file-access-from-files'] }); // deixa ler os pixels dos desenhos
        const q = await bs.newPage({ viewport: { width: 390, height: 844 } }); const errosT = []; q.on('pageerror', e => errosT.push(e.message));
        await q.goto(CONQ, { waitUntil: 'load' }); await q.evaluate(() => localStorage.clear()); await q.reload({ waitUntil: 'load' });
        await q.click('button.fase'); await q.waitForFunction(() => IMG.mira.complete && IMG.mira.naturalWidth && IMG.andando.complete && IMG.andando.naturalWidth);
        const tp = await q.evaluate(() => {
            const r = {}; G.pausado = true;
            r.todosOsTiposTemDesenho = ['art', 'cav', 'blind', 'metr'].every(t => { const c = document.createElement('canvas'); c.width = 60; c.height = 60; const x = c.getContext('2d'); desenharTropaEspecial(x, t, 30, 45, '#e0533f', false, false); return x.getImageData(0, 0, 60, 60).data.some((v, i) => i % 4 === 3 && v > 0); });
            const f1 = figurasDoGrupo({ inf: 20, art: 1, cav: 1 }, 3), f2 = figurasDoGrupo({ inf: 5 }, 2), f3 = figurasDoGrupo(undefined, 1), f4 = figurasDoGrupo({ inf: 9, art: 1 }, 3);
            r.figurasMostramCadaTipo = f1.includes('inf') && f1.includes('art') && f1.includes('cav') && f4.includes('art') && JSON.stringify(f2) === '["inf","inf"]' && JSON.stringify(f3) === '["inf"]';
            const T = spriteTingido('mira', '#2060ff'), o = document.createElement('canvas'); o.width = T.width; o.height = T.height; o.getContext('2d').drawImage(IMG.mira, 0, 0);
            const azul = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { b += d[i + 2]; n++; } return b / Math.max(1, n); };
            r.inimigoPintadoDaCorDoPais = azul(T) > azul(o) + 10;
            // um exército com os 5 tipos na capital: as 5 cores aparecem no mapa (etiquetas + legenda)
            G.fac.jogador.moedas = 900; ['metr', 'art', 'cav', 'blind'].forEach(id => { G.pesq.jogador.feitas[id] = 1; });
            const c = G.capitalJogador; ['inf', 'metr', 'art', 'cav', 'blind'].forEach(t => recrutarEm(c, 'jogador', t));
            G.sel = { tipo: 'prov', id: c }; centralizar(G.prov[c].x, G.prov[c].y); desenharMapa();
            const cv = document.getElementById('mapa'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
            // legenda (topo, 12×12 por tipo) e etiquetas dos grupos (resto do mapa, 13×13 por tipo) contadas separadas
            const corte = 36 * (cv.width / cv.getBoundingClientRect().width), leg = {}, tag = {};
            TIPO_COR.forEach(([id, , hex]) => { const rr = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), bb = parseInt(hex.slice(5, 7), 16); let a = 0, b = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === rr && d[i + 1] === gg && d[i + 2] === bb) { if (Math.floor(i / 4 / cv.width) < corte) a++; else b++; } leg[id] = a; tag[id] = b; });
            r.legendaDosTiposNoTopo = Object.values(leg).every(n => n >= 60); r.etiquetasDosTiposNosGrupos = Object.entries(tag).every(([id, n]) => n >= (id === 'inf' ? 60 : 60)); r.contagemCores = { leg, tag };
            return r;
        });
        info.tropasNoMapa = tp;
        Object.entries(tp).forEach(([k, v]) => { if (v === false) falhas.push('tropas no mapa: ' + k); });
        if (errosT.length) falhas.push('erros nas tropas do mapa: ' + errosT[0]);
        await bs.close();
    }

    // 3d) Regras estratégicas: tipos de tropa, pesquisa, obras, moral/revolta, suprimento, diplomacia, generais e estrelas
    info.regras = await p.evaluate(() => {
        const r = {};
        const vence = (atq, def, n = 60) => { let v = 0; for (let k = 0; k < n; k++) { novoJogo(1); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; });
            const q = Object.values(G.prov).find(x => x.dono === 'neutro' && !x.capital); G.ex = G.ex.filter(e => e.prov !== q.id); q.trinch = 60;
            const d = criarExercito('neutro', q.id, 0, def.map(t => soldado('d', t))); const a = criarExercito('jogador', q.viz[0], 0, atq.map(t => soldado('a', t)));
            const bt = criarBatalha(a, q, [d]); while (!bt.terminou) bt.passo(0.25); if (bt.vencedor === 'atq') v++; } return v / n; };
        const rep = (t, n) => Array(n).fill(t);
        const infVsInf = vence(rep('inf', 9), rep('inf', 6)), infVsMetr = vence(rep('inf', 9), rep('metr', 6)), artVsMetr = vence(rep('art', 9), rep('metr', 6)), blindVsInf = vence(rep('blind', 4), rep('inf', 6));
        r.tropas = { infVsInf, infVsMetr, artVsMetr, blindVsInf };
        r.metralhadoraSegura = infVsMetr < infVsInf;
        r.artilhariaFuraMetralhadora = artVsMetr > infVsMetr + 0.2;
        r.blindadoAguentaFuzil = blindVsInf > 0.6;
        // pesquisa libera tropa
        novoJogo(1); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; }); G.fac.jogador.moedas = 500;
        const cap = G.prov[G.capitalJogador];
        r.semPesquisaNaoRecruta = !recrutarEm(cap.id, 'jogador', 'metr');
        pesquisar('metr'); for (let i = 0; i < 70; i++) passoMapa(0.5);
        r.pesquisaLibera = temPesq('jogador', 'metr') && recrutarEm(cap.id, 'jogador', 'metr');
        // obra: fábrica aumenta as moedas
        const antes = () => { const m0 = G.fac.jogador.moedas; cicloEconomia(); return G.fac.jogador.moedas - m0; };
        const sem = antes(); construir(cap.id, 'fabrica'); for (let i = 0; i < 100 && !cap.obras.fabrica; i++) passoMapa(0.5);
        r.fabricaProduzMais = cap.obras.fabrica && antes() > sem + 2;
        // moral: província longe, recém-conquistada e sem guarda se revolta
        const longe = Object.values(G.prov).filter(q => !q.capital && q.dono === 'neutro').sort((a, b) => Math.hypot(b.x - cap.x, b.y - cap.y) - Math.hypot(a.x - cap.x, a.y - cap.y))[0];
        G.ex = G.ex.filter(e => e.prov !== longe.id); conquistar(longe, 'jogador', null);
        let revoltou = false; for (let i = 0; i < 80 && !revoltou; i++) { cicloEconomia(); revoltou = longe.dono === 'neutro'; }
        r.revoltaSemGuarda = revoltou;
        // suprimento: longe do seu território a tropa não come
        const fora = Object.values(G.prov).find(q => !q.viz.some(v => G.prov[v].dono === 'jogador') && q.dono !== 'jogador');
        G.ex = G.ex.filter(e => e.prov !== fora.id); const ex = criarExercito('jogador', fora.id, 3); G.fac.jogador.comida = 500; const c0 = G.fac.jogador.comida;
        ex.s.forEach(s => { s.fome = 60; }); exDe('jogador').filter(x => x !== ex).forEach(x => x.s.forEach(s => { s.fome = 0; })); // só o exército isolado poderia comer
        cicloEconomia();
        r.semSuprimentoNaoCome = ex.semSuprimento && ex.s.every(s => s.fome > 60) && G.fac.jogador.comida >= c0 - 0.01;
        G.ex = G.ex.filter(e => e !== ex);
        // diplomacia: paz aceita; bot não ataca você; sua tropa passa sem lutar; guerra declarada volta a valer
        const bot = G.fase.bots[0], rnd = Math.random; Math.random = () => 0; propor(bot, 'paz'); Math.random = rnd;
        r.pazAceita = G.rel[bot].estado === 'paz' && !emGuerra('jogador', bot);
        const dele = provDe(bot).find(q => !q.capital) || provDe(bot)[0];
        const pass = criarExercito('jogador', dele.viz[0], 4); G.prov[dele.viz[0]].dono = 'jogador';
        const cb = criarBatalha; let lutou = false; criarBatalha = (...a) => { lutou = true; return cb(...a); };
        ordem(pass.id, dele.id, 4, 'ataque'); for (let i = 0; i < 200 && pass.rota.length; i++) passoMapa(0.25);
        criarBatalha = cb;
        r.pazSoPassa = !lutou && dele.dono === bot;
        declararGuerra(bot);
        r.guerraVoltaAValer = emGuerra('jogador', bot);
        // generais: bônus no exército e experiência ao vencer
        novoJogo(1); const e1 = exParadosEm(G.capitalJogador, 'jogador')[0];
        r.comecaComGeneral = !!e1.general && bonusGeneral(e1, 'atq') > 1;
        generalVenceu(e1); generalVenceu(e1); generalVenceu(e1);
        r.generalSobeDeNivel = nivelGeneral(G.genXp[e1.general]) === 2;
        // estrelas: vencer a fase 1 libera a fase 2 e guarda a experiência
        G.fim = 'vitoria'; G.t = 300; const est = calcularEstrelas(); guardarProgresso(est);
        r.estrelasGuardadas = est >= 2 && faseLiberada(2) && (lerMeta().generais[e1.general] || {}).xp === 3;
        G.fim = null;
        try { localStorage.removeItem('frontline-conquista-meta'); } catch (e) {}
        return r;
    });
    Object.entries(info.regras).forEach(([k, v]) => { if (v === false) falhas.push('regras: ' + k); });

    // 3e) Batalha no próprio mapa, configurações e menu principal
    {
        const q = await ctx.newPage(); const errosB = []; q.on('pageerror', e => errosB.push(e.message));
        await q.goto(CONQ, { waitUntil: 'load' }); await q.evaluate(() => localStorage.clear()); await q.reload({ waitUntil: 'load' });
        await q.click('button.fase');
        const bt = await q.evaluate(() => {
            const r = {}; Object.keys(G.pensar).forEach(k => { G.pensar[k] = 1e9; });
            const c = G.prov[G.capitalJogador], e = exParadosEm(c.id, 'jogador')[0], alvo = c.viz.map(id => G.prov[id]).find(x => x.dono === 'neutro');
            ordem(e.id, alvo.id, 6, 'ataque');
            for (let i = 0; i < 400 && !G.batalhas.length; i++) passoMapa(0.25);
            const b = G.batalhas[0];
            r.batalhaNoMapa = !!b && !document.getElementById('batalha'); // a tela de batalha separada não existe mais
            const t0 = G.t; passoMapa(1); r.mapaNaoPara = G.t > t0;
            G.sel = { tipo: 'prov', id: alvo.id }; renderPainel();
            r.painelMostraBatalha = /Batalha em/.test(document.getElementById('painel').textContent);
            G.fac.jogador.moedas = 100; acaoBatalha(alvo.id, 'cobertura'); acaoBatalha(alvo.id, 'art');
            r.ordensNaBatalha = b.postAtq === 'cobertura' && b.usouArt && G.fac.jogador.moedas === 100 - C.ARTILHARIA;
            G.pausado = true; const bt0 = b.t; r.pausaParaABatalha = (() => { /* com o mapa pausado o laço não chama passoMapa */ return true; })();
            G.pausado = false; acaoBatalha(alvo.id, 'avancar');
            for (let i = 0; i < 2000 && G.batalhas.length; i++) passoMapa(0.25);
            r.batalhaTerminaSozinha = !G.batalhas.length;
            r.exercitoNaoFicaPreso = !G.ex.some(x => x.emBatalha && !batalhaEm(x.prov) && !x.aguarda);
            return r;
        });
        // pausa de verdade: com o mapa pausado o laço não anda a batalha
        bt.pausaParaABatalha = await q.evaluate(async () => {
            Object.keys(G.pensar).forEach(k => { G.pensar[k] = 1e9; });
            const c = G.prov[G.capitalJogador], e = exParadosEm(c.id, 'jogador')[0];
            const alvo = Object.values(G.prov).find(x => x.dono === 'neutro' && exParadosEm(x.id, 'neutro').length);
            G.ex = G.ex.filter(x => x !== e); const ex = criarExercito('jogador', alvo.viz[0], 6); ex.x = alvo.x; ex.y = alvo.y; ex.prov = alvo.viz[0]; chegarAqui(Object.assign(ex, { prov: alvo.id }), alvo);
            const b = batalhaEm(alvo.id); if (!b) return false;
            G.pausado = true; const t0 = b.t; await new Promise(r => setTimeout(r, 600)); const parada = b.t === t0;
            G.pausado = false; await new Promise(r => setTimeout(r, 600)); return parada && b.t > t0;
        });
        // configurações
        await q.click('#bConfig');
        bt.configAbre = await q.evaluate(() => document.getElementById('configConq').style.display === 'flex' && G.pausado === true);
        await q.evaluate(() => { configConqAba = 'som'; renderConfigConq(); });
        await q.$eval('#configConq input[type=range]', el => { el.value = 20; el.dispatchEvent(new Event('input')); });
        bt.volumeSalvo = await q.evaluate(() => JSON.parse(localStorage.getItem('frontline-config')).volMusica === 20);
        await q.evaluate(() => { configConqAba = 'jogo'; renderConfigConq(); });
        await q.click('.cfgOpcao:has-text("Veterano")');
        bt.dificuldadeMudaOsBots = await q.evaluate(() => DIFC().vontade > 1 && JSON.parse(localStorage.getItem('frontline-config')).dificuldade === 'veterano');
        await q.click('.cfgLinha:has-text("Texto maior") button');
        bt.textoMaior = await q.evaluate(() => document.body.classList.contains('textoGrande'));
        bt.menuNasConfiguracoes = !!(await q.$('#configConq a.voltarMenu'));
        await q.evaluate(() => fecharConfigConq());
        bt.fecharVoltaOMapa = await q.evaluate(() => document.getElementById('configConq').style.display === 'none' && G.pausado === false);
        await q.evaluate(() => { localStorage.removeItem('frontline-config'); });
        Object.entries(bt).forEach(([k, v]) => { if (!v) falhas.push('mapa/config: ' + k); });
        if (errosB.length) falhas.push('erros na batalha/config: ' + errosB[0]);
        info.batalhaEConfig = bt;
        await q.close();
        // menu principal no Trincheiras e no duelo
        const t = await ctx.newPage();
        await t.goto(JOGO, { waitUntil: 'load' });
        const menuTrinch = await t.evaluate(() => { fecharMenuModos(); document.getElementById('btn-menu-topo').click(); return menuAberto && !document.getElementById('tela-modos').classList.contains('hidden'); });
        await t.goto('file://' + require('path').join(RAIZ, 'duelo.html'), { waitUntil: 'load' }); await t.waitForTimeout(1200);
        const menuDuelo = !!(await t.$('a.menuRodape'));
        if (!menuTrinch) falhas.push('menu: botão 🏠 do Trincheiras não abre os modos');
        if (!menuDuelo) falhas.push('menu: duelo sem botão de menu principal');
        info.menuPrincipal = { trincheiras: menuTrinch, duelo: menuDuelo };
        await t.close();
    }

    // 3b) perder uma capital CONQUISTADA não é perder a sua (nem elimina o bot que a tinha tomado)
    const capConq = await p.evaluate(() => {
        comecarFase(1);
        const capDe = (b) => Object.values(G.prov).find(q => q.capital && q.capitalDe === b);
        const cb = capDe('bravo'); conquistar(cb, 'jogador');   // você toma a capital do Bravo (Bravo cai)
        conquistar(cb, 'charlie');                               // Charlie toma ela de você
        const r1 = { fim: G.fim || null, minhaCapital: G.prov[G.capitalJogador].dono };
        const cd = capDe('delta'); conquistar(cd, 'charlie');     // Charlie toma a capital do Delta (Delta cai)
        conquistar(cd, 'jogador');                               // você toma ela de Charlie
        const r2 = { fim: G.fim || null, charlieVivo: !G.eliminados.charlie, deltaCaiu: !!G.eliminados.delta };
        return { r1, r2 };
    });
    info.capitalConquistada = capConq;
    if (capConq.r1.fim === 'derrota' || capConq.r1.minhaCapital !== 'jogador') falhas.push('perder uma capital conquistada contou como perder a sua: ' + JSON.stringify(capConq));
    if (!capConq.r2.charlieVivo || !capConq.r2.deltaCaiu || capConq.r2.fim) falhas.push('bot eliminado por perder uma capital conquistada: ' + JSON.stringify(capConq));

    // 4) Fases inteiras sem tela
    const rodadas = [[1, 'esperto', 6], [1, 'ingenuo', 5], [3, 'esperto', 2], [6, 'esperto', 2]];
    info.fases = {};
    for (const [FASE, EST, N] of rodadas) {
        const r = await p.evaluate(jogar, { N, FASE, EST });
        if (r.travou) falhas.push(`fase ${FASE} ${EST}: ${r.travou === true ? 'travou' : r.travou}`);
        const cont = {}; r.res.forEach(x => { cont[x.fim] = (cont[x.fim] || 0) + 1; });
        const venceu = r.res.filter(x => x.fim === 'vitoria' || x.fim === 'pontos').length;
        info.fases[`fase${FASE}-${EST}`] = { resultados: cont, venceu: `${venceu}/${N}`, provinciasNoFim: +(r.res.reduce((t, x) => t + x.minhas, 0) / N).toFixed(1), ataquesDosBots: +(r.res.reduce((t, x) => t + x.ataquesBot, 0) / N).toFixed(1) };
        if (FASE === 1 && EST === 'esperto' && venceu < 1) falhas.push('quem joga bem quase nunca vence a fase 1: ' + JSON.stringify(cont));
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
const FASES_BOTS = [3, 2, 4, 3, 4, 4];
