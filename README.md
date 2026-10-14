# Vocx & Dojo

スマートフォン向けの英単語・問題演習アプリです。HTML / CSS / JavaScriptで動作します。

## 別のPCで作業する

Gitが使える環境で取得します。

```sh
git clone https://github.com/syuuga101/vocx2.0-kai.git
cd vocx2.0-kai
```

`index.html`をブラウザで開くと、同梱の学習データで利用できます。Google FontsとFont Awesomeにはインターネット接続が必要です。

Pythonがある場合は、ローカルサーバーでも確認できます。

```sh
python -m http.server 8766 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:8766/` を開いてください。PWAの動作や学習データの再読み込みはHTTPで確認します。

## PCを切り替えるとき

作業前に、未保存の変更がないことを確認して最新の変更を取得します。

```sh
git status
git pull --ff-only
```

作業後は、差分と検証結果を確認し、コミットして送信します。

```sh
git diff --check
node scripts/verify-ui.cjs
node scripts/verify-navigation.cjs
node scripts/verify-feedback.cjs
git diff
git add <変更したファイル>
git commit -m "変更内容"
git push origin main
git status -sb
```

`git status -sb`で変更がなく、`ahead` / `behind`がなければ同期済みです。未コミットの変更や送信失敗が残っている場合は、別PCへ移る前に解決してください。`git pull --ff-only`が失敗した場合は履歴を確認し、強制pushや変更の破棄で解決しないでください。

## ファイル構成

- `index.html`：画面構造
- `ui.css`：テーマ・レイアウト
- `app.js`：出題・判定・保存・操作
- `data.js`：学習データのフォールバック
- `vocx/`・`dojo/`：学習データ
- `sw.js`：PWAキャッシュ。配信ファイルを更新するときは`CACHE_NAME`も更新します。
- `design/mode-icons/`：未採用のモードアイコン5案。SVGと比較画像。
- `scripts/`：Node.jsで実行する簡易検証

## 保存データと認証情報

学習履歴・プロフィール名・設定はブラウザのlocalStorageに保存します。GitHub経由では別PCへ同期されません。

APIキーやパスワードはコードや学習データに書き込まないでください。`.env`・認証ファイル・秘密鍵・ローカル出力などは`.gitignore`で除外しています。`.env.example`等のテンプレートにはダミー値だけを記載してください。

このアプリは現時点でAPIキーやサーバー側の認証を必要としません。
