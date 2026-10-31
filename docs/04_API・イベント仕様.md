# API・イベント仕様（チーム内作業用）v4

> **この文書が分担間の「契約」。** ここに従えば各担当は独立して開発できる。
> 変更したい場合は PM に相談 → 合意後にこの文書を更新してから実装する。
> v4.1（2026-10-05）：クラス詳細・チャット履歴・理解度の取得 API、`lesson:started` / `understanding:reset` イベントを追加。出席の記録タイミング・復帰時の閾値判定・授業終了時の確定を明記。
> v4.5（2026-10-31・トーンさん裁定）：**F-10 プログラミングモード**の契約を §7 に追加（モード切替・課題・保存／実行・コードスポットライト・Yjs 同期、エラーコード `RATE_LIMITED`／`RUNNER_UNAVAILABLE`／`NOT_CODING_MODE`）。10-29 班員テストの要望で `DELETE /api/questions/:id`（挙手の取り下げ）＋`question:cancelled`、`GET /lessons/:id/attention` の各要素に `pending:[{id,name}]` を追加。pending #9 → B（`LessonDetail.understanding_reset_at`）、#10 → A（members は先生のみのまま）。
> v4.4（2026-10-08）：Office 資料（Word・Excel・PowerPoint）をアップロード時に PDF へ変換し、`FileInfo.preview_url` で資料パネルに表示する（別タブを開かずに見られるようにする）。
> v4.3（2026-10-08・W1〜W5 監査の裁定）：`material:added` を追加。`attention:check` を全員宛にして `issued_at`・`auto` を追加。確認ボタンの一覧・自動設定の取得 API を追加。`question:new` に `status`。入力の上限を `LIMITS` として §6 にまとめた。購読制御の文言を実装に合わせた。

## 1. 共通ルール

- REST のベースパス：`/api`。JSON（アップロードのみ multipart）。日時は ISO 8601 / UTC
- 認証：全API ログイン必須（ゲスト無し）。ロール：`teacher` / `student`
- 権限：先生系APIは自分のクラス/授業のみ。生徒はメンバーであるクラスの授業のみ。それ以外は 403
- エラー形式：`{ "error": { "code": "...", "message": "..." } }`

| HTTP | 意味 | | HTTP | 意味 |
|---|---|---|---|---|
| 400 | パラメータ不正 | | 404 | 対象なし |
| 401 | 未ログイン | | 409 | 競合（授業の二重開始、締切超過など） |
| 403 | 権限なし・ロール不一致・クラス外 | | 500 | サーバーエラー |
| 429 | レート超過（`RATE_LIMITED`。F-10 の実行回数制限・v4.5） | | 503 | 実行サーバーに接続できない（`RUNNER_UNAVAILABLE`。F-10・v4.5） |

## 2. REST API（MVP）

### アカウント
| メソッド | パス | 説明 |
|---|---|---|
| POST | /api/register | `{name, login_id, password, role}` |
| POST | /api/login ／ /api/logout | |
| GET | /api/me | `{id, name, role, icon_url}` |
| PUT | /api/me ／ POST /api/me/icon | 表示名・アイコン |

### クラス
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| POST | /api/classes | 先生 | `{name}` → `{id, join_code}` |
| GET | /api/classes | 全員 | 自分が作った／参加しているクラス一覧 |
| POST | /api/classes/join | 生徒 | `{join_code}` → 加入 |
| GET | /api/classes/:id | 全員 | クラス情報 `{id, name, teacher:{id,name,icon_url}, join_code?, live_lesson_id}`。**`join_code` は先生にのみ含める**。`live_lesson_id` は開催中の授業（無ければ null）（v4.1） |
| GET | /api/classes/:id/members | 先生 | メンバー一覧 |

### 授業
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| POST | /api/classes/:id/lessons | 先生 | `{title, tags?:[string]}` → `{id, room_name}` |
| GET | /api/classes/:id/lessons | 全員 | 開催中／予定／終了済み一覧 `[{id, title, status, tags, started_at, ended_at, material_count}]`。クエリ `tag` でタグ絞り込み |
| GET | /api/classes/:id/tags | 全員 | クラスのタグ一覧 |
| POST | /api/lessons/:id/start | 先生 | 開始。**同一クラスに live があれば 409 `ALREADY_LIVE`**。待機中（接続済み）の生徒を present で記録し、全員に `lesson:started` |
| POST | /api/lessons/:id/end | 先生 | 終了（ended_at 記録）。**出席を出席／欠課の2値に確定**：退出中の生徒は今回分を累積に足し、閾値以上なら欠課・未満なら出席。一度も入室しなかったメンバーは欠課で記録（v4.1）。全員に `lesson:ended` |
| PATCH | /api/lessons/:id | 先生 | `{away_timeout_min?, title?, tags?}` 閾値・タイトル・タグ変更。タイトル・タグは予定／終了済みの授業でも変更可（クラス詳細の「編集」） |
| GET | /api/lessons/:id | 全員 | 授業情報 `{title, status, spotlight_user_id, understanding_reset_at, mode, active_task_id, code_spotlight_user_id, teacher:{...}}`（`LessonDetail`）。`understanding_reset_at` は pending #9 → B（v4.5）、`mode`・`active_task_id`・`code_spotlight_user_id` は F-10（§7・v4.5） |

