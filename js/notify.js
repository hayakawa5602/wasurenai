// 通知（Notification API ＋ Service Worker）
// ブラウザだけで動くWebアプリなので、通知を出せるのは「アプリが開いている（起動中）」ときです。
// アプリを閉じていても届く通知には、プッシュ通知用のサーバーが必要になります（READMEを参照）。

export function notifySupported() {
  return "Notification" in window;
}

export function permission() {
  return notifySupported() ? Notification.permission : "unsupported";
}

export async function requestPermission() {
  if (!notifySupported()) return "unsupported";
  return Notification.requestPermission();
}

/** 通知を出す。許可がなければ false を返す（画面内のバナーで代わりに知らせる） */
export async function showNotification(body) {
  if (permission() !== "granted") return false;
  const opts = { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "wasurenashi" };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification("わすれナシ", opts); return true; }
    new Notification("わすれナシ", opts);
    return true;
  } catch { return false; }
}
