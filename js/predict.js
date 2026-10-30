// 持ち物予測エンジン
// 入力（天気・予定・忘れ物の記録・自分で追加した物）から、持ち物と「選んだ理由」のリストを作る。
// ルールはデータとして下にまとめてあるので、持ち物を増やしたいときはここを書きかえればよい。

// 予定の一覧（画面のボタンになる）
export const EVENTS = ["出社", "会議・プレゼン", "出張", "外回り営業", "ジム", "飲み会", "リモート"];

// どの日でも外出するなら持つ物
const BASE_ITEMS = [
  { name: "スマホ", why: "毎日の必需品" },
  { name: "財布", why: "毎日の必需品" },
  { name: "家の鍵", why: "毎日の必需品" },
  { name: "ハンカチ・ティッシュ", why: "外出する日の基本" },
];

// 予定ごとに必要な物
const EVENT_ITEMS = {
  "出社": [{ name: "社員証", why: "出社する日" }],
  "会議・プレゼン": [
    { name: "ノートPC", why: "会議で使う" },
    { name: "PCの充電器", why: "会議が続く日に" },
    { name: "HDMI変換アダプタ", why: "会議室のモニターにつなぐ" },
  ],
  "出張": [
    { name: "名刺", why: "出張先であいさつ" },
    { name: "新幹線・飛行機のチケット", why: "出張の移動" },
    { name: "着替え・洗面用具", why: "泊まりの出張に" },
    { name: "PCの充電器", why: "出張先で作業" },
  ],
  "外回り営業": [
    { name: "名刺", why: "取引先を訪問" },
    { name: "訪問先の資料", why: "営業先で説明" },
  ],
  "ジム": [
    { name: "トレーニングウェア", why: "ジムに行く日" },
    { name: "シューズ", why: "ジムで使う" },
  ],
  "飲み会": [{ name: "現金", why: "割り勘の支払いに" }],
  "リモート": [],
};

// 天気の条件（when が true のとき items を追加する）
const WEATHER_RULES = [
  { when: (w) => w.rainProb >= 50, items: (w) => [
      { name: "折りたたみ傘", why: `降水確率${w.rainProb}%の予報` },
      { name: "タオル", why: "雨でぬれたときに" },
  ] },
  { when: (w) => w.rainProb >= 30 && w.rainProb < 50, items: (w) => [
      { name: "折りたたみ傘", why: `降水確率${w.rainProb}%。念のため` },
  ] },
  { when: (w) => w.tMin <= 5, items: (w) => [
      { name: "マフラー・手袋", why: `最低気温${w.tMin}℃。冷え込みます` },
      { name: "カイロ", why: "朝晩の寒さ対策" },
  ] },
  { when: (w) => w.tMax >= 30, items: (w) => [
      { name: "飲み物", why: `最高気温${w.tMax}℃。熱中症対策` },
      { name: "日傘・帽子", why: "日差しが強い予報" },
  ] },
];

/**
 * 持ち物を予測する
 * @param {object} p
 * @param {string[]} p.events   きょうの予定
 * @param {object|null} p.weather {rainProb, tMax, tMin}
 * @param {object} p.history    { 持ち物名: 忘れた回数 }
 * @param {string[]} p.custom   自分で追加した物
 * @param {{name:string, items:string[]}[]} [p.customEvents] 自分で追加した予定と、その予定の持ち物
 * @returns {{name:string, why:string, tag:string}[]}
 */
export function predict({ events, weather, history, custom, customEvents = [] }) {
  const list = [];
  const add = (item, tag) => {
    if (!list.some((x) => x.name === item.name)) list.push({ ...item, tag }); // 重複は追加しない
  };
  const goOut = !(events.length === 1 && events[0] === "リモート"); // リモートだけの日は外出しない

  if (goOut) BASE_ITEMS.forEach((i) => add(i, "基本"));
  else add({ name: "スマホ", why: "毎日の必需品" }, "基本");

  // 予定の数だけくり返して、予定ごとの持ち物を追加
  for (const e of events) {
    if (EVENT_ITEMS[e]) { EVENT_ITEMS[e].forEach((i) => add(i, "予定")); continue; }
    // 自分で追加した予定なら、登録した持ち物を使う
    const mine = customEvents.find((c) => c.name === e);
    if (mine) mine.items.forEach((name) => add({ name, why: `「${e}」の予定で使う` }, "予定"));
  }

  // 天気の条件分岐（外出する日だけ）
  if (weather && goOut) {
    for (const rule of WEATHER_RULES) if (rule.when(weather)) rule.items(weather).forEach((i) => add(i, "天気"));
  }

  custom.forEach((name) => add({ name, why: "自分で追加した持ち物" }, "自分"));

  // 忘れた回数を理由に加え、多い順に先頭へ並べる（学習）
  for (const item of list) {
    const n = history[item.name] || 0;
    if (n > 0) { item.forgot = n; item.why = `これまでに${n}回忘れています・` + item.why; item.tag = "学習"; }
  }
  list.sort((a, b) => (b.forgot || 0) - (a.forgot || 0));
  return list;
}