### 配信トークン（LiveKit）
| メソッド | パス | 説明 |
|---|---|---|
| POST | /api/lessons/:id/token | ロールに応じたトークンを発行。**先生**：publish可・全員subscribe可。**生徒**：publish可（自分のカメラ・マイク）・subscribe可。クラス外は 403 |

> 生徒映像を他の生徒に見せない制御は、**publisher 側のトラック購読許可（SFU が強制）＋サーバー発行トークン**で行う。生徒が購読許可を広げられるのは自分のトラックだけで、他の生徒のトラックは購読できない（v4.3）。フロントの表示制御だけに頼らない。

### スポットライト
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| PUT | /api/lessons/:id/spotlight | 先生 | `{user_id}` 指定／`{user_id:null}` 解除 → 全員に `spotlight:update`。レスポンス `{user_id}`（v4.2 追記：レスポンス形が未記載だったため実装に合わせて明記） |

### 出席
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| GET | /api/lessons/:id/attendance | 先生 | **クラスの全生徒**の状態一覧 `[{user, status, joined_at, away_since, away_total_sec, remaining_sec, note}]`。まだ入室していない生徒は `status:"absent"`, `joined_at:null` で返す。`absent` の行の `remaining_sec` は 0（v4.3：`note` を明記） |
| GET | /api/lessons/:id/attendance/me | 生徒 | 自分の状態 `{status, away_total_sec, remaining_sec}`（一時退出中画面の残り時間表示用） |
| PATCH | /api/lessons/:id/attendance/:user_id | 先生 | `{status, note}` 手動修正 |
| POST | /api/lessons/:id/attendance/away | 生徒 | 一時退出（`away_since` 記録）。既に absent のときは 409 `ALREADY_ABSENT`（v4.3） |
| POST | /api/lessons/:id/attendance/return | 生徒 | 復帰。`WHERE status='away'` の条件付きUPDATEで**今回の退出時間を away_total_sec に加算**。**累積＋今回分が閾値以上ならその場で欠課にして** 409 `ALREADY_ABSENT`（タイマーを待たない）。既に absent のときも 409 `ALREADY_ABSENT`（先生に修正を依頼する導線を表示） |

> 入室（Socket接続）で present、切断で away（サーバーが自動記録）。away→absent の自動判定はサーバータイマー（1分間隔）で、**累積退出時間＋現在の経過 ≥ 閾値** を条件とする（v4）。
> **出席を記録するのは授業が `live` の間だけ**（v4.1）。開始前（`preparing`）の待機画面での接続・切断は出席に影響しない。
> 判定SQLは `03_DB設計.md` の「判定SQL」を正とする（時刻は `UTC_TIMESTAMP()`）。

### 確認ボタン
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| POST | /api/lessons/:id/attention | 先生 | 発動。`{timeout_sec:60}` → 全員に `attention:check`、直後に先生へ `attention:update`（v4.3） |
| GET | /api/lessons/:id/attention | 先生 | 授業の確認の一覧 `[{check_id, issued_at, deadline_at, auto, responded_count, pending_count, pending:[{id,name}]}]`（授業結果画面の応答率用）（v4.3）。**`pending` は未応答者の id と名前**（締切時点で応答していない present の生徒。授業結果で「誰が未応答か」を出す。10-29 班員テスト #7・v4.5） |
| PATCH | /api/lessons/:id/attention/auto | 先生 | `{interval_min}` 自動発動の設定（0で無効） |
| GET | /api/lessons/:id/attention/auto | 先生 | 自動発動の現在の設定 `{interval_min}`（先生画面の再読込用）（v4.3） |
| POST | /api/attention/:check_id/respond | 生徒 | 応答。deadline 超過は 409 `CHECK_EXPIRED`。**応答済みの再押下は締切後でも成功**（409 にしない）（v4.3） |
| GET | /api/attention/:check_id | 先生 | 応答者／未応答者一覧 |

### 理解リアクション
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| GET | /api/lessons/:id/understanding | 先生 | `{current:{understood, confused, again, total}, totals:{understood, confused, again}}`。`current` は最後のリセット以降の**各生徒の最新1件**の集計（先生画面の再読込用）、`totals` は授業全体の送信回数（授業結果画面用）（v4.1） |

> 送信は Socket の `understanding:send`、リセットは `understanding:reset`。

