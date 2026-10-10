# PC作業チェックリスト（Windows / PowerShell）

## 前提
- リポジトリ: https://github.com/hs9cghkmpw-alt/legal
- 作業ブランチ: main
- **本番デプロイ・実メール送信はまだ行わない。** 情報源の利用条件とプライバシー方針が未確認です。
- HOJO-LETTERの秘密情報をコピーしない。

## ブランチ・テスト
PR #15 の作業内容を確認する場合は、mainではなく作業ブランチを使います。PRがマージされるまでは main に切り替えないでください。
```powershell
Set-Location $HOME\Documents\rule-change-letter
git fetch origin
git switch feat/brand-and-landing-redesign
git pull
npm install
npm test
node --check .\src\index.js
```
まだcloneしていない場合は、先に `git clone https://github.com/hs9cghkmpw-alt/legal.git rule-change-letter` を実行してください。

## 実データ応答の確認（読み取り専用）
本番デプロイやD1書き込みをせず、e-Gov APIとデジタル庁RSSの実応答だけ確認します。

```powershell
# e-Gov法令API Version 2: 民法の検索例
$api = 'https://laws.e-gov.go.jp/api/2/laws?law_title=%E6%B0%91%E6%B3%95&limit=1&response_format=json'
$data = Invoke-RestMethod -Uri $api -Headers @{ Accept = 'application/json' }
$data | Select-Object total_count, count, next_offset
$data.laws[0] | ConvertTo-Json -Depth 8

# デジタル庁RSS: HTTPステータスと先頭部分だけ確認
$feed = Invoke-WebRequest -Uri 'https://www.digital.go.jp/rss/news.xml' -UseBasicParsing
$feed.StatusCode
$feed.Content.Substring(0, [Math]::Min(800, $feed.Content.Length))
```

確認点：
- e-Gov応答に `laws` 配列があり、`law_info.law_id`、`revision_info`、`current_revision_info` 等がどの形で入るか。
- RSSがHTTP 200でXMLを返すか。
- ここで確認しても、利用条件の最終判断が済むまでは `terms_checked=0` のままにする。
- 結果に個人情報・秘密情報は含まれない想定ですが、出力全体を公開Issueへ貼らず、必要なフィールドだけ確認する。
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
登録APIは有効なHTTPSの PRIVACY_URL と SIGNUP_ENABLED=true の両方がそろうまで登録を拒否します。SIGNUP_ENABLED は公開前チェック完了まで false のままにしてください。ローカル検証でも安易に有効化せず、実メール送信・外部公開は行わないでください。

## 人が確認すべき項目
- docs/SOURCE_REUSE_REVIEW.md を読み、情報源ごとの利用条件の未解決点を確認。最終判断が済むまで terms_checked=0 を維持
- docs/EDITORIAL_QA.md のチェックリストを使い、実データ候補5件を公式原文と照合。記録が揃うまでサンプルを公開せず、配信しない
- 公開環境の `BASE_URL` を実際のWorker URL（HTTPS）に設定し、localhostがメール本文に入らないことを確認
- プライバシー方針の草案を完成させ、運営者情報・問い合わせ先・保存期間・Cloudflare/Brevoの処理内容・ログ/バックアップ保持を記載
- デジタル庁RSSとe-Gov法令API Version 2の利用条件・例外・出典表記を確認し、未確認なら `terms_checked=0`
- e-Gov法令APIの実データ応答・改正候補・施行日を原文と照合。テスト成功だけでは実データ取得を確認したことにならない
- ローカルテスト、D1移行テスト、実際のメール到達性テスト
- Cloudflare/Brevoの無料枠・レート・規約を確認
- 本番の `BASE_URL`、`PRIVACY_URL`、送信元ドメインを設定
- 未承認記事が送られないこと、配信停止、登録情報削除、失敗再試行、登録者50人超のキュー作成と配信20人超のバッチをテスト
