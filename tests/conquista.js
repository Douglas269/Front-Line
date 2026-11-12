// Teste do modo Conquista e da tela inicial de modos
// Uso: node tests/conquista.js
// 1) a tela inicial do jogo mostra os 3 modos e pausa o relógio até escolher;
// 2) a página da Conquista abre sem erros;
// 3) muitas fases jogadas sem tela por um jogador automático: quem joga bem vence uma parte,
//    quem joga mal perde; os bots atacam você e uns aos outros; nada quebra.
const path = require('path');
const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..', 'prototipo');
const JOGO = 'file://' + path.join(RAIZ, 'ponto-alpha.html');
const CONQ = 'file://' + path.join(RAIZ, 'conquista.html');
const N = +(process.argv[2] || 24);

// Jogador automático (roda dentro da página). 'esperto' espiona, guarda a casa, reforça e usa artilharia;
// 'ingenuo' ataca com quase tudo sem olhar.
function jogarFases({ N, estrategia }) {
    esconderTela(); laco = () => {};
    const res = [];
    for (let j = 0; j < N; j++) {
        novoJogo();
        let botVsBot = 0, contraVoce = 0, pensa = 0;
        while (!G.fim) {
            passoMapa(0.5);
            if (G.batalha) {
                const bt = G.batalha;
                if (bt.souAtq) { bt.postAtq = 'avancar'; if (estrategia === 'esperto') artilhariaNaBatalha(bt, 'atq'); } else bt.postDef = 'equilibrio';
                while (!bt.terminou) bt.passo(0.25);
                fecharBatalha();
            }
            G.marchas.forEach(m => {
                if (m.contado) return; m.contado = true;
                if (m.dono !== 'jogador' && G.prov[m.para].dono === 'jogador') contraVoce++;
                if (m.dono !== 'jogador' && G.prov[m.para].dono !== 'jogador' && G.prov[m.para].dono !== m.dono) botVsBot++;
            });
            if ((pensa -= 0.5) > 0) continue; pensa = 4;
            const f = G.fac.jogador;
            minhas().forEach(q => { if (f.moedas >= custoRecrutar('jogador') + (estrategia === 'esperto' ? 15 : 0) && vivosDe(q).length < 12) recrutar(q.id); });
            if (G.marchas.filter(m => m.dono === 'jogador').length >= 2) continue;
            const fronteira = Object.values(G.prov).filter(q => q.dono !== 'jogador' && minhas().some(mi => mi.viz.includes(q.id)));
            if (!fronteira.length) continue;
            if (estrategia === 'esperto') {
                const base = G.prov.alfa;
                const fraca = minhas().filter(q => !q.qg && (vivosDe(q).length < 4 || q.viz.some(v => G.prov[v].dono !== 'jogador')) && vivosDe(q).length < 12)[0];
                if (fraca && vivosDe(base).length > 6 && base.viz.includes(fraca.id)) { enviar('alfa', fraca.id, vivosDe(base).length - 6, 'ataque'); continue; }
                const alvo = fronteira.sort((a, c) => forca(vivosDe(a)) - forca(vivosDe(c)))[0];
                if (!(G.espiado[alvo.dono] > G.t) && f.moedas >= C.ESPIAO) espionar(alvo.id);
                const origem = minhas().filter(mi => mi.viz.includes(alvo.id) && !G.marchas.some(m => m.de === mi.id)).sort((a, c) => vivosDe(c).length - vivosDe(a).length)[0];
                if (!origem || G.marchas.some(m => m.para === alvo.id && m.dono === 'jogador')) continue;
                const brigando = G.marchas.some(m => m.dono === alvo.dono && m.de === alvo.id) || vivosDe(alvo).length <= 4;
                const meus = vivosDe(origem).slice(0, Math.max(0, vivosDe(origem).length - (origem.qg ? 5 : 3)));
                const margem = f.moedas >= C.ARTILHARIA ? 0.8 : brigando ? 1.15 : 1.5;
                if (meus.length >= 3 && G.espiado[alvo.dono] > G.t && forca(meus) > forca(vivosDe(alvo)) * margem) enviar(origem.id, alvo.id, meus.length, 'ataque');
                else if (f.moedas < 30 && meus.length >= 2 && Math.random() < 0.15) enviar(origem.id, alvo.id, C.SAQUE_TROPA, 'saque');
            } else {
                const alvo = fronteira[Math.floor(Math.random() * fronteira.length)];
                const origem = minhas().filter(mi => mi.viz.includes(alvo.id))[0];
                if (vivosDe(origem).length >= 6 && Math.random() < 0.5) enviar(origem.id, alvo.id, vivosDe(origem).length - 1, 'ataque');
            }
            // nada pode ficar com número quebrado ou negativo
            Object.values(G.fac).forEach(x => { if (!(x.comida >= 0 && x.mun >= 0 && x.moedas >= 0)) throw new Error('recurso inválido ' + JSON.stringify(x)); });
        }
        res.push({ fim: G.fim, t: G.t, botVsBot, contraVoce });
    }
    return res;
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
        // relógio parado com a tela aberta
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

    // 2) Página da Conquista
    const p = await b.newPage({ viewport: { width: 360, height: 760 } });
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    await p.goto(CONQ, { waitUntil: 'load' });
    await p.waitForTimeout(500);
    const abre = await p.evaluate(() => ({ inicio: document.getElementById('tela').style.display === 'flex', texto: document.getElementById('telaCaixa').textContent, prov: Object.keys(G.prov).length, scrollX: document.documentElement.scrollWidth > innerWidth }));
    if (!abre.inicio || !abre.texto.includes('FASE 1')) falhas.push('a Conquista não mostra a tela de início');
    if (abre.prov !== 6) falhas.push('o mapa não tem 6 províncias');
    if (abre.scrollX) falhas.push('a Conquista tem rolagem para o lado no celular');
    // começa e deixa o tempo correr um pouco na tela de verdade
    await p.click('#telaCaixa button.grande');
    await p.waitForTimeout(1500);
    const anda = await p.evaluate(() => G.t);
    if (!(anda > 0.5)) falhas.push('o mapa da Conquista não anda depois de começar');

    // 3) Muitas fases sem tela
    const esp = await p.evaluate(jogarFases, { N, estrategia: 'esperto' });
    const ing = await p.evaluate(jogarFases, { N, estrategia: 'ingenuo' });
    const pct = (l, f) => Math.round(100 * l.filter(x => x.fim === f).length / l.length);
    const med = (l, k) => Math.round(l.reduce((s, x) => s + x[k], 0) / l.length);
    const vitEsp = esp.filter(x => x.fim === 'vitoria');
    info.esperto = { vitorias: pct(esp, 'vitoria') + '%', derrotas: pct(esp, 'derrota') + '%', tempoEsgotado: pct(esp, 'tempo') + '%', minutosParaVencer: vitEsp.length ? +(vitEsp.reduce((s, x) => s + x.t, 0) / vitEsp.length / 60).toFixed(1) : null };
    info.ingenuo = { vitorias: pct(ing, 'vitoria') + '%', derrotas: pct(ing, 'derrota') + '%' };
    info.ataquesPorFase = { botContraBot: med(esp.concat(ing), 'botVsBot'), botContraVoce: med(esp.concat(ing), 'contraVoce') };
    if (pct(esp, 'vitoria') < 15) falhas.push('quem joga bem quase nunca vence: ' + JSON.stringify(info.esperto));
    if (pct(esp, 'vitoria') > 85) falhas.push('fácil demais para quem joga bem: ' + JSON.stringify(info.esperto));
    if (pct(ing, 'vitoria') > 20) falhas.push('quem joga mal vence demais: ' + JSON.stringify(info.ingenuo));
    if (vitEsp.length && vitEsp.some(x => x.t > 900)) falhas.push('vitória depois do limite da fase');
    if (info.ataquesPorFase.botContraBot < 1) falhas.push('os bots não atacam uns aos outros');
    if (info.ataquesPorFase.botContraVoce < 1) falhas.push('os bots não atacam você');
    if (erros.length) falhas.push('erros na Conquista: ' + erros[0]);
    await b.close();

    console.log(JSON.stringify(info, null, 1));
    if (falhas.length) { console.log('FALHAS: ' + JSON.stringify(falhas)); process.exit(1); }
    console.log('Conquista e tela de modos: todas as verificações passaram, sem erros de JavaScript.');
})();