### 質問
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| POST | /api/lessons/:id/questions | 生徒 | `{body, is_anonymous}`。**挙手のみは body 省略** |
| GET | /api/lessons/:id/questions | 全員 | 一覧。匿名の投稿者は先生にのみ含める |
| PATCH | /api/questions/:id | 先生 | `{status:"answered"}`。終了済み（`ended`）の授業でも可（授業結果画面から操作する）（v4.3） |
| DELETE | /api/questions/:id | 生徒（本人） | **挙手の取り下げ**。削除できるのは**本人の・挙手のみ（body null）・`open`** の質問だけ。本人以外は 403 `FORBIDDEN`、本文付きの質問や `answered` は 409 `CONFLICT`、`live` 以外は 409 `CONFLICT`。成功 204 → 全員に `question:cancelled {id}`（10-29 班員テスト #2。pending #5 の A を覆す・v4.5） |

### 資料・添付
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| POST | /api/lessons/:id/files | 先生(material) / 全員(attachment) | multipart `{kind, file}`。画像・PDF・Office文書、10MBまで → `{file_id, url, preview_url}`。`kind=material` のときは全員に `material:added`（v4.3）。**Office 文書の資料は PDF に変換してから応答する**（v4.4。下の注記） |
| GET | /api/lessons/:id/files?kind=material | 全員 | 資料パネル用一覧（終了済み授業でも取得可）。要素は `FileInfo`（`preview_url` を含む） |
| DELETE | /api/files/:id | アップロード者 | 資料・添付の削除（ファイル本体も削除。プレビュー用 PDF があればそれも削除） |

> **Office 資料のプレビュー（v4.4）**：`kind=material` で Word・Excel・PowerPoint（`.doc/.docx/.xls/.xlsx/.ppt/.pptx`）が上がったら、サーバーが LibreOffice（headless）で PDF に変換し、`/uploads/<乱数名>.pdf` に保存して `files.preview_url` に記録する。変換はアップロードの処理の中で待つ（上限 60 秒）。失敗・タイムアウト・LibreOffice 未導入のときは `preview_url` を null にして、アップロード自体は成功させる。PDF・画像・チャット添付は変換しない（`preview_url` は null）。
> クライアントは `preview_url` があれば pdf.js のビューアで表示し、無ければ従来どおりの表示（PDF・画像はそのまま、Office はダウンロード案内）にする。**どの資料にも元ファイル（`url`）のダウンロードボタンを付ける**。

### チャット
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| GET | /api/lessons/:id/chat?before=&limit= | 全員 | チャット履歴（新しい順、既定 limit=50・最大100）。`before` はメッセージ id で、それより古い分を返す。要素は `chat:message` と同じ形 `{id, user, body, file?, created_at}`。途中入室・再接続・終了済み授業の閲覧用（v4.1） |

> 投稿は Socket の `chat:message`。

## 3. Socket.IO イベント（MVP）

接続時に `lesson_id` を渡す。セッションからユーザー・ロール・クラス所属を検証し、不正なら切断。
授業が `live` のとき：接続成功で出席 present、切断で away を自動記録。
授業が `preparing` のとき：接続は受け付けるが出席は記録しない（待機）。開始時にサーバーが接続中の生徒を present にして `lesson:started` を送る。

### クライアント → サーバー
| イベント | ペイロード | ロール | 説明 |
|---|---|---|---|
| `chat:message` | `{body?, file_id?}` | 全員 | 雑談チャット（テキスト or 添付） |
| `understanding:send` | `{type}` | 生徒 | わかった／わからない／もう一度 |
| `understanding:reset` | `{}` | 先生 | 理解度集計をリセット（`lessons.understanding_reset_at` を更新）（v4.1） |
| `question:raise` | `{}` | 生徒 | 挙手（質問ボタン）。REST の body 無し投稿と同義 |
| `attention:respond` | `{check_id}` | 生徒 | 確認ボタン応答（REST でも可） |

### サーバー → クライアント
| イベント | ペイロード | 宛先 | 説明 |
|---|---|---|---|
| `chat:message` | `{id, user:{id,name,role,icon_url}, body, file?, created_at}` | 全員 | |
| `understanding:update` | `{understood, confused, again, total}` | 先生 | リアルタイム集計（リセット以降の各生徒の最新1件） |
| `understanding:reset` | `{}` | 全員 | リセットされた。生徒側は選択中のボタンを解除する（v4.1） |
| `question:new` | `{id, user?, body, is_anonymous, status, created_at}` | 全員（匿名時 user は先生のみ） | `status` は v4.3 で追加（REST の Question と同じ形） |
| `question:answered` | `{id}` | 全員 | |
| `question:cancelled` | `{id}` | 全員 | 挙手が取り下げられた（`DELETE /api/questions/:id`）。先生画面は挙手一覧・質問一覧から消す。生徒本人は「挙手中」表示を戻す（v4.5） |
| `question:raised` | `{user:{id,name}}` | 先生 | 挙手通知 |
| `attention:check` | `{check_id, issued_at, deadline_at, auto}` | 全員 | 生徒はポップアップ表示（カウントダウンは `issued_at` 基準）、先生は応答状況パネルの表示に使う。`auto` は自動発動なら true（v4.3：宛先を全員に、`issued_at`・`auto` を追加） |
| `attention:update` | `{responded[], pending[]}` | 先生 | 応答状況。発動直後と応答のたびに送る（v4.3） |
| `attendance:update` | `{user_id, status, away_total_sec}` | 先生 | 出席状態の変化 |
| `spotlight:update` | `{user_id\|null}` | 全員 | 表示切替 |
| `lesson:started` | `{}` | 全員 | 授業開始。待機画面（9）の生徒は授業画面（10）へ遷移する（v4.1） |
| `lesson:ended` | `{}` | 全員 | 授業終了 |
| `material:added` | `{file}`（`FileInfo`） | 全員 | 先生が資料（`kind=material`）をアップロードした。資料パネルを更新する（v4.3） |

