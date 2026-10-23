const CACHE_NAME = 'vocx-dojo-pwa-v61';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './ui.css',
  './desktop.css',
  './desktop.js',
  './sys/fonts/noto-sans-indic-siyaq-numbers.ttf',
  './app.js',
  './tango.js',
  './study-plan.js',
  './dojo-exam.js',
  './sound-effects.js',
  './debug.js',
  './sys/mode-jp-en.png',
  './sys/mode-en-en.png',
  './manifest.json',
  './data.js',
  './sys/icon.svg',
  './sys/icon-192.png',
  './sys/icon-512.png',
  './sys/apple-touch-icon.png',
  './se/button.wav',
  './se/Slide.wav',
  './se/correct.wav',
  './se/incorrect.wav',
  './se/countdown.wav',
  './se/countdown-start.wav',
  './dojo/unit1/part1.json',
  './dojo/unit1/part2.json',
  './dojo/Unit2/part1.json',
  './dojo/Unit2/part2.json'
];

for (let i = 2; i <= 27; i++) {
  const id = String(i).padStart(2, '0');
  PRECACHE_ASSETS.push(`./vocx/${id}.csv`);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key.startsWith('vocx-dojo-pwa-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Versioned local images and sounds can reuse their precached copy immediately.
  // Keep source code and lesson files network-first so local edits remain visible.
  const cacheFirst = url.origin === self.location.origin
    && /\.(?:svg|png|wav|ttf|otf|woff2?)$/i.test(url.pathname)
    && !event.request.headers.has('range');
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (cacheFirst) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response.status === 200) {
        event.waitUntil(cache.put(event.request, response.clone()).catch(() => {}));
      }
      return response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
