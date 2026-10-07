# Sotsuken

学校のオンライン授業に特化した、低遅延・双方向のライブ授業アプリ（卒業研究・5人チーム）。

- サーバー：Node.js / Express / Socket.IO
- DB：MySQL 8
- 配信：LiveKit
- フロント：ビルド不要の素の HTML/CSS/JS（`public/`）

**作業を始める前に `CLAUDE.md`（開発規約）と `docs/04_API・イベント仕様.md` を読むこと。**

## セットアップ

Node.js 20 以上と MySQL 8 が必要。

```
npm install
```

`.env.example` を `.env` にコピーして値を入れる（`.env` はコミットしない）。

```
DATABASE_URL=mysql://ユーザー:パスワード@localhost:3306/sotsuken
SESSION_SECRET=適当な長い文字列
```

データベースを作ってテーブルを用意する。

```
CREATE DATABASE sotsuken DEFAULT CHARACTER SET utf8mb4;
```

```
npm run migrate
```

起動する。

```
npm run dev
```

http://localhost:3000 を開いて「API の状態：OK（DB 接続あり）」と出れば成功。
`DATABASE_URL` が空でもサーバーは起動する（DB を使う機能は動かない）。

## フォルダ構成

```
├── CLAUDE.md            開発規約（AIにも読ませる）
├── docs/                設計書
│   └── design/          画面デザイン（HTMLモック。各フォルダの index.html を開く）
├── server/
│   ├── src/
│   │   ├── index.js     起動口（HTTP + Socket.IO）
│   │   ├── app.js       Express アプリ
│   │   ├── routes/      REST API（/api）
│   │   ├── sockets/     Socket.IO イベント
│   │   ├── jobs/        出席タイマーなどの定期処理
│   │   ├── middleware/  認証・エラー
│   │   └── db/          接続プール・マイグレーション実行
│   └── migrations/      テーブル定義（番号付き .sql）
└── public/              フロント
```

## スキーマを変えるとき

1. `server/migrations/` に次の番号の `.sql` を足す（例：`002_add_xxx.sql`）。適用済みのファイルは書き換えない
2. 同じ PR で `docs/03_DB設計.md` を更新する
3. `npm run migrate`

## 進め方

- `main` へ直接 push しない。`feature/機能名` ブランチを切って PR を出す
- コミットメッセージは `種別: 内容`（種別：機能追加／修正／リファクタ／ドキュメント／設定）
- PR の前に AI セルフレビュー（手順は `CLAUDE.md`）

## デプロイ（Railway）

- 起動は `npm start`。その前に `prestart` でマイグレーションが自動で流れる（失敗するとデプロイも失敗する）
- 環境変数：`DATABASE_URL`（MySQL サービスの `MYSQL_URL` を参照）、`SESSION_SECRET`、`NODE_ENV=production`、`LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`、`UPLOAD_DIR`（Volume のマウント先）