> F-10 プログラミングモードのイベント（`lesson:mode`・`code:*`・`code:syntax`）は §7.2（v4.5）。

### 予約（ストレッチ）
`stats:update`（S-01）／`quiz:*`（S-02）／`caption:update`（S-05）／`material:page`（S-06）／`breakout:*`（S-07）

## 4. 画面一覧と担当マッピング

| パス | 画面 | 主な API / イベント | 主担当 |
|---|---|---|---|
| /login, /register | 認証（ロール選択） | account | クラス・出席担当 |
| /classes | クラス一覧・作成・参加コード入力 | classes | クラス・出席担当 |
| /classes/:id | クラス詳細（授業一覧・タグ絞り込み・メンバー・授業作成／編集・終了済み授業の資料） | classes, lessons, tags, files | クラス・出席担当 |
| /lessons/:id/teach | **先生画面**：配信プレビュー、生徒グリッド、スポットライト、理解度集計、出席一覧、確認発動、質問箱、資料アップ | token, spotlight, attendance, attention, questions, files | 先生画面担当 |
| /lessons/:id/learn | **生徒画面**：先生映像、資料パネル、理解ボタン、質問ボタン/質問箱、一時退出、確認ポップ、チャット | token, understanding, questions, attendance, chat | 生徒画面担当 |
| /lessons/:id/away | 一時退出中（残り時間・復帰）（v4.3 で一覧に追記） | attendance | 生徒画面担当 |
| /lessons/:id/ended | 授業終了（生徒：クラスへ戻る／先生：授業結果へ）（v4.3 で一覧に追記） | lessons, classes | 先生画面担当 |
| 共通部品 | チャット・質問箱・Socket接続・ロールバッジ | chat/question イベント | 通信基盤担当 |

## 5. テストケース（抜粋・担当者はそのまま使う）
- 一時退出→14分後に「戻る」→出席に復帰／16分後→欠課になっていること。復帰と自動判定が同時でも誤判定しないこと
- **累積**：14分退出→1分復帰→再退出 → 1分後に欠課になること。復帰時に away_total_sec が加算されること
- 残り時間 remaining_sec が「閾値 − 累積 − 現在の経過」で返ること
- タグ付きで授業を作成し、`?tag=` で絞り込めること
- **復帰時の閾値判定**：累積14分50秒の状態で退出し、20秒後（タイマー発動前）に「戻る」→ 409 `ALREADY_ABSENT` になり欠課になっていること
- **授業終了時の確定**：退出中のまま終了 → 累積が閾値未満なら出席、以上なら欠課になり、`away` の行が残らないこと
- 一度も入室しなかったメンバーが、終了後に欠課（`joined_at` null）で記録されていること
- 待機画面（`preparing`）で接続・切断しても出席が記録されないこと。開始時に `lesson:started` が届き、接続中の生徒が present になること
- 理解度リセット後、`understanding:update` が 0 に戻り、生徒側のボタン選択が解除されること。`totals` はリセットしても減らないこと
- 途中入室した生徒が `GET /chat` で過去のチャットを取得できること
- `GET /api/classes/:id` の `join_code` が生徒には含まれないこと
- 資料を削除すると一覧から消え、ファイル本体も削除されること（アップロード者以外は 403）
- 接続切断→再接続で出席に復帰すること（15分以内）
- 生徒のトークンで他生徒の映像が購読できないこと／スポットライト指定後は購読できること
- クラス外ユーザーが授業APIにアクセスすると 403 になること
- 匿名質問が他の生徒には投稿者非表示、先生には表示されること
- 確認ボタンの deadline 超過応答が 409 になること（未応答の生徒の場合。応答済みの再押下は成功）

## 6. v4.2 補足（実装で決めた未記載事項・2026-10-07 並列開発で確定）

仕様に書いていなかった点を実装に合わせて明記する。振る舞いの変更ではなく未記載の補完。

