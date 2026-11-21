// Service worker do FrontLine (valem as três páginas: /, /conquista e /duelo).
// Objetivo: o jogo abrir rápido sem baixar tudo de novo a cada visita.
//  - Código e estilo com ?v=<versão>: cópia guardada primeiro (a versão faz parte do endereço,
//    então uma versão nova é outro endereço e é baixada na hora).
//  - Imagens, fontes e ícones sem ?v=: mostra a cópia guardada e atualiza em segundo plano.
//  - Páginas HTML: rede primeiro (sempre a versão nova); sem conexão, usa a cópia guardada.
//  - versao.json, música e pedidos de outros sites: direto, sem cópia.
const CACHE = 'frontline-v3';
const SHELL = ['/', '/conquista', '/duelo', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg'];

self.addEventListener('install', (e) => {
  // Cada item é guardado sozinho: um que falhe não impede a instalação
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Guarda a resposta e apaga cópias da mesma peça em versões antigas (?v= diferente)
async function guardar(req, res) {
  if (!res || !res.ok || res.status !== 200) return;
  const c = await caches.open(CACHE);
  const url = new URL(req.url);
  if (url.searchParams.has('v')) {
    const ks = await c.keys();
    await Promise.all(ks.filter((k) => {
      const u = new URL(k.url);
      return u.pathname === url.pathname && u.search !== url.search;
    }).map((k) => c.delete(k)));
  }
  await c.put(req, res);
}

async function cacheDepois(req) {
  const guardada = await caches.match(req);
  if (guardada) return guardada;
  const res = await fetch(req);
  const copia = res.clone();
  guardar(req, copia).catch(() => {});
  return res;
}

async function guardadaERevalida(e, req) {
  const guardada = await caches.match(req);
  const rede = fetch(req).then((res) => { guardar(req, res.clone()).catch(() => {}); return res; });
  if (guardada) { e.waitUntil(rede.catch(() => {})); return guardada; }
  return rede;
}

async function redePrimeiro(req) {
  try {
    const res = await fetch(req);
    guardar(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    return (await caches.match(req)) || (await caches.match('/')) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;               // fontes e bibliotecas de outros sites
  if (url.pathname.endsWith('.mp3')) return;                      // música: pedidos parciais de áudio
  if (url.pathname.endsWith('versao.json')) return;               // versão publicada: sempre do site
  if (url.pathname.endsWith('sw.js')) return;

  const ehPagina = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (ehPagina) { e.respondWith(redePrimeiro(req)); return; }
  if (url.searchParams.has('v')) { e.respondWith(cacheDepois(req).catch(() => fetch(req))); return; }
  e.respondWith(guardadaERevalida(e, req).catch(() => fetch(req)));
});
