// Exporta do jogo web os 6 mapas (províncias, situação inicial e terreno pintado), para o Godot usar exatamente os mesmos.
// Uso: node ferramentas/exportar-mapas.js <pasta do repositório web>   (precisa do Playwright)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const WEB = process.argv[2], SAIDA = path.resolve(__dirname, '..', 'dados');
(async () => {
    fs.mkdirSync(SAIDA, { recursive: true });
    const b = await chromium.launch(); const p = await b.newPage();
    const U = 'file://' + path.join(WEB, 'prototipo', 'conquista.html').replace(/\\/g, '/');
    await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.goto(U); await p.waitForTimeout(500);
    const mapas = [];
    for (let n = 1; n <= 6; n++) {
        const r = await p.evaluate((n) => {
            laco = () => {}; novoJogo(n);
            const um = (v) => Math.round(v * 10) / 10;
            return {
                n, W: MAPA.W, H: MAPA.H, capitalJogador: G.capitalJogador,
                prov: Object.values(G.prov).map(q => ({ id: q.id, nome: q.nome, x: um(q.x), y: um(q.y), viz: q.viz, poli: q.poli.map(pt => [um(pt.x), um(pt.y)]), tipo: q.tipo, dono: q.dono, capital: q.capital, capitalDe: q.capitalDe || '', trinch: q.trinch, moral: q.moral, forte: !!q.obras.forte })),
                ex: G.ex.map(e => ({ dono: e.dono, prov: e.prov, tropas: e.s.map(s => s.tipo) })),
                terreno: TERRENO.toDataURL('image/png')
            };
        }, n);
        fs.writeFileSync(path.join(SAIDA, `terreno${n}.png`), Buffer.from(r.terreno.split(',')[1], 'base64'));
        delete r.terreno; mapas.push(r);
    }
    fs.writeFileSync(path.join(SAIDA, 'mapas.json'), JSON.stringify(mapas));
    await b.close();
    console.log(mapas.map(m => `fase ${m.n}: ${m.prov.length} províncias, ${m.ex.length} exércitos`).join('\n'));
})();
