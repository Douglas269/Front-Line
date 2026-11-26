// Conquista: quem perde ou recua de uma batalha não pode sumir só porque a província de onde veio não é mais sua.
// Uso: node tests/recuo.js
const path = require('path');
const { chromium } = require('playwright');
const CONQ = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(CONQ); await p.evaluate(() => { localStorage.clear(); }); await p.goto(CONQ); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
        esconderTela(); laco = () => {};
        // monta: o jogador vem da província "origem" (vizinha do alvo) com 12 soldados, ataca e manda recuar.
        // prepara() muda os donos em volta antes de a batalha acabar.
        const rodar = (prepara) => {
            novoJogo(1); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; });
            const bot = G.fase.bots[0], cap = G.prov[G.capitalJogador];
            const alvo = Object.values(G.prov).find(q => !q.capital && q.dono === 'neutro' && !q.viz.includes(cap.id) && q.viz.filter(v => !G.prov[v].capital).length >= 2);
            const viz = alvo.viz.map(id => G.prov[id]).filter(q => !q.capital);
            const origem = viz[0], outra = viz[1];
            alvo.viz.map(id => G.prov[id]).forEach(q => { q.dono = bot; });
            origem.dono = 'jogador'; G.ex = G.ex.filter(e => e.prov !== alvo.id && !alvo.viz.includes(e.prov));
            criarExercito('neutro', alvo.id, 4);
            const e = criarExercito('jogador', origem.id, 12);
            e.de = origem.id; e.prov = alvo.id; e.x = alvo.x; e.y = alvo.y; chegarAqui(e, alvo);
            const bt = batalhaEm(alvo.id);
            prepara({ origem, outra, bot });
            const antes = tropaDe('jogador'), vivosAtq = bt.atq.filter(a => a.s.vida > 0).length;
            bt.postAtq = 'recuar';
            for (let i = 0; i < 600 && G.batalhas.includes(bt); i++) avancarBatalhas(0.1);
            const sobrou = bt.atq.filter(a => a.s.vida > 0).length;
            return { recuou: !!bt.recuou, vivosAtq, sobrou, antes, depois: tropaDe('jogador'), mortos: vivosAtq - sobrou, foiPara: e.s.length && G.ex.includes(e) ? e.prov : (G.ex.find(x => x.dono === 'jogador' && x.s.some(s => e.s.includes(s))) || {}).prov || null, origem: origem.id, outra: outra.id, aviso: G.noticias.map(n => n.txt).join(' | ') };
        };
        const emPaz = (bot) => { G.rel[bot].estado = 'paz'; G.rel[bot].ate = 1e9; };
        return {
            origemMinha: rodar(() => {}),
            origemPerdida: rodar(({ origem, outra, bot }) => { origem.dono = bot; outra.dono = 'jogador'; }),
            origemEmPaz: rodar(({ origem, bot }) => { origem.dono = bot; emPaz(bot); }),
            cercado: rodar(({ origem, bot }) => { origem.dono = bot; })
        };
    });
    const salvo = (c) => c.recuou && c.sobrou > 0 && c.depois === c.antes - c.mortos;
    if (!salvo(r.origemMinha) || r.origemMinha.foiPara !== r.origemMinha.origem) falhas.push('origem ainda sua: deveria voltar para ela: ' + JSON.stringify(r.origemMinha));
    if (!salvo(r.origemPerdida) || r.origemPerdida.foiPara !== r.origemPerdida.outra) falhas.push('origem perdida: deveria recuar para a outra província sua vizinha: ' + JSON.stringify(r.origemPerdida));
    if (!salvo(r.origemEmPaz) || r.origemEmPaz.foiPara !== r.origemEmPaz.origem) falhas.push('origem em território em paz: deveria voltar para lá: ' + JSON.stringify(r.origemEmPaz));
    if (r.cercado.depois !== r.cercado.antes - r.cercado.vivosAtq || r.cercado.foiPara !== null || !/cercad/i.test(r.cercado.aviso)) falhas.push('cercado: a tropa se perde e o jogo precisa avisar: ' + JSON.stringify(r.cercado));
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Recuo: volta para a origem, recua para outra província sua ou em paz e, cercado, avisa.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
