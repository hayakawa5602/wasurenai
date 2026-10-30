# わすれナシ

天気・予定・忘れ物の記録から、その日に必要な持ち物を教える「忘れ物ゼロ」アプリです。
スマートフォンのブラウザで動くWebアプリ（PWA）で、ホーム画面に追加するとアプリのように使えます。

## ファイルの構成

```
wasurenashi-app/
├─ index.html            画面の骨組み
├─ css/style.css         見た目（ダークモード対応）
├─ js/
│  ├─ app.js             画面の表示と操作をまとめるメインの処理
│  ├─ predict.js         持ち物予測エンジン（ルールはここを書きかえる）
│  ├─ weather.js         天気の取得（Open-Meteo API）
│  ├─ location.js        位置情報と距離の計算（ハーバーサインの公式）
│  ├─ notify.js          通知
│  ├─ calendar.js        カレンダー登録（Googleカレンダー・.icsファイル）
│  └─ storage.js         スマホの中への保存（localStorage）
├─ sw.js                 Service Worker（オフライン表示・通知タップ）
├─ manifest.webmanifest  ホーム画面に追加するための設定
└─ icons/                アプリのアイコン
```

## 公開のしかた（GitHub Pages）

位置情報と通知は **HTTPS** のページでしか動きません。GitHub Pages なら無料でHTTPSになります。

1. GitHubで新しいリポジトリを作る（例：`wasurenashi`、Public）
2. このフォルダの中身をすべてアップロードする（「Add file」→「Upload files」）
3. 「Settings」→「Pages」→ Branch を `main`、フォルダを `/ (root)` にして「Save」
4. 数分後に `https://ユーザー名.github.io/wasurenashi/` で開けるようになる
5. スマホで開き、共有メニューから「ホーム画面に追加」

応募用紙の「ソースコード格納先」には、このリポジトリのURLを書けます（Publicにすれば審査員が登録なしで見られます）。

## パソコンで試すとき

ファイルをダブルクリックで開くと、JavaScriptのモジュールが読み込めず動きません。フォルダの中で次のどちらかを実行し、`http://localhost:8000` を開いてください（localhost は位置情報も使えます）。

```
python -m http.server 8000
```

または VS Code の拡張機能「Live Server」を使います。

## 機能

| 機能 | 使っている技術 | 備考 |
|---|---|---|
| 持ち物の予測と理由の表示 | JavaScriptの条件分岐・くり返し | `predict.js` のルール |
| 予定を自分で追加 | 予定の名前と持ち物をスマホ内に保存 | 「＋ 予定を追加」。削除は「通知・設定」 |
| 忘れ物の学習 | 忘れた回数をスマホ内に記録し、多い順に並べる | 「忘れた」ボタン |
| 天気 | Open-Meteo API（無料・APIキー不要） | 1時間ごとに更新 |
| 現在地・家を出たら通知 | Geolocation API、2地点の距離計算 | 自宅から200mで判定 |
| リマインダー | Notification API、Service Worker | 前日夜・出発前 |
| カレンダー | GoogleカレンダーのURL、.icsファイル | iPhone・Outlookは.ics |
| 共有 | Web Share API（使えなければコピー） | |
| ロック画面ウィジェット | 画面イメージのみ | 下の「できないこと」参照 |

## 持ち物のルールを変えるには

`js/predict.js` の `EVENT_ITEMS`（予定ごとの持ち物）と `WEATHER_RULES`（天気の条件）を書きかえます。
予定を増やすときは `EVENTS` にも名前を追加してください。

## Webアプリでできないこと（発表で聞かれたときのために）

- **アプリを閉じているときの通知**：ブラウザだけでは、決まった時刻に通知を出せません。アプリを開いている（ホーム画面から起動中）ときに通知します。閉じていても届けるには、プッシュ通知用のサーバー（Web Push）が必要です。
- **ロック画面ウィジェット**：iPhone・Androidのネイティブアプリでしか作れません。画面イメージで見せています。
- **iPhoneの通知**：iOS 16.4以降で、ホーム画面に追加したときだけ使えます。

## プライバシーとデータ

- 位置情報は、利用者が「使う」を選んだときだけ使います。天気APIには緯度・経度を小数第2位（約1km）に丸めて送り、それ以外には送りません。
- 自宅の位置、チェックの状態、忘れ物の記録は、スマホの中（localStorage）だけに保存します。「通知・設定」の「記録をすべて消す」で消せます。
- サーバーやアカウントはありません。

## 利用しているもの・ライセンス

- 天気データ：[Open-Meteo.com](https://open-meteo.com/)（CC BY 4.0）— 画面の下に出典を表示しています
- フォント：Google Fonts（Zen Kaku Gothic New、Zen Maru Gothic、JetBrains Mono／SIL Open Font License）
- アイコン：自作
