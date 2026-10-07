# 結合レポート（フェーズ2・2026-10-07）

manager（Claude Code セッション）が docs/10 P6 の手順で実施。

## 1. マージ

順番：feat/w1-core → feat/w2-live-features → feat/w3-livekit → feat/w5-teach → feat/w4-learn（`--no-ff`）

| 項目 | 結果 |
|---|---|
| コンフリクト | **1箇所**：`docs/progress.md`（add/add）。原因は manager 側。jest 修正のコミット 40252ad に作りかけの progress.md が混ざり、W2 がそれを cherry-pick したため。main の版を採用して解決 |
| 所有権違反 | なし（担当範囲外の変更は manager 由来の cherry-pick と、W5 の担当に含まれる app.css のみ） |
| package.json の衝突 | なし（フェーズ0で依存を先に入れておいたため） |

## 2. 繋いだ箇所

| 箇所 | 内容 | 依頼メモ |
|---|---|---|
| `server/src/services/lessons.js` startLesson | status を live にした後に `attendance.markPresentOnStart(lessonId)`（待機中の生徒を present に） | w1-lesson-attendance-hooks.md |
| 同 endLesson | トランザクション内で `attendance.finalizeAttendance(lessonId, conn)`（出席／欠課の2値に確定、未入室は欠課） | 同上 |
| `client/src/pages/teach/TeachPage.jsx` | LiveKit 部品の import を `_stubs/livekit.jsx` → `../../livekit` | w5-integration.md |
| `client/src/components/learn/parts.js` | 同上（生徒側） | W4 報告文 |
| 削除 | `components/learn/_stubs/`、`components/shared/_stubs/`、`components/shared/Placeholder.jsx`、`routes/_stub.js`、teach.css の仮グリッド節、app.css の `.placeholder-page` | |

W3 の spotlight → `spotlight:update` 送信は W3 が `sockets/io.js` 経由で実装済みだったため、繋ぎ込み不要。

## 3. 通しテスト

`scripts/e2e-scenario.js`（REST + Socket.IO、Railway の MySQL に対して実行）で P6 の a〜g を自動化。**39 件 / NG 0**。

| シナリオ | 確認内容 |
|---|---|
| a | 先生登録→クラス作成（join_code 8桁）→生徒登録→参加コードで加入。生徒のクラス詳細に join_code が無い |
| b | タグ付き授業作成、`?tag=` 絞り込み、待機中の Socket 接続、開始前は absent/joined_at null、開始→live・`lesson:started`、二重開始 409 ALREADY_LIVE、開始時に接続中の生徒が present |
| c | `understanding:send` → 先生に `understanding:update`、GET understanding の current/totals |
| d | 挙手 → `question:raised`、匿名質問 → `question:new`（先生には user、生徒には無し）、一覧でも匿名、回答済み → `question:answered` |
| e | 確認ボタン発動 → `attention:check` → 応答 204 → `attention:update` |
| f | 一時退出 → `attendance:update`、remaining_sec、戻る → present・away_total_sec 加算 |
| 追加 | `chat:message` 配信と GET chat 履歴、spotlight PUT → `spotlight:update`、token（LiveKit 未設定で 200・url 空） |
| g | 終了 → ended・`lesson:ended`、終了後の出席が2値、再終了 409 |

ブラウザでの画面確認（React 側）は未実施。vite build は通っている。

## 4. 直したバグ

製品側のバグは **0 件**。テストスクリプト側の修正が3件（クッキー取得、Railway の DB 遅延に対するイベント待ち時間、挙手の `question:new` との競合）。

## 5. 残課題

| # | 内容 | 出どころ |
|---|---|---|
| 1 | ブラウザでの通し確認（ログイン→クラス→授業→先生画面／生徒画面）。LiveKit の実接続はキー取得後 | P6 手順3 |
| 2 | 授業結果の確認応答率（API 無し・「—」表示） | pending #7 |
| 3 | 自動確認間隔の現在値取得・`understanding_reset_at` の取得 | pending #8 #9 |
| 4 | 生徒向けクラス詳細のメンバー一覧（members が先生専用） | pending #10 |
| 5 | `/uploads` が認証なし配信。本番で要判断 | docs/04 §6 |
| 6 | 資料の「ページ同時表示」は pdf.js が要るため未実装 | W4 報告 |
| 7 | Railway へのデプロイ（main を push。GitHub 連携でビルド。`npm run build` → `npm start`） | |

## 6. 効率測定の結果（docs/10 §6）

| 項目 | 値 |
|---|---|
| フェーズ0 所要 | 約1時間（このセッション、既存土台あり） |
| フェーズ1 各ワーカー所要 | W1 8分／W2 10分（+2）／W3 6分／W4 10分／W5 16分 |
| フェーズ1 壁時計 | 16分（14:54〜15:10） |
| 並列の効果 | 52 ÷ 16 ≒ **3.3** |
| コンフリクト | 1（manager 起因） |
| 依頼メモ | 4 |
| 結合バグ | 0 |
| manager が受けた本文メッセージ | 11（うち進捗確認への返信 5） |

判定基準「効果 2 以上・結合バグ 10 未満」を満たす。ただし各ワーカーの所要は Claude の実行時間であり、人間が同じ分割で作業する場合の見積もりには別途レビュー時間を足す必要がある。
