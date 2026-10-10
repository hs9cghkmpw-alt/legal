# ルール変更レター（MVP）

個人・法人を分けず、登録時に立場からカテゴリを提案し、利用者が選んだカテゴリに合うルール変更情報を届ける試作版です。

## 現状・制限
- 未デプロイ。実データ、実メール、無料枠、セキュリティの検証は未実施。
- 情報源候補はデジタル庁RSSと e-Gov法令API Version 2。両方とも利用条件確認前は `terms_checked=0` のまま収集停止。\n- e-Gov APIは直近の公布情報から改正候補を作る実装を追加中。取得上限があるため全件検出を保証せず、記事は承認待ちとして保存し、改正内容・施行日・経過措置は原文確認が必要。
- 外部AI APIは未使用。記事の原文確認・解説入力・承認は手作業。
- プライバシー方針のHTTPS URLが設定されるまで登録APIは登録を拒否。
- 配信対象のキュー作成も50登録者ずつ再開可能なバッチで処理し、10分ごとに継続。実際のメール送信は1回最大20人、送信失敗は最大5回まで再試行。
- メールサービスが受理した直後にWorkerが停止する場合など、重複配信のリスクを完全には排除できない。
- 無料枠の維持・自動課金なしは、Cloudflareとメール配信サービスの設定・規約確認が必要。

## ローカル開発
```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
npm test
npx wrangler d1 execute rule-change-letter --local --file=./schema.sql
npx wrangler dev
```

このプロジェクトは未デプロイの試作版です。新規のローカルDBで `schema.sql` を使用してください。既存D1データベースがすでにある場合は、現時点で安全な移行SQLが同梱されていないため、`schema.sql` を再実行せず作業を止めてください。

## 管理API
- `POST /api/admin/collect` — 収集（Bearerトークン必須）
- `GET /api/admin/updates` — 承認待ち記事一覧（Bearerトークン必須）
- `POST /api/admin/approve` — 記事承認（Bearerトークン必須）
- `POST /api/admin/send` — キュー作成と最大20人の即時処理（Bearerトークン必須）

## URL設定
- ローカル開発では `.dev.vars` の `BASE_URL=http://localhost:8787` を使用します。
- 公開環境では `BASE_URL` に実際のWorkerのHTTPS URLを明示設定してください。未設定・HTTPの公開URLでは登録を拒否し、確認メールにlocalhostリンクが入る事故を防ぎます。

## 公開前必須
情報源の利用条件、プライバシー方針、運営者情報、ボット対策、メール送信元認証、Cloudflare/Brevoの無料枠、Cron制限、バックアップ、配信停止を確認してください。公布日と施行日を混同しないこと。
