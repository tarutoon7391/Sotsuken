# API・イベント仕様（チーム内作業用）v4

> **この文書が分担間の「契約」。** ここに従えば各担当は独立して開発できる。
> 変更したい場合は PM に相談 → 合意後にこの文書を更新してから実装する。
> v4.1（2026-10-05）：クラス詳細・チャット履歴・理解度の取得 API、`lesson:started` / `understanding:reset` イベントを追加。出席の記録タイミング・復帰時の閾値判定・授業終了時の確定を明記。

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
| GET | /api/lessons/:id | 全員 | 授業情報 `{title, status, spotlight_user_id, teacher:{...}}` |

### 配信トークン（LiveKit）
| メソッド | パス | 説明 |
|---|---|---|
| POST | /api/lessons/:id/token | ロールに応じたトークンを発行。**先生**：publish可・全員subscribe可。**生徒**：publish可（自分のカメラ）、subscribe は「先生」と「スポットライト中の生徒」のみ許可。クラス外は 403 |

> 生徒映像を他の生徒に見せない制御は、**LiveKit のトラック購読許可（publisher 側で許可先を先生＋スポットライト時は全員に限定）＋サーバー発行トークン**で強制する。フロントの表示制御だけに頼らない。

### スポットライト
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| PUT | /api/lessons/:id/spotlight | 先生 | `{user_id}` 指定／`{user_id:null}` 解除 → 全員に `spotlight:update`。レスポンス `{user_id}`（v4.2 追記：レスポンス形が未記載だったため実装に合わせて明記） |

### 出席
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| GET | /api/lessons/:id/attendance | 先生 | **クラスの全生徒**の状態一覧 `[{user, status, joined_at, away_since, away_total_sec, remaining_sec}]`。まだ入室していない生徒は `status:"absent"`, `joined_at:null` で返す |
| GET | /api/lessons/:id/attendance/me | 生徒 | 自分の状態 `{status, away_total_sec, remaining_sec}`（一時退出中画面の残り時間表示用） |
| PATCH | /api/lessons/:id/attendance/:user_id | 先生 | `{status, note}` 手動修正 |
| POST | /api/lessons/:id/attendance/away | 生徒 | 一時退出（`away_since` 記録） |
| POST | /api/lessons/:id/attendance/return | 生徒 | 復帰。`WHERE status='away'` の条件付きUPDATEで**今回の退出時間を away_total_sec に加算**。**累積＋今回分が閾値以上ならその場で欠課にして** 409 `ALREADY_ABSENT`（タイマーを待たない）。既に absent のときも 409 `ALREADY_ABSENT`（先生に修正を依頼する導線を表示） |

> 入室（Socket接続）で present、切断で away（サーバーが自動記録）。away→absent の自動判定はサーバータイマー（1分間隔）で、**累積退出時間＋現在の経過 ≥ 閾値** を条件とする（v4）。
> **出席を記録するのは授業が `live` の間だけ**（v4.1）。開始前（`preparing`）の待機画面での接続・切断は出席に影響しない。
> 判定SQLは `03_DB設計.md` の「判定SQL」を正とする（時刻は `UTC_TIMESTAMP()`）。

### 確認ボタン
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| POST | /api/lessons/:id/attention | 先生 | 発動。`{timeout_sec:60}` → 全生徒に `attention:check` |
| PATCH | /api/lessons/:id/attention/auto | 先生 | `{interval_min}` 自動発動の設定（0で無効） |
| POST | /api/attention/:check_id/respond | 生徒 | 応答。deadline 超過は 409 `CHECK_EXPIRED` |
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
| PATCH | /api/questions/:id | 先生 | `{status:"answered"}` |

### 資料・添付
| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| POST | /api/lessons/:id/files | 先生(material) / 全員(attachment) | multipart `{kind, file}`。画像・PDF・Office文書、10MBまで → `{file_id, url}` |
| GET | /api/lessons/:id/files?kind=material | 全員 | 資料パネル用一覧（終了済み授業でも取得可） |
| DELETE | /api/files/:id | アップロード者 | 資料・添付の削除（ファイル本体も削除） |

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
| `question:new` | `{id, user?, body, is_anonymous, created_at}` | 全員（匿名時 user は先生のみ） | |
| `question:answered` | `{id}` | 全員 | |
| `question:raised` | `{user:{id,name}}` | 先生 | 挙手通知 |
| `attention:check` | `{check_id, deadline_at}` | 生徒 | ポップアップ表示トリガー |
| `attention:update` | `{responded[], pending[]}` | 先生 | 応答状況 |
| `attendance:update` | `{user_id, status, away_total_sec}` | 先生 | 出席状態の変化 |
| `spotlight:update` | `{user_id\|null}` | 全員 | 表示切替 |
| `lesson:started` | `{}` | 全員 | 授業開始。待機画面（9）の生徒は授業画面（10）へ遷移する（v4.1） |
| `lesson:ended` | `{}` | 全員 | 授業終了 |

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
- 確認ボタンの deadline 超過応答が 409 になること

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
| 参加コード | 8桁・英大文字＋数字（0/O/1/I/L を除く） |
| `room_name` | `lesson-<乱数>` |
| `/uploads/...` の配信 | ログイン不要（ファイル名は推測不能な乱数）。**本番課題**：認証付き配信にするかは初回MTGで判断 |
| `ended` の授業へのトークン発行・spotlight 変更 | 拒否しない（pending #1） |
| 生徒映像の購読制御 | publisher 側クライアント設定（pending #2）。サーバー強制は本番課題 |
| `PATCH /lessons/:id/attention/auto` のレスポンス | `{interval_min}` |
| `POST /lessons/:id/attendance/away` のレスポンス | `{status:"away"}` |
| `POST /lessons/:id/attention` のステータス | 201 |
| 受け付ける授業状態 | 質問・理解度・確認ボタンは `live` 中のみ（それ以外 409 `CONFLICT`）。チャットは `ended` 以外（待機中の会話を許容） |
| Socket の ack | クライアント→サーバーの各イベントは任意で ack を受け取れる（成功 `{}`、失敗 `{error:{code,message}}`）。使わなくても動く |
| 出席の複数タブ | 同じ生徒の接続が複数あるとき、最後の1本が切れたときだけ away |
| 確認ボタンの自動発動（`interval_min`） | サーバーのメモリ保持（再起動で消える）。永続化は pending #3 |
