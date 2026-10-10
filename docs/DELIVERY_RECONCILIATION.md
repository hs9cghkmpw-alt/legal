# 配信結果不明キューの照合手順

メール配信の重複を避けつつ、sending または failed のキューを復旧するための管理者向け手順です。公開運用前にステージング相当の環境で検証してください。

## 1. 未解決キューを確認

- GET /api/admin/delivery-issues — sending / failed の最大100件を表示します。
- POST /api/admin/reconcile-delivery — 事業者ログの確認後に限り、1件ずつ確定または再試行します。
- 管理者トークンは安全な環境変数 ADMIN_TOKEN から読み込み、コマンド履歴やログへ直接記載しないでください。

PowerShellでは、$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" } を設定してから、Invoke-RestMethod -Method Get -Uri "$env:BASE_URL/api/admin/delivery-issues" -Headers $headers で一覧を取得できます。

## 2. 配信済みに確定

事業者側の配信ログで該当メールが受理されたことを確認できた場合のみ実行します。queue_id は一覧の id です。

POST /api/admin/reconcile-delivery に次のJSONを送信します。

{ "queue_id": 123, "action": "mark_sent", "provider_confirmed_accepted": true }

この操作は配信履歴 sent を登録し、キューを sent にします。事業者ログを確認せずに実行しないでください。

## 3. 未送信を確認できた場合のみ再試行

事業者ログで受理されていないことを確認し、対象メールを送信していたWorkerが終了していることを確認した場合に限ります。sending 状態の行は送信開始から20分以上経過している必要があり、配信ロックが有効な間は操作できません。

POST /api/admin/reconcile-delivery に次のJSONを送信します。

{ "queue_id": 123, "action": "retry_confirmed_not_sent", "provider_confirmed_not_accepted": true }

この操作はキューを pending に戻し、試行回数をリセットします。未送信を確認できない場合は再試行せず、保留してください。

## 4. 注意点

- ADMIN_TOKEN は32文字以上の秘密値とし、公開URL・ソースコード・ログ・チャットに貼り付けないこと。
- 管理APIはHTTPSでのみ利用すること（localhostのローカル検証を除く）。
- この機能は事業者ログを自動取得しません。管理者が事業者側ログを確認して判断します。
- メール事業者とD1間の分散トランザクションはないため、厳密な exactly-once 配信は保証できません。
- 現在は未デプロイです。schema.sql は新規ローカルDB向けであり、既存DBに直接再実行しないでください。既存DBへ適用する場合は別途レビュー済みの移行SQLが必要です。