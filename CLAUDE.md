# CLAUDE.md — チーム開発規約

> このファイルはリポジトリ直下に置く。**AI（Claude Code 等）に作業させる前に必ず読み込ませること。**
> 人間もこの規約に従う。

## プロジェクト概要

学校のオンライン授業に特化した低遅延・双方向ライブ授業アプリ（卒業研究・5人チーム開発）。
ロールは先生/生徒。生徒のカメラ映像は先生にのみ届く（購読制御は基盤側で強制）。全員ログイン必須。
設計の詳細は `docs/` 配下を参照：
- 要件：`docs/01_要件定義.md`
- 構成：`docs/02_システム構成.md`
- DB：`docs/03_DB設計.md`
- API/イベント契約：`docs/04_API・イベント仕様.md` ←**必読。ここに無いAPI/イベントを勝手に追加しない**

## 技術スタック

- サーバー：Node.js / Express / Socket.IO（`server/`）。`package.json` はリポジトリ直下に1つ
- フロント：`client/` 配下（**Vite + React + react-router**。並列開発計画 `docs/10_並列開発計画_マネージャー指示書.md` §7 の判断）。見た目は `docs/design/` の画面デザイン（HTMLモック）に合わせ、色・余白は `client/src/styles/broadsheet.css` の変数から取る。`public/` は仮トップのみ（`client/dist` が無いときだけ配信）
- 共有契約：`shared/`（`@sotsuken/shared`）。定数・Socket イベント名・API 型。**イベント名・エラーコードの文字列を直書きしない**。フェーズ1中は凍結（変更は @manager に相談）
- DB：MySQL 8（アクセスは `server/src/db/` のモジュール経由のみ。SQL の値は必ずプレースホルダ `?` で渡す）
- ログイン状態：`express-session`（保存先は MySQL）。`req.session.user = { id, name, role }`。権限チェックは `server/src/middleware/auth.js`（ログイン）・`role.js`（先生/生徒）・`class-member.js`（クラス所属、403）を使う。自前の所属チェックを書かない
- Socket 送信：REST やジョブから送るときは `server/src/sockets/io.js` の `emitToLesson / emitToTeachers / emitToStudents`。イベントハンドラは `server/src/sockets/handlers/*.js`（自動読込）、定期処理は `server/src/jobs/*.js`（自動読込）
- スキーマ変更：`server/migrations/` に番号付きの `.sql` を足して `npm run migrate`（適用済みのファイルは書き換えない）
- エラー：`throw new ApiError(status, code, message)`（`server/src/middleware/error.js`）。形式は API 仕様の共通ルールどおり
- 配信：LiveKit（トークンはサーバー発行。**APIシークレットをフロントに書かない**）
- 画像・資料・添付：Railway Volume に保存 ／ アーカイブ動画：Cloudflare R2（S-03）

## コーディング規約

- 言語：コメント・コミットメッセージ・PR説明は**すべて日本語**
- 命名：
  - JS変数・関数：`camelCase` / クラス：`PascalCase` / 定数：`UPPER_SNAKE_CASE`
  - ファイル名：`kebab-case.js`。例外：React コンポーネントの `.jsx` は `PascalCase.jsx`、React フックは `useXxx.js`
  - DBテーブル・カラム：`snake_case`
- 文字列の直書き：イベント名・エラーコードは `shared/` から import する。例外：Socket.IO 組み込みのイベント名（`connect` / `disconnect` など）は直書きしてよい
- CSS：**色は必ず `broadsheet.css` の変数から取る**（`#fff`・`rgba()` の直書き禁止）。半透明は `color-mix(in srgb, var(--color-xxx) N%, transparent)` で書き、ベース色は必ず変数にする。余白は `--space-*` を使い、変数に無い値だけ px で書いてよい
- 入力の上限（文字数・サイズ）は `shared/constants.js` の `LIMITS` から読む。値を直書きしない
- **日時カラムは UTC で保存し、表示時のみ日本時間に変換する**（期限計算バグの温床対策）
- 文字列に埋め込むユーザー入力は必ずエスケープ（チャット・プロフィール・タイトルは特に注意）
- 権限チェックを忘れない：クラス外ユーザーは授業にアクセス不可。先生系APIは自分のクラスのみ。生徒映像の購読制限はフロントの表示制御だけに頼らない
- 秘密情報（APIキー・パスワード）はコードに直書き禁止。`.env` のみ。`.env` はコミット禁止
- パスワードは bcrypt でハッシュ化。平文・独自暗号は禁止
- console.log のデバッグ出力は PR 前に削除する

