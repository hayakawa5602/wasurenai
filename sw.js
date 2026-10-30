// Service Worker：アプリの画面をスマホに保存して、電波が弱くても開けるようにする。
// 通知をタップしたときにアプリを開く役目もある。
const CACHE = "wasurenashi-v2";
const FILES = [
  "./", "./index.html", "./css/style.css", "./manifest.webmanifest",
  "./js/app.js", "./js/predict.js", "./js/weather.js", "./js/location.js",
  "./js/storage.js", "./js/notify.js", "./js/calendar.js",
  "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 自分のファイルは保存したものを使い、裏で新しいものに更新する。天気APIなど外部への通信はそのまま通す
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow("./"))));
});
