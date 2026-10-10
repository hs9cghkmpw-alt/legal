# ルール変更レター（MVP）

個人・法人を区別せず、登録時に選んだ立場からカテゴリを提案し、利用者が選択したカテゴリに合うルール変更情報を週1回メール配信するサービスの叩き台です。

## 方針
- 開発費・運用費0円を優先。無料枠・利用条件を超える場合は機能を縮小し、自動課金しない。
- Cloudflare Workers + D1。外部AI APIは初期版で使用しない。
- 公式情報は一元収集し、記事を一度整理。利用者ごとに配信カテゴリだけを照合。
- 新着記事は pending として保存し、管理者承認まで配信しない。
- 情報源の利用・加工・再配信条件を確認するまで取得を有効化しない。

## 現状
未デプロイの開発用スキャフォールド。D1作成、Secret設定、実データ試験、情報源の利用条件確認、セキュリティ確認は未実施です。

## 開発（PowerShell）
```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
npx wrangler d1 create rule-change-letter
# 表示された database_id を wrangler.toml に設定
npx wrangler d1 execute rule-change-letter --local --file=./schema.sql
npx wrangler dev
```

## 主要ルート
- GET / : 登録ページ
- GET /api/categories : 立場・カテゴリ定義
- POST /api/subscribe : 登録申請
- GET /confirm?token=... : メール確認
- GET /unsubscribe?token=... : 配信停止
- GET /api/admin/collect : 収集（Bearerトークン必須）
- GET /api/admin/updates : 承認待ち記事一覧（Bearerトークン必須）
- POST /api/admin/approve : 記事承認（Bearerトークン必須）
- GET /api/admin/send : 手動配信（Bearerトークン必須）
- GET /health : ヘルスチェック

公開前に情報源の利用条件、プライバシー方針、ボット対策、メール送信元認証、配信停止、公布日と施行日の区別、Cloudflare/Brevo無料枠を確認してください。
