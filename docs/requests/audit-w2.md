# W2 監査結果（2026-10-08）
- 依頼元：manager
- 依頼先：w2-live
- 対象：`server/src/routes/{attendance,attention,questions,understanding,chat}.js`、`server/src/services/` の同名5ファイル、`server/src/sockets/handlers/*.js`、`server/src/jobs/{attendance-timer,attention-auto}.js`
- 方法：Haiku のサブエージェント10体で照合し、マネージャーが重複をまとめた。「直す」の項目はコードで裏取り済み
  - routes＋handlers × `docs/04` §2・§3（5体）
  - §3 のイベント表全体との照合（1体）
  - services＋jobs × `docs/03`（3体）
  - 規約照合（2体）
- 依頼：**A を直し、B は自分で判断できないものを @manager に上げてから完了報告し直すこと。** C は対応不要（参考）

---

## A. 直す（不一致・裏取り済み）

### A-1. 理解度リセットが live 以外でも通る
- 場所：`server/src/services/understanding.js:80-86`（`reset()`）
- 契約：docs/04 §6「質問・理解度・確認ボタンは live 中のみ（それ以外 409 CONFLICT）」
- 現状：`send()`（:66-69）は live かどうかを見ているが、`reset()` は見ていない。preparing や ended の授業でも `understanding:reset` が全員に送られてしまう
- 対応案：`send()` と同じ live チェックを先頭に入れる

### A-2. 確認ボタンの応答が live 以外でも通る
- 場所：`server/src/services/attention.js:147-167`（`respond()`。REST・Socket の共通処理）
- 契約：同じく docs/04 §6。発動側（`issueCheck` :76-78）は live を見ている
- 現状：授業が終わった直後でも、締切前なら応答が記録され、`attention:update` も送られる
- 対応案：`loadCheck` で取った授業の status を見て、live でなければ 409 CONFLICT

### A-3. チャットの添付に資料（kind=material）を指定できる
- 場所：`server/src/services/chat.js:75-79`
- 契約：docs/03 §2 files の `kind`（material は授業内資料、attachment はチャット添付）／docs/04 §2 資料・添付
- 現状：`SELECT id FROM files WHERE id = ? AND lesson_id = ?` で、kind を見ていない
- 対応案：条件に `AND kind = ?` を足して `FILE_KINDS.ATTACHMENT` を渡す
- ※ W1 の監査（audit-w1.md の C）でも同じ指摘が出ている。担当は W2

### A-4. 授業終了で出席を確定したときに `attendance:update` が出ない
- 場所：`server/src/services/attendance.js:386-413`（`finalizeAttendance`）
- 契約：docs/04 §3 `attendance:update`（先生宛・出席状態の変化）
- 現状：away→present/absent への書き換えと、未入室者の absent 行の INSERT のどちらも通知しない。先生の出席画面は `lesson:ended` を受けて再取得しているので、実害は小さい
- 対応：W1 にも同じ指摘（audit-w1.md A-2）を出している。通知はトランザクションのコミット後に出す必要があるので、**どちらが送るかを w1-core と相談して決める**（例：`finalizeAttendance` が変化した user_id の一覧を返し、W1 の `endLesson` がコミット後に送る）

### A-5. `question:new` のペイロードに契約に無い `status` が入っている
- 場所：`server/src/services/questions.js:22-35`（`toQuestion`）→ :78-79 で送信
- 契約：docs/04 §3 の `question:new` は `{id, user?, body, is_anonymous, created_at}`
- 現状：REST 用の Question 型（status あり）と同じ関数を使っているため、Socket にも status が載る
- 対応案：契約に合わせて Socket では外す。あるいは §3 への追記を @manager に依頼する（どちらでもよいが、黙って放置しない）

---

## B. 要確認（仕様が曖昧。判断できないものは @manager へ）

