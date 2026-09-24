const CACHE = 'codex-alert-__BUILD_HASH__';
const ASSETS = ['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'];
const MESSAGES = { complete: 'Codexの応答が完了しました', permission: 'Codexで承認要求が発生しました' };
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('codex-alert-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const u = new URL(event.request.url), base = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || u.origin !== base.origin || !u.pathname.startsWith(base.pathname)) return;
  // Cache only the known static app files, never registration downloads.
  if (!ASSETS.some(a => new URL(a, base).pathname === u.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request, { ignoreSearch: true })));
});
self.addEventListener('push', event => {
  let entries = [];
  try {
    const data = event.data?.json();
    if (data?.version === 1 && Array.isArray(data.events)) entries = ['complete','permission'].flatMap(kind => {
      const item = data.events.find(e => e.kind === kind && Number.isSafeInteger(e.at) && e.at > 0 && e.at < 8.64e15);
      return item ? [MESSAGES[kind] + '\n' + new Date(item.at).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false })] : [];
    });
  } catch {}
  // Every push must be visible, including malformed/late payloads. Never show
  // remote text, URLs, identifiers, or commands from the payload.
  const body = entries.join('\n') || MESSAGES.complete;
  event.waitUntil(self.registration.showNotification('Codex', { body, tag: 'codex-iphone-alert', renotify: true, icon: './icon-192.png', badge: './icon-192.png' }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(self.registration.scope));
});
