// アプリの土台(HTML・アイコン)だけをキャッシュし、
// Firebase/Gemini等の外部API通信には一切干渉しない設計。
const CACHE_VERSION = "kondate-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 同じオリジンのアプリ本体だけをキャッシュ対象にする。
  // Firebase・Gemini APIなど外部への通信はそのまま素通りさせる。
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        })
        .catch(() => cached);
      // キャッシュがあれば即座に返しつつ、裏で最新版に更新(stale-while-revalidate)
      return cached || fetchPromise;
    })
  );
});
