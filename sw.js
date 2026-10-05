// Service worker: guarda la "carcasa" de la app para que abra rápido; los datos siempre vienen de Supabase
const CACHE = 'planificador-v5';
const SHELL = ['/', '/index.html', '/styles.css', '/config.js', '/planner.js', '/auth.js', '/data/content.js', '/data/spec.js', '/data/extra.js', '/icons/es/icon-192.png', '/en/', '/en/index.html'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Supabase y CDN: directo a la red
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match(u.pathname.startsWith('/en') ? '/en/' : '/'))));
});
