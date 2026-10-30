// 位置情報（ブラウザの Geolocation API）
// 位置は「天気を調べる」「自宅から離れたか判定する」ためだけに使い、外部には送らない。
// ※ 天気APIには緯度・経度を小数第2位（約1km）に丸めて渡すだけ。

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("この端末では位置情報が使えません"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

// 位置の変化を見張る。止めるときは戻り値の関数を呼ぶ
export function watchPosition(onChange) {
  if (!("geolocation" in navigator)) return () => {};
  const id = navigator.geolocation.watchPosition(
    (p) => onChange({ lat: p.coords.latitude, lon: p.coords.longitude }),
    () => {},
    { enableHighAccuracy: false, maximumAge: 60 * 1000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

// 2地点の距離（m）— ハーバーサインの公式
export function distanceMeters(a, b) {
  const R = 6371000; // 地球の半径（m）
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
