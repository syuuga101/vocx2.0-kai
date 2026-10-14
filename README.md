# Vocx & Dojo

スマートフォン向けの英単語・問題演習アプリです。HTML / CSS / JavaScriptで動作します。

Vocxの「鬼モード」は、ユニットの20語を1回ずつ出題し、日本語→英単語4択・英文空欄4択・英文空欄入力をランダムな順番で混ぜます。各形式は6〜7問ずつです。途中保存・再開と全問正解の記録にも対応しています。

## ファイル構成

- `index.html`：画面構造
- `ui.css`：テーマ・レイアウト
- `app.js`：出題・判定・保存・操作
- `data.js`：学習データのフォールバック
- `vocx/`・`dojo/`：学習データ
- `sw.js`：PWAキャッシュ。配信ファイルを更新するときは`CACHE_NAME`も更新します。
- `design/mode-icons/`：未採用のモードアイコン5案。SVGと比較画像。
- `scripts/`：Node.jsで実行する簡易検証

## 学習データの更新

`vocx/*.csv`・`dojo/*/part*.json`を編集したら、`node scripts/build-data.cjs`で軽量な`data.js`を再生成します。直接HTMLを開く場合やオフライン時も最新データを使えるよう、生成したファイルも一緒に保存してください。HTTP配信時は引き続きCSV・JSONを読み込みます。

PWAは画像・通常の音声取得をキャッシュ優先、HTML・CSS・JavaScript・学習データはネットワーク優先で読み込みます。更新時は`sw.js`の`CACHE_NAME`を変更してください。

検証はプロジェクトのルートで`node scripts/verify-*.cjs`を各ファイルについて実行します。
