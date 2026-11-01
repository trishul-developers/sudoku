/* Offline PWA cache: no network calls other than fetching the site's own assets. */
const VERSION = 'sudoku-offline-v1.0.0';
const ASSETS = [
  './', './index.html', './css/styles.css', './js/engine.js',
  './js/puzzles.js', './js/app.js', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sudoku-offline-') && k !== VERSION).map(k => caches.delete(k))))]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
