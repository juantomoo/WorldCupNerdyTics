// =====================================================================
// sw.js — Service Worker para WC26 Nerdytics
// Vanilla · PWA offline-ready
// =====================================================================
//
// Estrategia:
//   - Cache-first para assets estáticos (HTML, CSS, JS, fonts)
//   - Network-first con fallback a cache para ESPN API
//   - Limpieza automática de caches viejos
//
// =====================================================================

const CACHE_VERSION = 'wc26-v2.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './data.js',
  './i18n.js',
  './espn.js',
  './predictor.js',
  './montecarlo.js',
  './state.js',
  './manifest.webmanifest',
];

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

// =====================================================================
// INSTALL
// =====================================================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('SW install error:', err))
  );
});

// =====================================================================
// ACTIVATE
// =====================================================================

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// =====================================================================
// FETCH
// =====================================================================

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo manejar GET
  if (event.request.method !== 'GET') return;

  // Ignorar extensiones del navegador y otros esquemas
  if (!url.protocol.startsWith('http')) return;

  // ESPN API: Network-first con fallback
  if (url.href.startsWith(ESPN_BASE)) {
    event.respondWith(networkFirst(event.request, API_CACHE, 10000));
    return;
  }

  // Google Fonts: Cache-first
  if (url.host.includes('fonts.googleapis.com') || url.host.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Static assets: Cache-first
  if (url.origin === location.origin) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }
});

// =====================================================================
// ESTRATEGIAS
// =====================================================================

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Fallback: index.html para navegación
    if (request.mode === 'navigate') {
      return cache.match('./index.html');
    }
    throw err;
  }
}

async function networkFirst(request, cacheName, timeout = 10000) {
  const cache = await caches.open(cacheName);

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    const response = await fetch(request, { signal: ctrl.signal });
    clearTimeout(tid);

    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;

    // Sin cache y sin red: devolver respuesta vacía
    return new Response(JSON.stringify({
      events: [],
      articles: [],
      error: 'offline',
      message: 'WC26 Nerdytics · Modo offline — ESPN no disponible',
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// =====================================================================
// MENSAJES (opcional: skipWaiting desde la app)
// =====================================================================

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
});
