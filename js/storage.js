// スマホ（ブラウザ）の中だけに保存する（localStorage）。サーバーには送らない。
const PREFIX = "wasurenashi:";

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* 保存できなくても動作は続ける */ }
}

export function clearAll() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* 何もしない */ }
}

// 今日の日付（YYYY-MM-DD）。チェック状態は日付ごとに分けて保存する
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
