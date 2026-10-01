// Service Worker: يعمل بدون إنترنت بعد أول تشغيل (الصفحة + مكتبة الوجه + النماذج + الخطوط)
const V = 'lib-assistant-v5';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
const CDN = /^(cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;                       // طلبات الذكاء الاصطناعي (POST) لا تمر من هنا
  const u = new URL(r.url);
  const own = u.origin === self.location.origin;
  if (!own && !CDN.test(u.hostname)) return;
  const page = r.mode === 'navigate' || u.pathname.endsWith('/index.html');
  if (page) {                                           // الصفحة: الشبكة أولاً ثم النسخة المخزنة
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); if (res.ok) caches.open(V).then(c => c.put(r, cp)); return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => {   // الباقي: المخزن أولاً
    if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
    return res;
  })));
});
