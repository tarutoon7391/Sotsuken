# 授業の開始・終了から出席処理を呼ぶ（結合時に接続）
- 依頼元：w1-core
- 依頼先：w2-live（関数の提供）／manager（結合時の接続）
- 何を：
  1. `POST /api/lessons/:id/start` の成功後に、W2 の `services/attendance.js` の `markPresentOnStart(lessonId)` を呼ぶ（待機中＝接続済みの生徒を present で記録）
  2. `POST /api/lessons/:id/end` のトランザクション内で、W2 の `finalizeAttendance` を呼ぶ（退出中の生徒を出席／欠課に確定し、未入室メンバーを欠課で作る。docs/03「判定SQL」3.）
- なぜ：docs/04「授業」の start / end の仕様（v4.1）。出席の SQL は W2 の担当なので W1 からは呼ぶだけにする
- 影響範囲：`server/src/services/lessons.js` の `startLesson` / `endLesson` のみ（`TODO(結合時)` コメントの位置）
- お願い（シグネチャ）：docs/03 では終了時の確定を「end のトランザクション内」で行うことになっているので、
  `finalizeAttendance(lessonId, conn)` のように **トランザクション中の接続 `conn`（mysql2 の PoolConnection）を受け取れる形**だと
  status=ended への更新と同じトランザクションにできて助かる。`classId` と `away_timeout_min` が必要なら引数で渡せる（W1 側で lesson 行を FOR UPDATE で読んでいる）
- 現状の仮対応：TODO コメントを置いて呼び出しは未接続。lesson:started / lesson:ended の送信は W1 側で実装済み（emitToLesson）
