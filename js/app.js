// わすれナシ — 画面の表示と操作をまとめるメインの処理
import { EVENTS, predict } from "./predict.js";
import { getWeather, CITIES } from "./weather.js";
import { getPosition, watchPosition, distanceMeters } from "./location.js";
import { load, save, clearAll, todayKey } from "./storage.js";
import { permission, requestPermission, showNotification, notifySupported } from "./notify.js";
import { googleCalendarUrl, downloadIcs } from "./calendar.js";

const $ = (s) => document.querySelector(s);
const HOME_RADIUS = 200; // 自宅とみなす範囲（m）
const WD = ["日", "月", "火", "水", "木", "金", "土"];

// ---------- 状態（すべてスマホの中に保存） ----------
const defaults = { tNight: "21:00", tLeave: "07:30", geoNotify: true, geoConsent: null, city: "nagoya", home: null, lastEvents: ["出社"], customEvents: [] };
let settings = { ...defaults, ...load("settings", {}) };
let history = load("history", {});          // { 持ち物名: 忘れた回数 }
let customAlways = load("customAlways", []); // 毎日持つ物（自分で追加）
let dayKey = todayKey();
let day = loadDay();
let weather = null;      // { today, tomorrow }
let here = null;         // 現在地 { lat, lon }
let wasAtHome = null;    // 前回の判定で自宅にいたか
let stopWatch = () => {};

function loadDay() {
  return { checked: {}, customToday: [], fired: {}, events: [...settings.lastEvents], ...load("day:" + dayKey, {}) };
}
const saveSettings = () => save("settings", settings);
const saveDay = () => save("day:" + dayKey, day);

