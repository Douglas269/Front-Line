// Exportação para o itch.io: roda tools/exportar-itch.sh, confere os limites do itch e abre as 3 páginas servidas dentro de um
// subcaminho (como o itch faz), sem arquivo faltando nem erro de JavaScript. Uso: node tests/exportar-itch.js
const { execFileSync } = require('child_process'), http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..'), OUT = path.join(RAIZ, 'dist', 'teste-itch');
execFileSync(path.join(RAIZ, 'tools', 'exportar-itch.sh'), [OUT], { cwd: RAIZ, stdio: 'pipe' });
const f = [];
const lista = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? lista(path.join(d, e.name)) : [path.join(d, e.name)]);
const arqs = lista(OUT).map(x => path.relative(OUT, x).replace(/\\/g, '/'));
if (!arqs.includes('index.html')) f.push('falta index.html na raiz');
if (arqs.length > 1000) f.push('mais de 1000 arquivos: ' + arqs.length);
if (Math.max(...arqs.map(x => x.length)) > 240) f.push('caminho com mais de 240 caracteres');
if (lista(OUT).some(x => fs.statSync(x).size > 200 * 1024 * 1024)) f.push('arquivo acima de 200 MB');
if (arqs.includes('sw.js')) f.push('sw.js não deveria ir para o itch');
const codigo = arqs.filter(x => /\.(html|js)$/.test(x)).map(x => ({ x, t: fs.readFileSync(path.join(OUT, x), 'utf8') }));
codigo.forEach(({ x, t }) => { if (/(src|href)="\/[a-z]/i.test(t)) f.push('caminho absoluto "/..." em ' + x); if (/location\.origin \+ '\/(duelo|conquista)/.test(t)) f.push('link com location.origin em ' + x); if (/ponto-alpha\.html/.test(t)) f.push('sobrou ponto-alpha.html em ' + x); });
const PREF = '/html/12345/';
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); if (!u.pathname.startsWith(PREF)) { res.writeHead(404); return res.end(); }
  const p = path.join(OUT, decodeURIComponent(u.pathname.slice(PREF.length)) || 'index.html');
  if (!p.startsWith(OUT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
  res.writeHead(200, { 'Content-Type': tipos[path.extname(p)] || 'application/octet-stream' }); res.end(fs.readFileSync(p));
});
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port + PREF;
  const b = await chromium.launch(); let erros = 0;
  for (const pagina of ['index.html', 'conquista.html', 'duelo.html']) {
    const ctx = await b.newContext(); await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const p = await ctx.newPage(); const faltando = [];
    p.on('pageerror', e => { if (!/supabase|Failed to fetch|NetworkError/i.test(e.message)) { f.push(pagina + ': erro JS ' + e.message); erros++; } });
    p.on('response', r => { if (r.status() >= 400) faltando.push(r.url().replace(base, '')); });
    await p.goto(base + pagina); await p.waitForTimeout(900);
    const link = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /^\//.test(h)));
    if (faltando.length) f.push(pagina + ': arquivos que deram erro: ' + faltando.slice(0, 4).join(', '));
    if (link.length) f.push(pagina + ': links absolutos ' + link.join(','));
    await ctx.close();
  }
  await b.close(); srv.close(); fs.rmSync(OUT, { recursive: true, force: true });
  console.log(f.length ? 'FALHOU:\n' + f.join('\n') : `OK: pasta do itch.io (${arqs.length} arquivos) com index.html, sem caminhos absolutos, e as 3 páginas abrem num subcaminho sem erro`); process.exit(f.length ? 1 : 0);
})();
