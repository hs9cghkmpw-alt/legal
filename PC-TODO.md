# PC作業チェックリスト（Windows / PowerShell）

## 前提
- リポジトリ: https://github.com/hs9cghkmpw-alt/legal
- 作業ブランチ: main
- **本番デプロイ・実メール送信はまだ行わない。** 情報源の利用条件とプライバシー方針が未確認です。
- HOJO-LETTERの秘密情報をコピーしない。

## ブランチ・テスト
```powershell
Set-Location $HOME\Documents\rule-change-letter
git fetch origin
git switch main
git pull
npm install
npm test
node --check .\src\index.js
```
まだcloneしていない場合は、先に `git clone https://github.com/hs9cghkmpw-alt/legal.git rule-change-letter` を実行してください。

## ローカルDB
新規ローカルDB：
```powershell
npx wrangler d1 execute rule-change-letter --local --file=./schema.sql
```
このプロジェクトは未デプロイの試作版です。新規ローカルDBだけ `schema.sql` で初期化してください。既存のD1 DBがある場合は、このブランチに安全な移行SQLが同梱されていないため、`schema.sql` を再実行せず作業を止めてください。

## 起動
```powershell
Copy-Item .dev.vars.example .dev.vars
npx wrangler dev
```
登録APIは有効なHTTPSの `PRIVACY_URL` が設定されるまで登録を拒否します。公開用方針を完成・公開してから設定してください。

## 人が確認すべき項目
- 公開環境の `BASE_URL` を実際のWorker URL（HTTPS）に設定し、localhostがメール本文に入らないことを確認
- プライバシー方針の草案を完成させ、運営者情報・問い合わせ先・保存期間・Cloudflare/Brevoの処理内容・ログ/バックアップ保持を記載
- デジタル庁RSSとe-Gov法令API Version 2の利用条件・例外・出典表記を確認し、未確認なら `terms_checked=0`
- e-Gov法令APIの実データ応答・改正候補・施行日を原文と照合。テスト成功だけでは実データ取得を確認したことにならない
- ローカルテスト、D1移行テスト、実際のメール到達性テスト
- Cloudflare/Brevoの無料枠・レート・規約を確認
- 本番の `BASE_URL`、`PRIVACY_URL`、送信元ドメインを設定
- 未承認記事が送られないこと、配信停止、登録情報削除、失敗再試行、登録者50人超のキュー作成と配信20人超のバッチをテスト