## Git ルール

- ブランチ：`main`（保護）← `feature/機能名` を切って作業
- コミットメッセージ：`種別: 内容`（例：`機能追加: 視聴ページの自動再生を実装`）
  - 種別：`機能追加` / `修正` / `リファクタ` / `ドキュメント` / `設定`
- **main への直接 push 禁止。必ず PR を作る**
- PR は小さく。1 PR = 1 機能・1 修正を目安にする

## PR ルール（AIセルフレビュー必須）

PR を出す前に、自分の AI に以下を実行させること：

```
このブランチの変更を CLAUDE.md と docs/04_API・イベント仕様.md に照らしてレビューして。
規約違反・契約違反・バグの可能性・セキュリティ問題（特にエスケープ漏れ、権限チェック漏れ、
秘密情報の直書き）を指摘して。
```

- 指摘を直してから PR を出す
- PR 説明に「AIセルフレビュー済み」と書く
- 最終マージ判断は PM のレビュー後

## AI への指示の出し方（推奨）

4部構成で指示すると精度が上がる：

```
【ゴール】最終状態を1行で
【手順】処理の分解を番号で
【出力形式】欲しい形を指定
【制約】境界条件・やらないことを明記
```

## AI 利用の禁止事項

- `docs/04_API・イベント仕様.md` に無い API・イベントを AI の提案のまま追加すること
  （必要なら PM に相談 → 仕様書を更新してから実装）
- DB スキーマの勝手な変更（マイグレーション＋`docs/03_DB設計.md` 更新が必須）
- 理解していないコードをそのままコミットすること
  （**発表で「自分の担当箇所」を説明できることがゴール**。AIの出力は必ず読んで理解する）

## 自動修正 PR のルール（修正要望サイト → Issue → Claude Code Action）

修正要望サイトが作る Issue（ラベル `request-site`）に対して、Claude Code Action が自動で PR を作る。手順は `docs/修正要望サイト_導入手順.md`。

- `type:style`（見た目）の Issue：変更してよいのは **`client/src/styles/**`、`client/src/**/*.css`、`client/src/**/*.jsx` だけ**。server/・shared/・package.json・設定ファイル・テストは触らない。ロジック（state・API・Socket・権限）は変えない。CI（`見た目PR 許可パスチェック`）が許可パス外の変更を検出すると失敗する
- `type:bug`（バグ）の Issue：**まずバグを再現する失敗テストを書き**（server は jest `server/src/**/*.test.js`、client は vitest `client/src/**/*.test.jsx`）、失敗を確認してから修正し `npm test` を通す。CI（`バグPR テスト`）はテストの追加が無いと失敗する
- `type:feature`（機能追加）の Issue：変更してよいのは **`client/src/**` だけ**（新しいコンポーネント・画面の追加は可）。まず実現できるか判断し、**`server/`・`shared/`・DB・依存の追加・仕様書に無い API/イベントが必要、要望が曖昧、規模が大きい（目安：8 ファイル超／追加 300 行超）、権限・認証に関わる**場合は、コードを変えず PR も作らず、理由を Issue にコメントして `needs-human` ラベルを付けて終了する。実装できる場合は `npm run build` と `npm test` を通す。CI（`機能追加PR 許可パス・テスト`）が `client/src/` 外の変更とテスト失敗を検出する
- 作業が終わったら `gh pr create --base main --label "type:〇〇" --label "screen:〇〇"` で PR を作り、本文の先頭に `Closes #<Issue番号>` を書く。PR のタイトル・本文は日本語
- テストの実行：`npm test`（サーバー → クライアントの順）、`npm run test:server`、`npm run test:client`

## 困ったら

- 30分詰まったら抱え込まずチームチャットに投げる（エラーログ全文を添えて）
- 仕様の解釈に迷ったら実装前に PM に確認
