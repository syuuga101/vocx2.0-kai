const CACHE_NAME = 'vocx-dojo-pwa-v14';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './ui.css',
  './app.js',
  './sys/flag-jp.svg',
  './sys/flag-gb.svg',
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