| # | 場所 | 内容 |
|---|---|---|
| B-1 | `services/attention.js:158-164` | 締切後の二度押しは「応答済みなら成功」としている。docs/04 §2・§5 の「deadline 超過は 409」とぶつかる。§6 に例外として追記するか、409 にするか |
| B-2 | `services/questions.js:96-111` | 質問を回答済みにする操作（PATCH）に授業状態のチェックが無い。§6 の「質問は live 中のみ」を回答にも適用するか（先生の結果画面 ResultPage は ended の授業でこの操作をする） |
| B-3 | `services/attention.js:111-123` | 自動発動の設定（PATCH auto）が授業状態を見ない。timeout_sec 10〜600・interval_min 0〜180 は §6 に記載なし |
| B-4 | `services/questions.js:13`、`services/chat.js:57` | 本文の上限 1000 文字（`BODY_MAX_LENGTH` を2か所で別々に定義）は §6 に記載なし。`.length` は UTF-16 単位で数えている |
| B-5 | `services/questions.js:43-47` | 空白だけの本文は挙手扱いになる。REST で匿名の挙手をしても、先生には user 付きの `question:raised` が届く |
| B-6 | `routes/questions.js:18` | POST questions の 201 が §6 の「作成系」に入っていない |
| B-7 | `services/attendance.js:109,138,179` | 「live かどうか」を書き込みとは別のタイミングで確認している。終了処理と競合すると、終了後に away の行が残る／present の行が作られる可能性がある。lessons 行のロック下で書くか、SQL の条件に status を入れるか |
| B-8 | `services/attendance.js:177-198` | `/attendance/away` が 409 ALREADY_ABSENT と 404 を返す（§2 で ALREADY_ABSENT が定義されているのは /return だけ）。行が present のときに /return を呼ぶと 200 |
| B-9 | `services/attendance.js:254-260` | 一覧の `note` が §2 の形に無い（shared の型にはある）。欠課の行でも remaining_sec が正の値で返る |
| B-10 | `services/attendance.js:291` | 手動修正で、対象がクラス外の生徒だと 404（§1 の「クラス外は 403」とどちらにするか） |
| B-11 | `services/understanding.js:29` | `created_at > understanding_reset_at` の厳密な比較。秒精度なので、リセットと同じ秒の反応が集計から漏れる（docs/03 の文言は「以降」） |
| B-12 | `services/chat.js:108-114` | 履歴を `ORDER BY m.id` で並べているので、docs/03 のインデックス `(lesson_id, created_at)` が使われない |
| B-13 | `services/chat.js:63-65,95-100` | 他人の添付も貼れる。`file_id` が true でも通る。limit が 101 以上なら 400（丸めるのか 400 にするのか、仕様は「最大 100」とだけ書いている） |
| B-14 | `sockets/handlers/attention.js:15-19` | `attention:respond` が、接続中の授業と check の授業が同じかを見ていない |
| B-15 | `services/attention.js:129-144` | `runAutoChecks` に授業ごとの try/catch が無い。1 つの授業で失敗すると、同じ回の他の授業が止まる |
| B-16 | `services/attention.js:56`、`services/attendance.js` の各 SQL、`services/questions.js:72,106` | SQL 内で 'present' 'open' などの状態値を直書きしている（shared に定数がある） |
| B-17 | `jobs/attention-auto.js:9` | 間隔 15 秒が直書きで、shared の DEFAULTS に無い |
| B-18 | `services/attention.js:19` | 自動発動の設定はメモリ保持（§6 で既知）。docs/03 には書かれていない |
| B-19 | `services/attention.js:52-60` | 未応答者を「問い合わせた時点の present」で計算している（発動時点で固定していない） |
| B-20 | `001_init.sql:64`（attendance の status インデックス）、`:106`（questions のインデックス） | docs/03 に記載が無いインデックス。docs/03 への追記を @manager に依頼 |

---

## C. 参考（W2 の対象外）
- `middleware/auth.js`・`middleware/error.js`・`sockets/index.js` のエラーコード直書きは、W1 の監査で manager 側の扱いにした

---

## 【裁定】（2026-10-08 manager）
- 前提：`shared/` と docs/03・04 を更新した（v4.3）。**再読込してから着手すること**
- **直す**：A-1・A-2・A-3・A-4。A-5 は仕様側で解決した（`question:new` に `status` を含めてよい。docs/04 §3 に追記済み）
  - A-4：`finalizeAttendance` は、変化した生徒の一覧 `[{user_id, status, away_total_sec}]` を返す。送信は W1 の `endLesson` がコミット後に行う
- **B で直すもの**：
  - B-5：空白だけの本文は 400。挙手は body 省略か `question:raise` だけ。挙手は匿名にしない（`is_anonymous` は無視して false）
  - B-7：出席の書き込みで授業が live であることを、書き込みと同じ SQL の条件に入れる（または lessons 行のロック下で書く）
  - B-9：`note` は返す（docs/04 §2 に追記済み）。absent の行の `remaining_sec` は 0
  - B-11：`>=` にする
  - B-13：添付は自分がアップロードしたもの（`uploader_id = 自分`）だけ。`file_id` は正の整数だけ受け付ける。limit が 100 を超えたら 100 に丸める
  - B-14：`attention:respond` は、接続中の授業（`socket.data.lessonId`）の check でなければ 403
  - B-15：`runAutoChecks` は授業ごとに try/catch
  - B-16：SQL 内の状態値は shared の定数をプレースホルダで渡す
- **追加の裁定**：
  - 接続時、`absent` の生徒を `present` に戻さない（docs/04 §6 のとおり。実装を確認）
  - 手動修正で `away` にしたときは `away_since = UTC_TIMESTAMP()` にする
- **契約の追加（実装する）**：
  1. `attention:check` は全員宛。`{check_id, issued_at, deadline_at, auto}` を送る
  2. 発動直後に、先生へ `attention:update` を送る
  3. `GET /api/lessons/:id/attention` → `[{check_id, issued_at, deadline_at, auto, responded_count, pending_count}]`
  4. `GET /api/lessons/:id/attention/auto` → `{interval_min}`
- **仕様側で解決したもの**：
  - B-1：応答済みの再押下は締切後でも成功
  - B-2：回答済み操作は ended でも可
  - B-3：範囲は §6 に記載
  - B-4：本文の上限は `LIMITS.BODY_MAX` を使う
  - B-8：`/away` も absent なら 409 ALREADY_ABSENT
  - B-17：`ATTENTION_AUTO_TICK_SEC`
  - B-18・B-20：docs/03 に追記
- **現状維持**：B-10、B-12
- **未裁定**（@manager の判断待ち。着手しない）：B-6、B-19

## 【追加裁定】（2026-10-08 manager）
- `auto` フラグと `interval_min` はメモリ保持のままでよい。docs/03 §3 に既知の制約として記載し、永続化はストレッチ案にした。対応は不要
