// Offline support: caches the site on first visit. tools/site.mjs replaces
// __VERSION__ with a hash of the files, so each deploy gets a fresh cache.
const CACHE = 'cantonlink-__VERSION__';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'lib.js', 'learn.js', 'practice.js', 'romanise.js', 'srs.js', 'library.js', 'tool-definitions.js', 'ai-checks.js', 'ai-providers.js', 'ai-tutor.js', 'ai-settings.js', 'tutor.js', 'data.json', 'icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cantonlink-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => cached ?? fetch(event.request)),
  );
});
