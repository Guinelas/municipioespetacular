const VERSION = 'v3';
const CACHE_NAME = `municipio-y-${VERSION}`;

// Ficheiros locais pré-carregados na instalação (a app funciona offline após a 1.ª visita).
const LOCAL_ASSETS = [
  './', 'index.html', 'noticias.html', 'eventos.html', 'concursos.html', 'projetos.html',
  'freguesias.html', 'login.html', 'minha-area.html', 'submeter-evento.html', 'admin.html',
  'css/style.css', 'js/app.js', 'pwa/manifest.json',
  'pwa/icons/icon-192.png', 'pwa/icons/icon-512.png', 'pwa/icons/icon-192.svg'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

// Origens externas que podem ser guardadas em cache (cache-first).
const CACHEABLE_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'images.unsplash.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // allSettled: um ficheiro em falta (ou CDN offline) não impede a instalação.
    await Promise.allSettled([
      ...LOCAL_ASSETS.map(url => cache.add(url)),
      ...CDN_ASSETS.map(url => cache.add(new Request(url, { mode: 'cors' })))
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Apaga apenas caches antigas desta app (e não todas as do domínio).
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('municipio-y-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // status 0 = resposta opaca (imagens/fontes sem CORS), também é guardável.
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));       // conteúdo próprio: sempre atualizado quando há rede
  } else if (CACHEABLE_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));         // bibliotecas, fontes e imagens externas
  }
});
