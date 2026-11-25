/**
 * Service Worker - Avaliação Garden Gold
 * Habilita instalação PWA (WebAPK) no Android Chrome e suporte offline
 */

const CACHE_NAME = 'garden-gold-v3.3';
const ASSETS_TO_CACHE = [
  '/',
  '/favicon.ico',
  '/styles.css',
  '/app.js',
  '/config.js',
  '/questions.js',
  '/questions.json',
  '/manifest.json',
  '/libs/jspdf.umd.min.js',
  '/libs/jspdf.plugin.autotable.min.js',
  '/images/logo-garden-gold.png',
  '/images/icon-32.png',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/apple-touch-icon.png',
  '/images/q01-reto-femoral.svg',
  '/images/q02-vastos-quadriceps.svg',
  '/images/q03-semitendineo.svg',
  '/images/q04-biceps-femoral.svg',
  '/images/q05-gluteo-maximo.svg',
  '/images/q06-gluteo-medio.svg',
  '/images/q07-gastrocnemio.svg',
  '/images/q08-soleo.svg',
  '/images/q09-grande-dorsal-origem-insercao.svg',
  '/images/q10-grande-dorsal-acoes.svg',
  '/images/q11-peitoral-maior-origem-insercao.svg',
  '/images/q12-peitoral-maior-acoes.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        ASSETS_TO_CACHE.map((asset) => cache.add(asset).catch(() => {}))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
