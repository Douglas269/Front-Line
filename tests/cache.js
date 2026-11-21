// Cache do jogo (service worker): na segunda abertura o código e os estilos com ?v= vêm do cache,
// uma versão nova de arquivo é baixada de novo e a cópia velha some, e sem internet a página ainda abre.
// Usa um servidor HTTP local (service worker não roda em file://) que imita as rotas da Vercel.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RAIZ = path.join(__dirname, '..', 'prototipo');
const ROTAS = { '/': '/ponto-alpha.html', '/conquista': '/conquista.html', '/duelo': '/duelo.html' };
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const pedidos = [];
const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); pedidos.push(u.pathname + u.search);
  let p = ROTAS[u.pathname] || u.pathname; if (p.startsWith('/prototipo/')) p = p.slice(10);
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
});
let falhas = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FALHA ') + m); if (!c) falhas++; };
(async () => {
  await new Promise(r => servidor.listen(0, r)); const base = 'http://localhost:' + servidor.address().port;
  const nav = await chromium.launch(); const ctx = await nav.newContext();
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort()); // sem internet de fora (Supabase, CDN)
  for (const rota of ['/', '/conquista', '/duelo']) {
    const pg = await ctx.newPage(); pg.on('pageerror', () => {});
    await pg.goto(base + rota); await pg.evaluate(() => navigator.serviceWorker.ready); await pg.waitForTimeout(800);
    await pg.reload(); await pg.waitForTimeout(500);
    ok(await pg.evaluate(() => !!navigator.serviceWorker.controller), rota + ': service worker controla a página');
    await pg.close();
  }
  // segunda abertura da principal: nenhum .js nem .css pode ir à rede
  const pg = await ctx.newPage(); pg.on('pageerror', () => {});
  pedidos.length = 0; await pg.goto(base + '/'); await pg.waitForTimeout(1200);
  const codigo = pedidos.filter(p => /\.(js|css)\?v=/.test(p));
  ok(codigo.length === 0, 'segunda abertura não baixou código nem estilo (baixou ' + codigo.length + ')');
  const chaves = await pg.evaluate(async () => (await (await caches.open('frontline-v3')).keys()).map(k => new URL(k.url).pathname + new URL(k.url).search));
  ok(chaves.some(k => /02-regras\.js\?v=/.test(k)) && chaves.some(k => /tailwind\.css\?v=/.test(k)), 'código e estilo estão guardados no cache');
  // versão nova do mesmo arquivo: baixa de novo e apaga a cópia velha
  const antes = chaves.filter(k => /02-regras\.js/.test(k)).length;
  await pg.evaluate(() => fetch('/assets/js/02-regras.js?v=teste.novo'));
  await pg.waitForTimeout(500);
  const depois = await pg.evaluate(async () => (await (await caches.open('frontline-v3')).keys()).map(k => new URL(k.url).search + '|' + new URL(k.url).pathname).filter(k => /02-regras/.test(k)));
  ok(antes === 1 && depois.length === 1 && /teste\.novo/.test(depois[0]), 'versão nova de um arquivo troca a cópia velha (' + depois.join(',') + ')');
  // sem rede: a página ainda abre
  await ctx.setOffline(true);
  const off = await ctx.newPage(); await off.goto(base + '/').catch(() => {});
  ok(await off.evaluate(() => !!document.querySelector('#tela-titulo, #app')), 'sem conexão a página abre pela cópia guardada');
  await nav.close(); servidor.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
