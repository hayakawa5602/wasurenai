// 天気の取得（Open-Meteo API：無料・APIキー不要・CC BY 4.0）
// https://open-meteo.com/en/docs
import { load, save } from "./storage.js";

// 位置情報を使わない人のための地域
export const CITIES = {
  nagoya: { name: "名古屋", lat: 35.18, lon: 136.91 },
  tokyo: { name: "東京", lat: 35.69, lon: 139.69 },
  osaka: { name: "大阪", lat: 34.69, lon: 135.50 },
  fukuoka: { name: "福岡", lat: 33.59, lon: 130.40 },
  sapporo: { name: "札幌", lat: 43.06, lon: 141.35 },
};

// WMO天気コード → 日本語
function codeToText(c) {
  if (c === 0) return "晴れ";
  if (c <= 3) return "くもり";
  if (c <= 48) return "霧";
  if (c <= 67 || (c >= 80 && c <= 82)) return "雨";
  if (c <= 77 || c === 85 || c === 86) return "雪";
  if (c >= 95) return "雷雨";
  return "くもり";
}

/**
 * 今日と明日の天気を取得する（1時間はスマホ内のコピーを使い、通信を減らす）
 * @returns {Promise<{today:object, tomorrow:object}>}
 */
export async function getWeather(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cache = load("weatherCache", null);
  if (cache && cache.key === key && Date.now() - cache.time < 60 * 60 * 1000) return cache.data;

  const url = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}`
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    + "&timezone=Asia%2FTokyo&forecast_days=2";
  const res = await fetch(url);
  if (!res.ok) throw new Error("天気を取得できませんでした");
  const d = (await res.json()).daily;
  const day = (i) => ({
    text: codeToText(d.weather_code[i]),
    tMax: Math.round(d.temperature_2m_max[i]),
    tMin: Math.round(d.temperature_2m_min[i]),
    rainProb: d.precipitation_probability_max[i] ?? 0,
  });
  const data = { today: day(0), tomorrow: day(1) };
  save("weatherCache", { key, time: Date.now(), data });
  return data;
}
