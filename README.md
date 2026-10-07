# Sotsuken

学校のオンライン授業に特化した、低遅延・双方向のライブ授業アプリ（卒業研究・5人チーム）。

- サーバー：Node.js / Express / Socket.IO（`server/`）
- フロント：Vite + React（`client/`）
- 共有契約：`shared/`（定数・Socket イベント名・API 型）
- DB：MySQL 8（Railway）
- 配信：LiveKit

**作業を始める前に `CLAUDE.md`（開発規約）と `docs/04_API・イベント仕様.md` を読むこと。**
並列開発の進め方は `docs/10_並列開発計画_マネージャー指示書.md`。

## セットアップ

Node.js 20.19 以上（`shared/` の ESM を `require()` するため）。

```
npm install            # ルート・shared・client をまとめて入れる（workspaces）
copy .env.example .env # 値を入れる（.env はコミットしない）
```

`.env` の要点：

| キー | 内容 |
|---|---|
| `PORT` / `CLIENT_PORT` | サーバー / Vite のポート。**worktree ごとに変える**（.env.example の表を参照） |
| `MYSQL_URL` | Railway の MySQL 接続文字列。空でも起動はする（DB を使う API は 500） |
| `LIVEKIT_*` | 未設定でも起動する（token API は url 空で返す） |

### マイグレーション（トーンさんだけが実行する）

```
npm run migrate
```

`server/migrations/*.sql` を名前順に、未適用のものだけ流す。ワーカーは実行しない（Railway の DB を全員で共有しているため）。

### 起動

```
npm run dev          # サーバー（http://localhost:3000、--watch 付き）
npm run dev:client   # 別ターミナルで Vite（http://localhost:5173。/api /socket.io /uploads は 3000 へプロキシ）
```

画面は http://localhost:5173 で見る。`/api/health` が `{"ok":true,"db":true}` なら DB 接続あり。

### 本番（Railway）

```
npm run build        # client/dist を作る
npm start            # prestart で migrate → client/dist を配信（SPA フォールバック付き）
```

## フォルダ構成

```
├── CLAUDE.md                 開発規約（AIにも読ませる）
├── docs/                     設計書（04 が API/イベントの契約）
│   ├── design/               画面デザイン（HTMLモック）
│   ├── requests/             ワーカー間の依頼メモ（結合時に読む）
│   └── 10_並列開発計画_…md    並列開発の手順・所有権表
├── shared/                   契約ファイル（@sotsuken/shared。フェーズ1中は凍結）
│   ├── constants.js          ロール・状態・エラーコード・既定値
│   ├── socket-events.js      Socket イベント名
│   └── api-types.js          API の型（JSDoc）
├── server/
│   ├── migrations/           テーブル定義（番号付き .sql）
│   └── src/
│       ├── index.js          起動口（HTTP + Socket.IO + jobs）
│       ├── app.js            Express
│       ├── routes/           REST（/api）。ファイル＝担当
│       ├── services/         ビジネスロジック（access.js は共通）
│       ├── middleware/       auth / role / class-member / error
│       ├── sockets/          index.js（接続・認証・ルーム）、io.js（送信ヘルパ）、handlers/（自動読込）
│       ├── jobs/             定期処理（自動読込）
│       └── db/               接続プール・マイグレーション実行
├── client/
│   └── src/
│       ├── App.jsx           ルーティング（14画面）
│       ├── api/client.js     fetch ラッパー（401/403/404 の共通処理）
│       ├── socket.js         Socket.IO 接続ラッパー
│       ├── pages/            auth / classes / teach / learn / common
│       ├── components/       shared（共通部品）/ learn（生徒専用）
│       ├── livekit/          LiveKit 部品
│       └── styles/           broadsheet.css（デザイン変数）/ app.css
└── public/                   仮トップ（client/dist が無いときだけ）
```

## スキーマを変えるとき

1. `server/migrations/` に次の番号の `.sql` を足す（適用済みのファイルは書き換えない）
2. 同じ PR で `docs/03_DB設計.md` を更新する
3. `npm run migrate`

## 進め方

- `main` へ直接 push しない。`feature/機能名`（並列開発中は `feat/w1-core` 等）で作業して PR
- コミットメッセージは `種別: 内容`（種別：機能追加／修正／リファクタ／ドキュメント／設定）
- PR の前に AI セルフレビュー（手順は `CLAUDE.md`）

## デプロイ（Railway）

- 起動は `npm start`。その前に `prestart` でマイグレーションが自動で流れる（失敗するとデプロイも失敗する）
- 環境変数：`DATABASE_URL`（MySQL サービスの `MYSQL_URL` を参照）、`SESSION_SECRET`、`NODE_ENV=production`、`LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`、`UPLOAD_DIR`（Volume のマウント先）
