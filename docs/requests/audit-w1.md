# W1 監査結果（2026-10-08）
- 依頼元：manager
- 依頼先：w1-core
- 対象：`server/src/routes/{auth,classes,lessons,files}.js`、`server/src/services/{auth,classes,lessons,files}.js`
- 方法：Haiku のサブエージェント12体（1ファイル×1軸）で照合し、マネージャーが重複をまとめた。「直す」の項目はコードで裏取り済み
  - routes × `docs/04_API・イベント仕様.md` §2（§1・§6 も前提）
  - services × `docs/03_DB設計.md`
  - 全ファイル × `CLAUDE.md` 規約
- 依頼：**A を直し、B は自分で判断できないものを @manager に上げてから完了報告し直すこと。** C は対応不要（参考）

---

## A. 直す（不一致・裏取り済み）

### A-1. 授業開始で、出席記録が失敗すると `lesson:started` が送られない
- 場所：`server/src/services/lessons.js:171-173`
- 契約：docs/04 §2 start「待機中の生徒を present で記録し、全員に `lesson:started`」
- 現状：status=live をコミットしたあとで `await attendance.markPresentOnStart()` を呼び、その次に `emitToLesson`。出席記録で例外が出ると、授業は live のまま 500 を返し、`lesson:started` は送られない。生徒は待機画面に残り、再度 start すると `ALREADY_LIVE` になる
- 対応案：`lesson:started` は必ず送る（emit を先にする、または出席記録の失敗で通知を止めない）

### A-2. 授業終了で出席を確定しても `attendance:update` が先生に届かない
- 場所：`server/src/services/lessons.js:178-193`（呼び出し先は `services/attendance.js` の `finalizeAttendance`）
- 契約：docs/04 §3 `attendance:update`（先生宛・「出席状態の変化」）
- 現状：`finalizeAttendance` は away→present/absent への書き換えと未入室者の absent 行の INSERT を行うが、通知はしない。`endLesson` が送るのは `lesson:ended` だけなので、先生の出席一覧は再読込まで古いまま
- 対応案：トランザクションのコミット後に、確定した生徒分の `attendance:update` を `emitToTeachers` で送る（`attendance.js` は W2 の担当なので、触る必要があれば `docs/requests/` にメモを書く）。または「終了後は先生画面が出席一覧を再取得する」と仕様で決めるなら、B に回して @manager に相談

### A-3. 先生系の授業 API で `role.js`（requireTeacher）を使っていない
- 場所：`server/src/routes/lessons.js:52-53`（POST /classes/:id/lessons）、`:87-88`（start）、`:98-99`（end）、`:107-109`（PATCH）
- 規約：CLAUDE.md「権限チェックは auth.js・role.js（先生/生徒）・class-member.js を使う」／docs/04 §1「ロール不一致は 403」
- 現状：`teacherOnly` は `classes.teacher_id === user.id` を見るだけで、role は確認していない。`routes/classes.js:15` は `requireTeacher` を使っており、扱いが揃っていない
- 対応案：上の4ルートに `requireTeacher` を足す

### A-4. 素の `Error` を投げている
- 場所：`server/src/services/classes.js:68` `throw new Error('参加コードの生成に失敗しました')`
- 規約：CLAUDE.md「エラー：`throw new ApiError(status, code, message)`」
- 対応案：`new ApiError(500, ERROR_CODES.INTERNAL_ERROR, ...)` にする

### A-5. `lessons.created_at` が DB 設計書に無い
- 場所：`server/migrations/001_init.sql:46`（定義）、`server/src/services/lessons.js:96`（ORDER BY で使用）
- 契約：docs/03 §1 の ER 図と §2 lessons の表に `created_at` が無い（同じく `status` の `DEFAULT 'preparing'`（001:40）と `files` の `idx_files_lesson_kind`（001:122）も記載が無い）
- 対応案：適用済みのマイグレーションは書き換えない。**docs/03 の方に追記する**（CLAUDE.md「スキーマ変更はマイグレーション＋docs/03 更新が必須」）。docs/03 の変更なので @manager に一言入れてから

### A-6. `files.url` の説明が実装と違う
- 場所：`server/src/services/files.js:78-79, 116, 121`
- 契約：docs/03 §2 files の url は「Railway Volume 上のパス」。実装は配信 URL の `/uploads/<乱数名>` を保存している（`users.icon_url` も同じ形式）
- 対応案：実装はこのままでよい。docs/03 の説明を「配信 URL（`/uploads/...`）」に直す（A-5 と一緒に @manager へ）

---

## B. 要確認（仕様が曖昧。判断できないものは @manager へ）

