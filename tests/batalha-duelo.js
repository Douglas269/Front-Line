// Conquista: a batalha como duelo (artilharia com aviso, abrigo, posturas e bots que reagem). Uso: node tests/batalha-duelo.js
const path = require('path');
const { chromium } = require('playwright');
const CONQ = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(CONQ); await p.evaluate(() => { localStorage.clear(); }); await p.goto(CONQ); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
        esconderTela(); laco = () => {};
        const o = {};
        const mk = (nA, nD, trinch, defDono = 'neutro', fase = 1) => {
            novoJogo(fase); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; });
            const q = Object.values(G.prov).find(x => x.dono === 'neutro' && !x.capital); G.ex = G.ex.filter(e => e.prov !== q.id); q.trinch = trinch; q.obras = {}; q.dono = defDono;
            const d = criarExercito(defDono, q.id, 0, Array.from({ length: nD }, () => soldado('d'))), a = criarExercito('jogador', q.viz[0], 0, Array.from({ length: nA }, () => soldado('a')));
            G.fac.jogador.mun = 500; const bt = abrirBatalha(a, q, [d]); bt.audivel = false; return bt;
        };
        const vida = (l) => l.reduce((t, x) => t + x.s.vida, 0);
        // 1) a artilharia avisa antes de cair e gasta a munição na hora; só uma vez por lado
        let bt = mk(8, 6, 40); const v0 = vida(bt.def); o.disparou = artilhariaNaBatalha(bt, 'atq'); o.mun = G.fac.jogador.mun; o.segunda = artilhariaNaBatalha(bt, 'atq');
        o.antesDeCair = vida(bt.def) === v0 && artACaminho(bt, 'def');
        // 2) o abrigo segura a artilharia
        const queda = (post) => { const x = mk(8, 10, 0); x.postDef = post; artilhariaNaBatalha(x, 'atq'); const a0 = vida(x.def); x.t += BAT_ART.AVISO + 0.01; quedaDaArtilharia(x); return (a0 - vida(x.def)) / 10; };
        o.aberto = queda('equilibrio'); o.abrigado = queda('abrigar');
        // 3) o peso das escolhas: taxa de vitória do atacante (8 contra 6, trincheira 40)
        const taxa = (conf, N = 500, passo = () => {}) => { let v = 0; for (let k = 0; k < N; k++) { const x = mk(8, 6, 40); conf(x); let g = 0; while (!x.terminou && g++ < 5000) { passoBatalha(x, 0.2); passo(x); } if (x.vencedor === 'atq') v++; G.batalhas = []; } return Math.round(100 * v / N); };
        o.base = taxa(() => {}); o.comArt = taxa(x => artilhariaNaBatalha(x, 'atq'));
        o.artContraAbrigo = taxa(x => { x.postDef = 'abrigar'; artilhariaNaBatalha(x, 'atq'); }, 500, x => { if (x.art.atq.cai === null) x.postDef = 'equilibrio'; }); // abriga só enquanto o projétil está no ar
        o.abrigoSemAssalto = taxa(x => { x.postDef = 'abrigar'; x.postAtq = 'cobertura'; }, 2000);
        o.abrigoComAssalto = taxa(x => { x.postDef = 'abrigar'; x.postAtq = 'avancar'; }, 2000);
        // 4) o bot defensor reage ao aviso se abrigando (na maioria das vezes) e também usa a própria artilharia
        const bot = 'bravo'; let abrigos = 0, atirou = 0, N = 200;
        for (let k = 0; k < N; k++) { const x = mk(10, 8, 40, bot, 3); G.pensar[bot] = 1e9; G.fac[bot].mun = 500; artilhariaNaBatalha(x, 'atq'); let foi = false, g = 0; while (!x.terminou && g++ < 3000) { passoBatalha(x, 0.2); if (x.art.atq.cai !== null && x.postDef === 'abrigar') foi = true; } if (foi) abrigos++; if (x.art.def && x.art.def.usada) atirou++; G.batalhas = []; }
        o.botAbriga = Math.round(100 * abrigos / N); o.botAtira = Math.round(100 * atirou / N);
        // 5) milícia não usa tática
        bt = mk(8, 6, 40); for (let i = 0; i < 40; i++) passoBatalha(bt, 0.2); o.milicia = bt.postDef === 'equilibrio' && !(bt.art && bt.art.def && bt.art.def.usada);
        // 6) artilharia no ar sobrevive ao recarregar
        bt = mk(8, 8, 40); artilhariaNaBatalha(bt, 'atq'); G.semSalvar = false; salvarPartida(); carregarPartida(); const volta = G.batalhas[0]; o.salvaArt = !!volta && !!volta.art && volta.art.atq.usada && volta.art.atq.cai !== null; apagarSalvamento();
        // 7) a tela avisa quem está sob a artilharia
        bt = mk(8, 6, 40, bot); artilhariaNaBatalha(bt, 'def'); G.fac[bot].mun = 500; bt.art = {}; artilhariaNaBatalha(bt, 'def'); o.aviso = /ARTILHARIA A CAMINHO/.test(painelBatalha(bt));
        return o;
    });
    const ck = (c, m) => { if (!c) falhas.push(m); };
    ck(r.disparou && r.mun === 460 && !r.segunda && r.antesDeCair, 'a artilharia gasta munição, avisa antes de cair e só vale uma vez: ' + JSON.stringify(r));
    ck(r.aberto > 25 && r.abrigado < r.aberto * 0.4, `abrigo segura a artilharia (${r.aberto} x ${r.abrigado})`);
    ck(r.comArt > r.base + 25 && r.comArt < 88, `artilharia forte, mas não decide sozinha (${r.base}% -> ${r.comArt}%)`);
    ck(r.artContraAbrigo < r.comArt - 25, `abrigar tem que anular boa parte da artilharia (${r.comArt}% x ${r.artContraAbrigo}%)`);
    ck(r.abrigoComAssalto > r.abrigoSemAssalto + 8, `avançar tem que ser a resposta a quem se abriga (${r.abrigoComAssalto}% x ${r.abrigoSemAssalto}%)`);
    ck(r.botAbriga >= 40 && r.botAbriga <= 90, `o bot se abriga na maioria das vezes, não sempre: ${r.botAbriga}%`);
    ck(r.botAtira >= 15, `o bot usa artilharia: ${r.botAtira}%`);
    ck(r.milicia, 'a milícia não usa tática');
    ck(r.salvaArt, 'artilharia no ar sobrevive ao recarregar');
    ck(r.aviso, 'o painel avisa que a artilharia está vindo');
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log((falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Batalha como duelo: aviso, abrigo, assalto e bots funcionam. ') + JSON.stringify(r));
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
