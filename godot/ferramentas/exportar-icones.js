// Converte os ícones do jogo web (game-icons.net, CC BY 3.0) em PNG branco, para o Godot colorir.
// Uso: node ferramentas/exportar-icones.js <pasta do repositório web>
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const WEB = process.argv[2], SAIDA = path.resolve(__dirname, '..', 'arte', 'icones');
(async () => {
    fs.mkdirSync(SAIDA, { recursive: true });
    const fonte = fs.readFileSync(path.join(WEB, 'prototipo', 'vendor', 'game-icons.js'), 'utf8');
    const b = await chromium.launch(); const p = await b.newPage();
    await p.setContent('<body></body>'); await p.addScriptTag({ content: fonte + '\n;window.TODOS = GAME_ICONS;' });
    const lista = await p.evaluate(async () => {
        const r = {};
        for (const [nome, corpo] of Object.entries(window.TODOS)) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="96" height="96">${corpo.replace(/currentColor/g, '#ffffff')}</svg>`;
            const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
            const c = document.createElement('canvas'); c.width = 96; c.height = 96; c.getContext('2d').drawImage(img, 0, 0);
            r[nome] = c.toDataURL('image/png');
        }
        return r;
    });
    Object.entries(lista).forEach(([n, d]) => fs.writeFileSync(path.join(SAIDA, n + '.png'), Buffer.from(d.split(',')[1], 'base64')));
    console.log(Object.keys(lista).length + ' ícones');
    await b.close();
})();
