/* Do4You service worker. Caches the app shell so the app opens
   offline and installs on the phone home screen. Plain cache, no build step. */

var CACHE = 'do4you-v2';
var FILES = [
  '.',
  'index.html',
  'login.html',
  'create-tournament.html',
  'badminton-live.html',
  'badminton-fixtures.html',
  'badminton-tournaments.html',
  'cricket-live.html',
  'cricket-fixtures.html',
  'cricket-tournaments.html',
  'football-live.html',
  'football-fixtures.html',
  'football-tournaments.html',
  'style.css',
  'app.js',
  'firebase-config.js',
  'sync.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'logo.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
