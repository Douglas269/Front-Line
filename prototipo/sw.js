// Service worker do Ponto Alpha.
// Rede primeiro: o jogo sempre busca a versão mais nova e só usa a cópia salva
// quando não há conexão. Assim o app instalado nunca fica preso numa versão antiga.
const CACHE = 'ponto-alpha-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Fontes, ícones e Tailwind vêm de outros sites: o navegador cuida deles
  if (url.origin !== self.location.origin) return;
  // Música: deixa o navegador tocar direto (pedidos parciais de áudio)
  if (url.pathname.endsWith('.mp3')) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/')))
  );
});