| 項目 | 決定 |
|---|---|
| `PUT /lessons/:id/spotlight` のレスポンス | `{user_id}`。`user_id` は null かクラス所属の生徒のみ（それ以外 400） |
| `POST /lessons/:id/start` ／ `end` のレスポンス | `LessonDetail` |
| `POST /classes/join` のレスポンス | `ClassSummary`。参加コードは大文字小文字を区別しない。加入済みでも成功 |
| 作成系（register / classes / lessons / files）のステータス | 201 |
| ログイン失敗 | 401 `UNAUTHORIZED` |
| `ended` の授業を start ／ `live` 以外を end | 409 `CONFLICT` |
| 入力の上限 | `away_timeout_min` 1〜180、タグ 30文字以内・10個まで、パスワード 8文字以上・72バイト以内 |
| 入力の上限（v4.3・`shared/constants.js` の `LIMITS`） | ログインID 3〜50文字・半角英数字と `_` `.` `-`／表示名 30文字／クラス名 50文字／授業タイトル 100文字／タグ 30文字・10個／チャット・質問の本文 1000文字／パスワード 8文字以上・72バイト以内／アイコン 2MB（PNG・JPEG）／資料・添付 10MB。文字数は `String.length` で数える。クライアントもサーバーも `LIMITS` から読み、値を直書きしない |
| 確認ボタンの範囲（v4.3） | `timeout_sec` 10〜600、`interval_min` 0〜180。自動発動ジョブの間隔は `ATTENTION_AUTO_TICK_SEC`（15秒） |
| LiveKit トークン（v4.3） | 有効期限 6時間。LiveKit 未設定のときは 200 で `{token:null, url:null, room_name, identity}` を返し、クライアントは「配信サーバー未設定」を表示する。identity は `LIVEKIT_IDENTITY_PREFIX + user.id`。先生用の権限は「その授業のクラスの先生（`classes.teacher_id`）」かどうかで決める |
| 参加コード | 8桁・英大文字＋数字（0/O/1/I/L を除く） |
| `room_name` | `lesson-<乱数>` |
| `/uploads/...` の配信 | ログイン不要（ファイル名は推測不能な乱数）。**本番課題**：認証付き配信にするかは初回MTGで判断 |
| `ended` の授業へのトークン発行・spotlight 変更 | 拒否しない（pending #1） |
| 生徒映像の購読制御 | publisher 側のトラック購読許可（SFU が強制）＋サーバー発行トークン。生徒が広げられるのは自分のトラックだけ（v4.3 で §2 の文言を実装に合わせた。pending #2） |
| `PATCH /lessons/:id/attention/auto` のレスポンス | `{interval_min}` |
| `POST /lessons/:id/attendance/away` のレスポンス | `{status:"away"}` |
| `POST /lessons/:id/attention` のステータス | 201 |
| 受け付ける授業状態 | 質問・理解度・確認ボタンは `live` 中のみ（それ以外 409 `CONFLICT`）。理解度リセット・確認ボタンの応答も含む。ただし**質問の回答済み操作（`PATCH /questions/:id`）は `ended` でも可**（v4.3）。チャットは `ended` 以外（待機中の会話を許容） |
| Socket の ack | クライアント→サーバーの各イベントは任意で ack を受け取れる（成功 `{}`、失敗 `{error:{code,message}}`）。使わなくても動く |
| 出席の複数タブ | 同じ生徒の接続が複数あるとき、最後の1本が切れたときだけ away |
| 確認ボタンの自動発動（`interval_min`） | サーバーのメモリ保持（再起動で消える）。永続化は pending #3 |
| `POST /lessons/:id/questions` のレスポンス | `Question`（投稿者本人には `user` を含む）。`question:new` も同時に届くので id で重複除去する |
| 手動修正（`PATCH attendance/:user_id`）で `present` にしたとき | `away_total_sec` を 0 にリセットし `away_since` を NULL にする（pending #4 → B） |
| 欠課（`absent`）後の再接続 | `present` に戻さない（欠課からの復帰は先生の手動修正だけ） |
| 一時退出（`away`）中の Socket 切断 | 状態を変えない（`present` のときだけ `away` にする） |
| 挙手（body 無し投稿／`question:raise`） | `question:new`（body null）が全員に、`question:raised` が先生に、両方届く。先生画面は id で突き合わせる |
| 待機画面への導線 | クラス詳細の `preparing` の授業に「入室して待つ」ボタン（デザイン未記載のため W5 が追加。モックへの反映は後日） |
| `GET /lessons/:id` の `understanding_reset_at`（v4.5） | `LessonDetail` に `understanding_reset_at`（ISO 8601 / UTC、未リセットは null）を含める。先生画面の再読込で「リセット以降」の集計時刻を出すため（pending #9 → B。W1 1 行） |
| `GET /classes/:id/members` のロール（v4.5） | **先生のみのまま**。生徒向けクラス詳細にメンバー一覧は出さない（pending #10 → A） |
| 挙手の取り下げ（v4.5） | `DELETE /questions/:id` は本人・挙手のみ（body null）・`open`・`live` 中だけ。本文付きの質問は取り下げ不可（先生が回答済みにする）。成功で `question:cancelled {id}` を全員に送る。先生画面は `question:raised` で足した行も id で消す |
| 未応答者の名前（v4.5） | `GET /lessons/:id/attention` の `pending` は `[{id,name}]`。`pending_count` と同じ集合（`pending_count === pending.length`）。授業中の `attention:update` は従来どおり `UserBrief[]` |

