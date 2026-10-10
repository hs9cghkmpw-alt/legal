# PC作業チェックリスト（Windows / PowerShell）

## 前提
- リポジトリ: https://github.com/hs9cghkmpw-alt/legal
- ブランチ: mvp/scaffold-2026-10
- 本番デプロイはまだ行わない。HOJO-LETTERの秘密情報をコピーしない。

## 環境確認
```powershell
node --version
npm --version
git --version
npx wrangler --version
```

## clone / ブランチ
```powershell
Set-Location $HOME\Documents
git clone https://github.com/hs9cghkmpw-alt/legal.git rule-change-letter
Set-Location .\rule-change-letter
git fetch origin
git switch mvp/scaffold-2026-10
```
すでにclone済みならcloneを繰り返さず git status / git branch --all で確認。

## 依存関係とローカル設定
```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
```
.dev.vars に BREVO_API_KEY、ADMIN_TOKEN（32文字以上のランダム値）、BASE_URL、SENDER_EMAIL を設定。秘密値はGitHubやチャットに貼らない。

## D1作成・ローカル起動
```powershell
npx wrangler login
npx wrangler d1 create rule-change-letter
# 出力された database_id を wrangler.toml に設定
npx wrangler d1 execute rule-change-letter --local --file=./schema.sql
npx wrangler dev
```
別PowerShellで:
```powershell
Invoke-RestMethod http://localhost:8787/health
Invoke-RestMethod http://localhost:8787/api/categories
```

## 本番前に必須
- 情報源の利用・加工・再配信条件を確認し、未確認なら terms_checked=0 のまま
- RSS形式を実データで検証
- 登録→確認メール→確認→配信停止をテスト
- 誤った管理トークンで401になることを確認
- 未承認記事が配信されないことを確認
- 20人超の複数バッチ処理を実装してから利用者を増やす
- プライバシー方針、運営者情報、ボット対策、送信元認証を整備
- 無料枠と利用条件を確認

## 未完成
- 管理者向け承認UI（管理APIのみ）
- 登録者向けカテゴリ編集画面（初期登録フォームのみ）
- e-Gov法令APIの更新検知と省庁情報源の拡張
- 施行日・対象者の自動抽出と原文照合
- 無料AI/ローカルAI検証
- レート制限・Turnstile等のボット対策
- 20人超の配信キュー・複数バッチ処理
