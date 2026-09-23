// ══════════════════════════════════════════════════════════════════
// IVAN IA — Service Worker
// Gère le cache de l'interface pour un fonctionnement hors ligne
// ══════════════════════════════════════════════════════════════════

const CACHE_NAME = 'ivan-ia-v1';
const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg'
];

// ── Installation : on met en cache les fichiers de base ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Erreur install :', err))
  );
});

// ── Activation : on supprime les anciens caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie cache-first pour l'interface, network-only pour l'API ──
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ne gère que les GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // On ne cache JAMAIS les appels à l'API Agnes (données dynamiques)
  if (
    url.hostname.includes('agnes-ai.com') ||
    url.hostname.includes('apihub.agnes-ai.com')
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // Pour le reste : cache-first avec mise à jour en arrière-plan
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((response) => {
          // On met à jour le cache avec la nouvelle version
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(() => {
          // Hors ligne → on renvoie la version en cache
          return cached;
        });

      // On renvoie le cache immédiatement si dispo, sinon on attend le réseau
      return cached || networkFetch;
    })
  );
});

// ── Message : permet à l'app de forcer la mise à jour du SW ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});