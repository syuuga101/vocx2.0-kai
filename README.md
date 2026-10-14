# Vocx & Dojo

スマートフォン向けの英単語・問題演習アプリです。HTML / CSS / JavaScriptで動作します。

## ファイル構成

- `index.html`：画面構造
- `ui.css`：テーマ・レイアウト
- `app.js`：出題・判定・保存・操作
- `data.js`：学習データのフォールバック
- `vocx/`・`dojo/`：学習データ
- `sw.js`：PWAキャッシュ。配信ファイルを更新するときは`CACHE_NAME`も更新します。
- `design/mode-icons/`：未採用のモードアイコン5案。SVGと比較画像。
- `scripts/`：Node.jsで実行する簡易検証
