// Conquista: mede cada fase com o jogador esperto e o ingênuo (mesmo código de tests/conquista.js).
// Uso: node tests/conquista-fases.js <fase> <partidas> [esperto|ingenuo]   (ex.: node tests/conquista-fases.js 1 10 ingenuo)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const CONQ = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');
const src = fs.readFileSync(path.join(__dirname, 'conquista.js'), 'utf8');
const i = src.indexOf('function jogar({ N, FASE, EST })'), j = src.indexOf('(async () => {', i);
const JOGAR = src.slice(i, j);
const FASE = +(process.argv[2] || 1), N = +(process.argv[3] || 6), EST = process.argv[4] || 'esperto';
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto(CONQ); await p.evaluate(() => localStorage.clear()); await p.goto(CONQ); await p.waitForTimeout(400);
    await p.addScriptTag({ content: JOGAR });
    const r = await p.evaluate(({ N, FASE, EST }) => jogar({ N, FASE, EST }), { N, FASE, EST });
    const cont = {}; r.res.forEach(x => { cont[x.fim] = (cont[x.fim] || 0) + 1; });
    const venceu = r.res.filter(x => x.fim === 'vitoria' || x.fim === 'pontos').length;
    const med = (k) => Math.round(10 * r.res.reduce((t, x) => t + x[k], 0) / r.res.length) / 10;
    console.log(JSON.stringify({ fase: FASE, estrategia: EST, partidas: N, venceu: venceu + '/' + N, fins: cont, provinciasNoFim: med('minhas'), totalProvincias: r.res[0].total, ataquesBot: med('ataquesBot'), contraMim: med('contraMim'), travou: r.travou }));
    await b.close();
})();