| # | 場所 | 内容 |
|---|---|---|
| B-1 | `services/lessons.js:117-140`、`routes/lessons.js:124-126` | `GET /api/lessons/:id` は docs/04 §2 だと `{title, status, spotlight_user_id, teacher}`。実装は id/class_id/room_name/away_timeout_min/tags/started_at/ended_at も返す（shared の LessonDetail と同じ形）。仕様書に LessonDetail の中身を追記するか。**生徒にも `room_name` を返してよいか**も合わせて決める |
| B-2 | `services/lessons.js:158-164` | live 中の授業そのものを再度 start すると `ALREADY_LIVE`。冪等に成功扱いにするか、CONFLICT にするか |
| B-3 | `routes/lessons.js:106-121`、`services/lessons.js:203-220` | PATCH のレスポンス形が未定義（実装は LessonDetail）。`away_timeout_min` を終了済みの授業でも変えられる |
| B-4 | `routes/lessons.js:68-70` | `?tag=` が空なら絞り込み無し、複数指定なら 400。仕様に記載なし |
| B-5 | `routes/classes.js:17`、`routes/auth.js:13,23-28,45-47`、`routes/lessons.js:12,22-27` | 仕様に無い入力上限：クラス名 50、表示名 30、ログインID は 3〜50 の英数字と `_.-`、タイトル 100。DB の長さとは合っているので、docs/04 §6「入力の上限」に追記するか |
| B-6 | `routes/auth.js:49-50`、`routes/lessons.js:23-24` | 文字数を `.length`（UTF-16 単位）で数えているので、絵文字の数え方が DB とずれる |
| B-7 | `services/auth.js:50` | login_id は照合順序次第で大文字小文字を区別しない（`Taro` と `taro` が同じ ID になる）。意図どおりか |
| B-8 | `routes/auth.js:97-106` | `POST /api/me/icon`：項目名 `icon`、レスポンス `{icon_url}`、上限 10MB（資料と共通）。どれも仕様に記載なし |
| B-9 | `routes/auth.js`、`services/auth.js:37-38` | ステータス（register 201・logout 204・ID 重複 409 CONFLICT）は §1 から導けるが、§2 には書かれていない |
| B-10 | `routes/classes.js:39-42` | 存在しないクラスは 404、クラス外は 403。クラス ID が存在するかどうかが外から分かる。403 に揃えるか |
| B-11 | `routes/classes.js:30-36`、`services/classes.js:88` | 参加コードが一致しないときも形式不正のときも 404。join・login ともにレート制限が無い（総当たり対策） |
| B-12 | `services/classes.js:91` | `INSERT IGNORE` は重複以外の DB エラー（FK 違反など）も握りつぶす。`ON DUPLICATE KEY UPDATE` にするか |
| B-13 | `services/classes.js:65`、`services/auth.js:37` | `'ER_DUP_ENTRY'`（MySQL ドライバのコード）の直書き。shared の ERROR_CODES の対象外なので、規約違反には当たらないという判断でよいか |
| B-14 | `routes/files.js:22-26` | 終了済みの授業にもアップロードできる（チャットは ended を拒否） |
| B-15 | `routes/files.js:56-60` | GET の kind を省略すると資料と添付を全件返し、`kind=attachment` も通る |
| B-16 | `routes/files.js:65-70`、`services/files.js:147-149` | DELETE はアップロード者本人なら所属を問わず削除できる（クラスを抜けたあとでも）。生徒が自分の添付を消してよいかも、docs/03 には書かれていない |
| B-17 | `services/files.js:36, 51-53` | 拡張子と許可判定がクライアント申告の MIME だけで決まる（中身は見ない） |
| B-18 | `routes/files.js:43-46` | catch 内の `removeUploadedFile` が失敗すると、元のエラー（400/403）が上書きされる。コメント（:21）には「ディスクに書かない」とあるが、kind 不正や先生以外の material は一度保存されてから消される |
| B-19 | `services/files.js`（docs/03 §2 files 末尾） | 「授業・クラス削除時は Volume 上のファイルも削除」とあるが、削除経路そのものがまだ無い。作るときに一緒に実装するのか、設計の方を直すのか |
| B-20 | 添付ファイル全般 | 送信されなかった添付が残る（孤児ファイル）。添付だけの投稿でファイルを消すと、本文もファイルも NULL の空メッセージが残る（`chat_messages.file_id` は ON DELETE SET NULL） |
| B-21 | `services/lessons.js:203-220` ほか | `updateLesson` 等は lessonId だけで動き、所属はルートのミドルウェア任せ。この前提を README かコメントに残すか |
| B-22 | `services/lessons.js:3,171,189`、`routes/lessons.js:95` | 「W2・結合で接続」「結合時に接続」のコメントが古い（すでに接続済み） |

---

## C. 参考（W1 の対象外。直さなくてよい。マネージャー側で扱う）
- `middleware/auth.js:8,17,20`・`middleware/error.js:20,30`・`sockets/index.js:47-54`：エラーコードの文字列直書き
- `middleware/error.js:25-30`：不正な JSON ボディ（express.json の 400）が 500 になる
- `config.js:11`：`SESSION_SECRET` 未設定時に `'dev-only-secret'` で動く
- `services/chat.js:77`：添付の `file_id` に kind=material（資料）を指定できる
- `/uploads` が認証なしで配信されている → docs/04 §6 に既知の例外として記載済み（本番課題）

## 誤検知として除外したもの
- 「`startLesson` が classId と授業の所属を照合していない」→ `routes/lessons.js:91` で `lesson.class_id` を渡しているため問題なし

---

## 【裁定】（2026-10-08 manager）
- 前提：`shared/`（`LIMITS`・`LIVEKIT_IDENTITY_PREFIX`・`ATTENTION_AUTO_TICK_SEC`・`SERVER_EVENTS.MATERIAL_ADDED`）と docs/03・04・07・08 を更新した。**再読込してから着手すること**
- 上の A は従来どおり直す。追加の裁定は次のとおり
  1. 資料（`kind=material`）のアップロードに成功したら、`emitToLesson` で全員に `material:added {file}` を送る（`file` は FileInfo の形）
  2. 参加コードの入力はハイフンを取り除いてから照合する（画面では `XXXX-XXXX` と表示する裁定になったため）
  3. 入力上限の値（表示名・ログインID・クラス名・タイトル・タグ・パスワード）は `LIMITS` から import する。ローカル定数をやめる
  4. A-2（終了時の `attendance:update`）は、W2 の `finalizeAttendance` が「変化した生徒の一覧 `[{user_id,status,away_total_sec}]`」を返すようになる。`endLesson` で受け取り、**コミット後に** `emitToTeachers` で1件ずつ送る
  5. B-5 の上限は `LIMITS` で確定した。その他の B は未裁定（@manager の判断待ち。着手しない）
