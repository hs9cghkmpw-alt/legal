# PC作業チェックリスト（Windows / PowerShell）

## 前提
- リポジトリ: https://github.com/hs9cghkmpw-alt/legal
- 作業ブランチ: fix/security-queue-2026-10
- **本番デプロイ・実メール送信はまだ行わない。** 情報源の利用条件とプライバシー方針が未確認です。
- HOJO-LETTERの秘密情報をコピーしない。

## ブランチ・テスト
```powershell
Set-Location $HOME\Documents\rule-change-letter
git fetch origin
git switch fix/security-queue-2026-10
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
- プライバシー方針の草案を完成させ、運営者情報・問い合わせ先・保存期間を記載
- デジタル庁RSSの形式と利用・加工・再配信条件を確認し、未確認なら `terms_checked=0`
- e-Gov法令APIと省庁情報源を追加設計
- ローカルテスト、D1移行テスト、実際のメール到達性テスト
- Cloudflare/Brevoの無料枠・レート・規約を確認
- 本番の `BASE_URL`、`PRIVACY_URL`、送信元ドメインを設定
- 未承認記事が送られないこと、配信停止、失敗再試行、20人超のバッチをテスト
