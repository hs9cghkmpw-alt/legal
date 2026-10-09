# 暮らしのルール変更レター（MVP）

法律・行政制度・生活に関わる重要ルールの変更を生活者向けに整理する、0円開発を目標とした試作です。

## 実装済み

- `GET /`: D1に保存された更新法令候補の一覧
- `GET /api/health`: 稼働確認とD1設定状態
- `GET /api/updates`: 保存済み更新情報のJSON
- `POST /api/collect`: トークン認証付きの手動収集
- Cron: 毎日、e-Gov法令API v1の更新法令一覧を直近3日分確認
- D1への重複排除付き保存
- `schema.sql`: 初期データベース設計

この段階では法律・政令・省令等の「更新候補」を収集します。生活への影響度の判定、行政ニュース、AI解説、メール配信はまだ未実装です。検知されたものがすべて重要な改正とは限りません。

## 0円運用方針

- 有料APIを使わない
- Workers / D1 の無料枠内で小さく運用する
- AI APIは接続しない
- Brevo等のメール配信は、無料枠と利用条件を確認してから追加する
- 補助金レターの本番DBを絶対に共有しない

無料枠・制限は変更される場合があります。デプロイ前に現在のプラン条件を確認してください。

## セットアップ

必要なのはGit、Node.js、PowerShellです。まずバージョンを確認します。

```powershell
git --version
node --version
npm --version
```

Windows PowerShellでリポジトリをクローンして作業する場合：

```powershell
git clone -b mvp-prototype https://github.com/hs9cghkmpw-alt/legal.git
Set-Location .\legal
npm init -y
npm install --save-dev wrangler
npx wrangler --version
npx wrangler login
```

既に `legal` フォルダがある場合は、二重にクローンせず、そのフォルダで `git status` と `git branch --show-current` を確認してください。

Cloudflareに新しいD1を作成します（既存の補助金レター用DBは指定しないでください）。

```powershell
npx wrangler d1 create legal-change-letter
```

表示された `database_id` を `wrangler.toml` の `REPLACE_WITH_NEW_DATABASE_ID` に設定し、保存します。編集には次を使えます。

```powershell
notepad .\wrangler.toml
```

**必ず専用D1のIDを設定**してください。補助金レター用DBのIDは使わないでください。次にスキーマを適用します。

```powershell
npx wrangler d1 execute legal-change-letter --remote --file=./schema.sql
```

手動収集APIを使う場合は、十分に長いランダムなトークンを設定します。

```powershell
npx wrangler secret put COLLECT_TOKEN
```

入力を求められたらランダムな秘密値を貼り付けます。トークンをコードやGitに保存しないでください。

データベースの作成・スキーマ適用後、テーブルができたか確認します。

```powershell
npx wrangler d1 execute legal-change-letter --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

ローカル確認：

```powershell
npx wrangler dev
```

別のPowerShellウィンドウでローカル応答を確認できます（開発サーバーが起動している間）。

```powershell
Invoke-RestMethod http://localhost:8787/api/health
Invoke-RestMethod http://localhost:8787/api/updates
```

公開する場合：

```powershell
npx wrangler deploy
```

デプロイ後の確認先：
- `/`：更新候補一覧
- `/api/health`：DB接続設定の有無
- `/api/updates`：保存データ

手動収集は `POST /api/collect` に `Authorization: Bearer <COLLECT_TOKEN>` ヘッダーを付けて実行します。ブラウザからトークンなしで呼び出せるようにはしないでください。

## データソース

e-Gov法令APIの更新法令一覧取得APIを利用します：
https://laws.e-gov.go.jp/api/1/updatelawlists/

取得は日次で直近3日を確認し、同じ内容はハッシュキーで重複登録を避けます。API応答が想定外の場合はログで確認してください。APIの利用条件や仕様変更も定期的に確認します。

## 次の開発順

1. 収集結果の実データ検証（法令ID・改正法令名・公布日・施行日）
2. 法律／行政制度／生活ルールの分類と重要度判定
3. 人が確認するための承認画面
4. 無料で使える範囲を確認したうえでメール配信を接続
5. AI解説は無料のローカルモデル等の実行可能性を検証してから追加

## 法的注意

本サービスは一般情報の整理を目的とし、個別案件への法的助言ではありません。公布日と施行日を区別し、原文を確認できない情報や施行日が不明確な情報を自動で断定・配信しないでください。