## 7. F-10 プログラミングモード（v4.5・2026-10-31 追加）

> まとめ書きは docs/11。取り込み後は**この章と docs/01 F-10・docs/03 v4.5・docs/07 §15 を正とする**。
> 位置づけは拡張機能（発表の目玉候補）。実装の段階・担当・所有権は docs/11 §5（次ラウンド開始時に docs/10 へ転記）。
> 名前の文字列は shared から読む：`LESSON_MODES`・`CODE_LANGUAGES`・`CODE_RUN_KINDS`・`CODE_RUN_STATUS`・`CODE_STATES`・`CODE_LIMITS`・`CODE_DEFAULT_TEMPLATE`・`CODE_MAIN_FILE`・`codeYjsPath()`（constants）、`CLIENT_EVENTS.CODE_SYNTAX`・`SERVER_EVENTS.LESSON_MODE / CODE_*`（socket-events）、`CodeTask` ほか（api-types）。

### 7.1 REST

| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| PUT | /api/lessons/:id/mode | 先生 | `{mode:"video"\|"coding"}` → `LessonDetail`。全員に `lesson:mode`。**`live` 中のみ**（それ以外 409 `CONFLICT`）。`coding` にするとき課題が 1 つも無ければ 409 `CONFLICT`（先生画面は起動ダイアログで課題 1 を先に作る） |
| POST | /api/lessons/:id/code/tasks | 先生 | `{title, template?, language?:"java"}` → 201 `{task}`（`CodeTask`）。`template` が空・省略なら既定の Main 雛形（`CODE_DEFAULT_TEMPLATE`）。**初回作成時は自動で active に**。全員に `code:task_added`。`live`・`preparing` で可 |
| GET | /api/lessons/:id/code/tasks | 全員 | 課題一覧 `[{id, title, language, sort_order, is_active, template}]`（`sort_order` 昇順）。`ended` でも可（授業後の閲覧用） |
| PATCH | /api/code/tasks/:task_id | 先生 | `{title?, template?}` → `{task}`。**テンプレート変更は既存コードに影響しない**（再配布は下の redistribute） |
| PUT | /api/lessons/:id/code/active-task | 先生 | `{task_id}` → `{task_id}`。全員に `code:active_task`。その授業の課題でなければ 400 |
| POST | /api/code/tasks/:task_id/redistribute | 先生 | テンプレートを**全生徒の該当課題に上書き配布**（確認ダイアログ済み前提）。`code_documents.source` を置き換え、`ydoc_state` を NULL に戻す。対象の生徒それぞれに `code:reset`。→ 204 |
| GET | /api/code/tasks/:task_id/documents | 先生 | 全生徒の現在コードと最新状態 `[{user, source_head, state, last_saved_at, last_run_status}]`（`CodeDocumentSummary`）。`source_head` はコード先頭 `CODE_LIMITS.GRID_HEAD_LINES`（20）行。まだ書いていない生徒はテンプレートを `source_head` に、`state:"idle"` で返す。コードグリッドの初期表示用 |
| GET | /api/code/tasks/:task_id/documents/:user_id | 先生・本人 | コード全文＋直近の runs `CODE_LIMITS.RECENT_RUNS`（5）件 `{user, source, updated_at, last_saved_at, runs:[CodeRun]}`（`CodeDocumentDetail`）。他の生徒のものは 403 |
| POST | /api/code/tasks/:task_id/save | 生徒・先生（※） | `{source, edited_by_teacher?:bool, target_user_id?}` → 保存（`code_documents` 更新＋`code_snapshots` 追加）＋**コンパイルのみ** → `{snapshot_id, compile:{status, errors:[{line, col, message}]}}`（`SaveCodeResponse`）。`compile.status` は `ok`／`compile_error`／`runner_unavailable`。※先生が生徒のコードを保存するときは **`target_user_id` 必須**・`edited_by_teacher:true`。生徒は `target_user_id` を付けられない（400）。`coding` モード以外は 409 `NOT_CODING_MODE`。結果は本人＋先生に `code:run_result`（kind `compile`）でも配信する |
| POST | /api/code/tasks/:task_id/run | 生徒 | `{source, stdin?}` → 待ち行列に投入 → 202 `{run_id, queued_position}`（`RunCodeResponse`。`queued_position` は 0 なら即実行）。結果は `code:run_result`（kind `run`）で配信。レート超過（ユーザー×課題で 1 分 `CODE_LIMITS.RUNS_PER_MINUTE`＝6 回）は 429 `RATE_LIMITED`、実行サーバー停止中は 503 `RUNNER_UNAVAILABLE`、`coding` モード以外は 409 `NOT_CODING_MODE` |
| PUT | /api/lessons/:id/code/spotlight | 先生 | `{user_id\|null}` → `{user_id}`。全員に `code:spotlight`。`user_id` は null かクラス所属の生徒のみ（それ以外 400）。`lessons.code_spotlight_user_id` に保存 |
| GET | /api/lessons/:id/code/summary | 先生 | 授業結果画面用。課題ごと `[{task, total, compiled_ok_count, saves_histogram:[{saves, users}], first_ok_at_by_user:[{user, first_ok_at, last_state, edited_by_teacher}]}]`（`CodeTaskSummary`）。`total` はクラスの生徒数、`compiled_ok_count` は最後の保存で `compile_ok` の生徒数 |
| GET | /api/lessons/:id/code/mine | 生徒 | 授業後の自分のコード `[{task, source, last_saved_at}]`（`MyCodeDocument`）。授業中でも可。他人のコードは含めない |