const items = () => predict({
  events: day.events,
  weather: weather?.today ?? null,
  history,
  custom: [...customAlways, ...day.customToday],
  customEvents: settings.customEvents,
});
const remaining = () => items().filter((i) => !day.checked[i.name]);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dateLabel = (d = new Date()) => `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;

// ---------- 表示 ----------
function render() {
  const list = items();
  const left = list.filter((i) => !day.checked[i.name]);
  const done = list.length - left.length;

  $("#todayDate").textContent = dateLabel();

  // 天気
  if (weather) {
    const w = weather.today;
    $("#wxTemp").textContent = `${w.tMax}°`;
    $("#wxDesc").textContent = `${w.text}・最低${w.tMin}° 降水${w.rainProb}%`;
  }

  // 現在地
  const atHome = isAtHome();
  if (settings.geoConsent === "yes" && here) {
    if (!settings.home) { $("#locName").textContent = "現在地"; $("#locDesc").textContent = "自宅が未登録です（設定で登録）"; }
    else if (atHome) { $("#locName").textContent = "自宅"; $("#locDesc").textContent = "出発前"; }
    else { $("#locName").textContent = "外出中"; $("#locDesc").textContent = `自宅から約${formatDist(distanceMeters(here, settings.home))}`; }
  } else if (settings.geoConsent === "yes") {
    $("#locName").textContent = "取得中"; $("#locDesc").textContent = "位置を調べています";
  } else {
    $("#locName").textContent = CITIES[settings.city].name; $("#locDesc").textContent = "位置情報はオフ（地域で天気を表示）";
  }
  $("#locBadge").hidden = settings.geoConsent !== "yes";
  $("#consent").hidden = settings.geoConsent !== null;

  // 家を出たときの警告
  const alert = $("#locAlert");
  if (settings.home && here && atHome === false) {
    alert.hidden = false;
    if (left.length) { alert.className = "alert"; alert.innerHTML = `<span aria-hidden="true">⚠</span><span>自宅から離れました。<b>${left.slice(0, 3).map((i) => esc(i.name)).join("・")}</b>${left.length > 3 ? " ほか" : ""}がまだです。持っていますか？</span>`; }
    else { alert.className = "alert ok"; alert.innerHTML = `<span aria-hidden="true">✓</span><span>全部チェックして出発できました。</span>`; }
  } else alert.hidden = true;

  // 予定のボタン
  const chip = (name, mine) => `<button class="chip${mine ? " mine" : ""}" type="button" aria-pressed="${day.events.includes(name)}" data-e="${esc(name)}">${esc(name)}</button>`;
  $("#events").innerHTML = EVENTS.map((e) => chip(e, false)).join("")
    + settings.customEvents.map((c) => chip(c.name, true)).join("")
    + `<button class="chip add-ev" type="button" id="evOpen" aria-expanded="${!$("#evForm").hidden}">＋ 予定を追加</button>`;

  // 自分で追加した予定（設定画面）
  $("#myEvents").innerHTML = settings.customEvents.length
    ? settings.customEvents.map((c) => `<div class="my-ev"><div><b>${esc(c.name)}</b><p class="sub">${c.items.length ? esc(c.items.join("、")) : "持ち物の登録なし"}</p></div><button class="btn ghost small" type="button" data-del-ev="${esc(c.name)}">削除</button></div>`).join("")
    : `<p class="sub">「きょう」の画面の「＋ 予定を追加」から、自分の予定と持ち物を登録できます。</p>`;

  // 持ち物リスト
  const tick = '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>';
  $("#list").innerHTML = list.length ? list.map((i) => `
    <div class="item ${day.checked[i.name] ? "done" : ""}">
      <button class="check" type="button" role="checkbox" aria-checked="${!!day.checked[i.name]}" aria-label="${esc(i.name)}" data-n="${esc(i.name)}">${tick}</button>
      <div><div class="name">${esc(i.name)}</div><div class="why">${esc(i.why)}</div></div>
      <div class="side"><span class="tag t-${i.tag}">${i.tag}</span><button class="mini" type="button" data-forgot="${esc(i.name)}">忘れた</button></div>
    </div>`).join("") : `<p class="sub">予定を選ぶと、持ち物が表示されます。</p>`;

  // 進み具合
  const pct = list.length ? done / list.length : 0;
  $("#ringFg").setAttribute("stroke-dashoffset", String(201 * (1 - pct)));
  $("#ringTxt").textContent = `${done}/${list.length}`;
  if (list.length && !left.length) { $("#progTitle").textContent = "忘れ物ゼロ！"; $("#progSub").textContent = "準備完了です。いってらっしゃい。"; }
  else { $("#progTitle").textContent = `あと${left.length}こ`; $("#progSub").textContent = "持ったらチェックしましょう"; }

  // ロック画面のイメージ
  $("#lockDate").textContent = dateLabel();
  $("#lwLeft").textContent = String(left.length);
  $("#lwTemp").textContent = weather ? `${weather.today.tMax}°` : "--°";
  $("#lwWx").textContent = weather ? `${weather.today.text} ${weather.today.rainProb}%` : "";
  $("#lwList").innerHTML = left.length ? left.slice(0, 4).map((i) => `<li>${esc(i.name)}</li>`).join("") + (left.length > 4 ? `<li>ほか${left.length - 4}こ</li>` : "") : "<li>すべて準備できました</li>";

  // 設定画面
  $("#tNight").value = settings.tNight;
  $("#tLeave").value = settings.tLeave;
  $("#geoNotify").checked = settings.geoNotify;
  $("#geoNotify").disabled = settings.geoConsent !== "yes";
  const perm = permission();
  $("#notifState").textContent = perm === "granted" ? "許可されています" : perm === "denied" ? "ブロックされています（端末の設定で変更できます）" : perm === "unsupported" ? "この端末では使えません（画面内で知らせます）" : "まだ許可されていません";
  $("#notifAllow").hidden = perm !== "default";
  $("#homeState").textContent = settings.home ? "登録済み（このスマホの中だけに保存）" : "まだ登録されていません";
  $("#clearHome").disabled = !settings.home;
  $("#setHome").disabled = settings.geoConsent !== "yes";
  $("#citySel").value = settings.city;

  // カレンダー・共有
  const title = `持ち物：${day.events.join("・") || "予定なし"}`;
  const details = list.map((i) => i.name).join("、");
  $("#calText").textContent = `${dateLabel()} ${title}\n${details}`;
  $("#gcalLink").href = googleCalendarUrl(title, details);
  $("#shareText").textContent = shareText(list);
}

function shareText(list) {
  const w = weather ? `${weather.today.text} 降水${weather.today.rainProb}%` : "";
  return `【${dateLabel()}の持ち物】${w}\n` + list.map((i) => `${day.checked[i.name] ? "☑" : "☐"} ${i.name}`).join("\n") + "\n― わすれナシ";
}

const formatDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`);
function isAtHome() {
  if (!settings.home || !here) return null;
  return distanceMeters(here, settings.home) <= HOME_RADIUS;
}

// ---------- 天気と位置 ----------
async function refreshWeather() {
  const c = here && settings.geoConsent === "yes" ? here : CITIES[settings.city];
  try { weather = await getWeather(c.lat, c.lon); }
  catch { $("#wxDesc").textContent = "天気を取得できませんでした（通信を確認）"; }
  render();
}

async function startLocation() {
  try {
    here = await getPosition();
    wasAtHome = isAtHome();
    stopWatch();
    stopWatch = watchPosition(onMove);
  } catch {
    toast("位置情報を取得できませんでした。地域の天気を表示します");
    settings.geoConsent = "no"; saveSettings();
  }
  refreshWeather();
}

function onMove(pos) {
  here = pos;
  const now = isAtHome();
  // 自宅にいた → 離れた、の変化を見つけたら通知
  if (wasAtHome === true && now === false && settings.geoNotify && !day.fired.leave) {
    const left = remaining();
    if (left.length) notify(`自宅を出ました。${left[0].name}など未チェックが${left.length}こあります。`);
    day.fired.leave = true; saveDay();
  }
  if (now !== null) wasAtHome = now;
  render();
}

// ---------- 通知（1分ごとに時刻を確認） ----------
async function notify(msg) {
  const ok = await showNotification(msg);
  if (!ok || document.visibilityState === "visible") banner(msg);
}

function checkTime() {
  // 日付が変わったら、その日の記録に切りかえる
  if (todayKey() !== dayKey) { dayKey = todayKey(); day = loadDay(); refreshWeather(); }
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const inWindow = (t) => hm >= t && minutes(hm) - minutes(t) < 60; // 設定時刻から1時間以内

  if (!day.fired.leaveTime && inWindow(settings.tLeave)) {
    const left = remaining();
    if (left.length) notify(`出発前チェック：${left.slice(0, 2).map((i) => i.name).join("、")}など${left.length}こが未チェックです。`);
    day.fired.leaveTime = true; saveDay();
  }
  if (!day.fired.night && inWindow(settings.tNight)) {
    const t = weather?.tomorrow;
    const rain = t && t.rainProb >= 50 ? `明日は${t.text}（降水${t.rainProb}%）。傘を準備しましょう。` : "";
    notify(`${rain}明日の予定を選んで、持ち物を準備しておきましょう。`);
    day.fired.night = true; saveDay();
  }
}
const minutes = (hm) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };

// ---------- 操作 ----------
$("#events").addEventListener("click", (e) => {
  if (e.target.closest("#evOpen")) { openEventForm(); return; }
  const b = e.target.closest("[data-e]"); if (!b) return;
  const name = b.dataset.e;
  day.events = day.events.includes(name) ? day.events.filter((x) => x !== name) : [...day.events, name];
  settings.lastEvents = day.events; saveSettings(); saveDay(); render();
});

// ---------- 予定を自分で追加する ----------
function openEventForm() {
  $("#evForm").hidden = false; $("#evError").hidden = true; render();
  $("#evName").focus();
}
function closeEventForm() {
  $("#evForm").hidden = true; $("#evForm").reset(); render();
  $("#evOpen")?.focus();
}
$("#evCancel").addEventListener("click", closeEventForm);
$("#evForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#evName").value.trim();
  const err = $("#evError");
  if (!name) { err.textContent = "予定の名前を入力してください"; err.hidden = false; return; }
  if (EVENTS.includes(name) || settings.customEvents.some((c) => c.name === name)) {
    err.textContent = `「${name}」はすでにあります。ボタンをタップして選んでください`; err.hidden = false; return;
  }
  // 「、」「,」「，」や改行で区切って、空と重複を取りのぞく（最大10こ）
  const its = [...new Set($("#evItems").value.split(/[、,，\n]/).map((x) => x.trim()).filter(Boolean))].slice(0, 10);
  settings.customEvents.push({ name, items: its });
  day.events = [...day.events, name];
  settings.lastEvents = day.events;
  saveSettings(); saveDay();
  toast(its.length ? `「${name}」を追加しました（持ち物${its.length}こ）` : `「${name}」を追加しました`);
  closeEventForm();
});
$("#myEvents").addEventListener("click", (e) => {
  const b = e.target.closest("[data-del-ev]"); if (!b) return;
  const name = b.dataset.delEv;
  settings.customEvents = settings.customEvents.filter((c) => c.name !== name);
  day.events = day.events.filter((x) => x !== name);
  settings.lastEvents = settings.lastEvents.filter((x) => x !== name);
  saveSettings(); saveDay(); render(); toast(`「${name}」を削除しました`);
});

$("#list").addEventListener("click", (e) => {
  const c = e.target.closest("[data-n]");
  if (c) { const n = c.dataset.n; day.checked[n] = !day.checked[n]; saveDay(); render(); document.querySelector(`[data-n="${CSS.escape(n)}"]`)?.focus(); return; }
  const f = e.target.closest("[data-forgot]");
  if (f) { const n = f.dataset.forgot; history[n] = (history[n] || 0) + 1; save("history", history); render(); toast(`「${n}」を忘れた記録に追加しました。次から上に表示します`); }
});

$("#addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#addInput").value.trim(); if (!v) return;
  if ($("#addScope").value === "always") { if (!customAlways.includes(v)) customAlways.push(v); save("customAlways", customAlways); }
  else if (!day.customToday.includes(v)) { day.customToday.push(v); saveDay(); }
  $("#addInput").value = ""; render(); toast(`「${v}」を追加しました`);
});

$("#geoAllow").addEventListener("click", () => { settings.geoConsent = "yes"; saveSettings(); render(); startLocation(); });
$("#geoDeny").addEventListener("click", () => { settings.geoConsent = "no"; saveSettings(); render(); refreshWeather(); showView("remind"); toast("設定で地域を選べます"); });

$("#notifAllow").addEventListener("click", async () => { await requestPermission(); render(); });
$("#tNight").addEventListener("change", (e) => { settings.tNight = e.target.value; day.fired.night = false; saveSettings(); saveDay(); });
$("#tLeave").addEventListener("change", (e) => { settings.tLeave = e.target.value; day.fired.leaveTime = false; saveSettings(); saveDay(); });
$("#geoNotify").addEventListener("change", (e) => { settings.geoNotify = e.target.checked; saveSettings(); });
$("#testNotify").addEventListener("click", () => {
  const left = remaining();
  notify(left.length ? `${left.slice(0, 2).map((i) => i.name).join("、")}など${left.length}こが未チェックです。` : "持ち物はすべて準備できています。いってらっしゃい！");
});

$("#setHome").addEventListener("click", async () => {
  try { here = await getPosition(); settings.home = { lat: here.lat, lon: here.lon }; wasAtHome = true; saveSettings(); render(); toast("今いる場所を自宅に登録しました"); }
  catch { toast("位置情報を取得できませんでした"); }
});
$("#clearHome").addEventListener("click", () => { settings.home = null; wasAtHome = null; saveSettings(); render(); toast("自宅の登録を消しました"); });

$("#citySel").innerHTML = Object.entries(CITIES).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join("");
$("#citySel").addEventListener("change", (e) => { settings.city = e.target.value; saveSettings(); refreshWeather(); });

$("#icsBtn").addEventListener("click", () => {
  const list = items();
  downloadIcs(`持ち物：${day.events.join("・") || "予定なし"}`, list.map((i) => i.name).join("、"));
});

$("#shareBtn").addEventListener("click", async () => {
  const text = shareText(items());
  if (navigator.share) { try { await navigator.share({ title: "きょうの持ち物", text }); return; } catch { return; } }
  copy(text);
});
$("#copyBtn").addEventListener("click", () => copy(shareText(items())));

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("コピーしました"); }
  catch {
    const r = document.createRange(); r.selectNodeContents($("#shareText"));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("選択しました。コピーしてください");
  }
}

// 記録を消す（画面内で確認してから）
$("#resetBox").addEventListener("click", (e) => {
  const box = $("#resetBox");
  if (e.target.id === "resetBtn") {
    box.innerHTML = `<span class="sub">本当に消しますか？元に戻せません。</span><button class="btn danger" id="resetYes" type="button">消す</button><button class="btn ghost" id="resetNo" type="button">やめる</button>`;
  } else if (e.target.id === "resetYes") {
    clearAll(); location.reload();
  } else if (e.target.id === "resetNo") {
    box.innerHTML = `<button class="btn danger" id="resetBtn" type="button">記録をすべて消す</button>`;
  }
});

// タブ
function showView(v) {
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.v === v)));
  ["today", "lock", "remind", "share"].forEach((id) => { $("#v-" + id).hidden = id !== v; });
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => showView(b.dataset.v)));

// 画面内のバナーと小さなお知らせ
let bt, tt;
function banner(msg) { $("#bannerText").textContent = msg; $("#banner").classList.add("show"); clearTimeout(bt); bt = setTimeout(() => $("#banner").classList.remove("show"), 5000); }
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2200); }

// 時計（ロック画面のイメージ）
function clock() { const d = new Date(); $("#lockClock").textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; }

// ---------- 起動 ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
if (!notifySupported()) $("#notifAllow").hidden = true;
render();
clock();
if (settings.geoConsent === "yes") startLocation(); else refreshWeather();
setInterval(() => { clock(); checkTime(); }, 30 * 1000);
checkTime();