- `/api/code/tasks/:task_id/...` の権限は課題の授業（`code_tasks.lesson_id`）のクラス所属で判定する（`class-member.js` を使う。自前の所属チェックを書かない）
- `source` の上限は `CODE_LIMITS.SOURCE_MAX_BYTES`（256KB・UTF-8 バイト数）、`stdin` は `CODE_LIMITS.STDIN_MAX_BYTES`（16KB）、課題タイトルは `CODE_LIMITS.TASK_TITLE_MAX`（100 文字）。超過は 400
- 課題タイトル・テンプレート・コード・stdout/stderr は**表示時に必ずエスケープ**する（コードは HTML として解釈させない）

### 7.2 Socket.IO

接続は既存のまま（`lesson_id` を渡す）。**接続時に本人用ルーム `roomNames.user(lessonId, userId)` にも入る**（`code:reset`・`code:queue`・`code:teacher_editing` の「対象生徒」「本人」宛に使う。`io.js` に `emitToUser(lessonId, userId, event, payload)` を足す。W2）。

| イベント | ペイロード | 宛先 | 説明 |
|---|---|---|---|
| `lesson:mode` | `{mode}` | 全員 | モード切替。生徒画面は映像エリア⇔エディタを切り替える |
| `code:task_added` | `{task}`（`CodeTask`） | 全員 | 課題追加（生徒側にタブが生える） |
| `code:active_task` | `{task_id}` | 全員 | 今の課題の切替（生徒のエディタはそのタブへ） |
| `code:reset` | `{task_id}` | 対象生徒 | テンプレート再配布。エディタ内容をテンプレートで置き換える（`GET tasks` で取り直す） |
| `code:status` | `{task_id, user_id, state, line?}` | 先生 | コードグリッドの枠色更新。`state` は `idle`／`syntax_error`／`compile_error`／`runtime_error`／`ok`／`running`（`CODE_STATES`）。構文エラーは生徒クライアントが検出して `code:syntax` で送り、サーバーが先生に転送する。コンパイル・実行の結果はサーバーが `code:run_result` と同時に送る |
| `code:run_result` | `{run_id, task_id, user_id, kind, status, stdout, stderr, exit_code, duration_ms}`（`CodeRun`） | 本人＋先生 | コンパイル（`kind:"compile"`。save から）／実行（`kind:"run"`）の結果。`stdout`・`stderr` は `CODE_LIMITS.OUTPUT_MAX_BYTES`（64KB）で切り詰め済み |
| `code:queue` | `{position}` | 本人 | 待ち行列の順番更新（0 で実行開始。「実行待ち N 人」表示に使う） |
| `code:spotlight` | `{user_id\|null, task_id}` | 全員 | コードスポットライト。生徒は `GET documents/:user_id` では他人を読めないので、**サーバーが `source` も載せる**：`{user_id, task_id, user:{id,name}, source}`。null で解除 |
| `code:teacher_editing` | `{task_id, user_id, editing:bool}` | 対象生徒 | 先生が拡大表示して編集を始めた（Yjs 接続）／やめた（切断） |

クライアント → サーバー：

| イベント | ペイロード | ロール | 説明 |
|---|---|---|---|
| `code:syntax` | `{task_id, has_error, line?}` | 生徒 | 生徒クライアントの Lezer 解析結果。**変化したときだけ**送る（`CODE_LIMITS.SYNTAX_DEBOUNCE_MS`＝500ms のデバウンス）。サーバーは先生に `code:status`（`syntax_error` または `idle`）として転送する |

### 7.3 Yjs 同期（Socket.IO とは別の WebSocket・段階 2）

- エンドポイント：`wss://<app>/yjs/<task_id>/<user_id>`（パスは `codeYjsPath(taskId, userId)` で組み立てる）
- 接続時：セッション Cookie でユーザーを確認し、`user_id` が本人、または授業の先生（`classes.teacher_id`）のときだけ許可。課題が存在しない・クラス外・`coding` モード以外は即切断
- サーバー：`y-websocket` をアプリに同居（`server/src/yjs/*`・W2）。Doc の更新を `CODE_LIMITS.PERSIST_INTERVAL_MS`（5 秒）おきと `save` 時に `code_documents.source / ydoc_state` へ書き戻す。再接続時は `ydoc_state` から復元
- awareness で先生カーソルを配信（名前・色）。生徒側はロックせず打ち続けられる
- 先生が接続したら対象生徒に `code:teacher_editing {editing:true}`、切断で `false`
- 段階 1（Yjs 無し）では生徒クライアントがローカル state を持ち、`save`／`run` に `source` を送るだけで動く。段階 2 で `client/src/lib/yjs-provider.js`（W2 が書き、props は docs/requests/code-yjs.md で合意）に差し替える

### 7.4 実行サーバー連携（サーバー内部・W2 / W3）

- `.env` の `CODE_RUNNER_URL`。開発：`https://emkc.org/api/v2/piston`（公開 API・秒 5 リクエスト制限）、本番：VPS 上の Piston（docs/11 §6）。**生徒のコードをアプリサーバー上で実行しない**
- 保存＝コンパイルのみ：Piston は compile+run 一体なので、保存時は `Main.java` に加えて実行を即終了させるラッパーを渡し、**stderr に `error:` を含むか・compile 段階の exit code** で `compile_error` を判定する（実装詳細は W2。仕様としては「保存＝コンパイル結果のみ返す」）
- 制限：CPU `CODE_LIMITS.CPU_TIMEOUT_MS`（10 秒）、メモリ `CODE_LIMITS.MEMORY_MB`（256MB）、出力 64KB、ネットワーク遮断（Piston 側）
- 待ち行列：アプリ内メモリ（授業ごと）。同時 `CODE_LIMITS.CONCURRENT_RUNS`（4）、FIFO。再起動で消えてよい（待っていた run は `runner_unavailable` にしない。クライアントが再送する）
- レート制限：ユーザー×課題で 1 分 6 回。超過は 429 `RATE_LIMITED`
- Piston への HTTP タイムアウト `CODE_LIMITS.RUNNER_HTTP_TIMEOUT_MS`（15 秒）。超えたら `runner_unavailable`。CPU 制限での打ち切りは `timeout`
- 死活監視：起動時と `CODE_LIMITS.RUNNER_HEALTH_INTERVAL_MS`（1 分）おきに `GET /api/v2/runtimes`。失敗が続けば `run` を 503 `RUNNER_UNAVAILABLE` で返すモードに切り替える。**エディタ・保存の DB 書き込み・先生の監視は実行サーバーが落ちても動き続ける**（保存時のコンパイルだけ `compile.status:"runner_unavailable"`）

### 7.5 受け付ける授業状態（§6 の表に準ずる）

| 操作 | `preparing` | `live` | `ended` |
|---|---|---|---|
| mode 切替・save・run・spotlight・redistribute・active-task | ✕（409） | ○ | ✕（409） |
| 課題の作成・編集（tasks POST/PATCH） | ○（事前準備） | ○ | ✕（409） |
| 課題一覧・documents・summary・mine の取得 | ○ | ○ | ○ |

### 7.6 テストケース（追加）

- `coding` にしてから `;` を抜いたコードを save → `compile.status:"compile_error"`、`errors[0].line` が合っている。先生に `code:status {state:"compile_error", line}` と `code:run_result` が届く
- `Hello` を run → `code:queue {position:0}` → `code:run_result {kind:"run", status:"ok", stdout:"Hello\n"}`
- 同じ課題で 1 分に 7 回 run → 7 回目が 429 `RATE_LIMITED`
- 同時に 5 人が run → 5 人目に `code:queue {position:1}`、順番が来たら `{position:0}`
- `CODE_RUNNER_URL` に繋がらない状態で run → 503 `RUNNER_UNAVAILABLE`。save は成功し `compile.status:"runner_unavailable"`
- 生徒が他の生徒の `documents/:user_id` を取る → 403。`mine` に他人の課題コードが混ざらない
- 先生が `target_user_id` 無しで save → 400。生徒が `target_user_id` を付けて save → 400
- redistribute 後、対象生徒に `code:reset` が届き `GET tasks` のテンプレートに置き換わる。`code_snapshots` は消えない
- `video` モードで save／run → 409 `NOT_CODING_MODE`
- 授業終了後に `GET /lessons/:id/code/summary` の `compiled_ok_count` が最後の保存の `compile_ok` の人数と一致する
