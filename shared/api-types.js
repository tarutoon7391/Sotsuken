// REST API のリクエスト／レスポンス型（docs/04_API・イベント仕様.md §2 と1対1）
// JSDoc の typedef だけを置く。実行時の値は持たない（import しても何も起きない）。
// 使い方：/** @type {import('@sotsuken/shared/api-types').LessonSummary} */
//
// 共通ルール：
// - ベースパス /api。JSON（アップロードのみ multipart）。日時は ISO 8601 / UTC の文字列
// - 全 API ログイン必須。エラーは { error: { code, message } }（code は constants.ERROR_CODES）

// ---------------------------------------------------------------- 共通

/**
 * @typedef {'teacher'|'student'} Role
 * @typedef {'preparing'|'live'|'ended'} LessonStatus
 * @typedef {'present'|'away'|'absent'} AttendanceStatus
 * @typedef {'understood'|'confused'|'again'} UnderstandingType
 * @typedef {'open'|'answered'} QuestionStatus
 * @typedef {'material'|'attachment'} FileKind
 * @typedef {'video'|'coding'} LessonMode                                                       F-10（v4.5）
 * @typedef {'java'} CodeLanguage                                                                F-10
 * @typedef {'compile'|'run'} CodeRunKind                                                        F-10
 * @typedef {'ok'|'compile_error'|'runtime_error'|'timeout'|'runner_unavailable'} CodeRunStatus  F-10
 * @typedef {'idle'|'syntax_error'|'compile_error'|'runtime_error'|'ok'|'running'} CodeState     F-10
 */

/**
 * エラー形式
 * @typedef {Object} ApiErrorBody
 * @property {{ code: string, message: string }} error
 */

/**
 * 名前表示に使う最小のユーザー情報（アイコン＋名前＋ロールバッジ）
 * @typedef {Object} UserBrief
 * @property {number} id
 * @property {string} name
 * @property {Role} role
 * @property {string|null} icon_url
 */

// ---------------------------------------------------------------- アカウント

/**
 * POST /api/register
 * @typedef {Object} RegisterRequest
 * @property {string} name      表示名（30文字以内）
 * @property {string} login_id  ログインID（50文字以内・一意）
 * @property {string} password
 * @property {Role} role
 */

/**
 * POST /api/login
 * @typedef {Object} LoginRequest
 * @property {string} login_id
 * @property {string} password
 */

/**
 * GET /api/me のレスポンス。register / login も同じ形を返す
 * @typedef {Object} MeResponse
 * @property {number} id
 * @property {string} name
 * @property {Role} role
 * @property {string|null} icon_url
 * @property {boolean} is_admin  ユーザー管理ページ（/admin/users）を使えるか（.env の ADMIN_LOGIN_IDS）
 */

/**
 * PUT /api/me
 * @typedef {Object} UpdateMeRequest
 * @property {string} name 表示名
 */

/**
 * POST /api/me/icon（multipart: icon）のレスポンス
 * @typedef {Object} IconResponse
 * @property {string} icon_url
 */

// ---------------------------------------------------------------- クラス

/**
 * POST /api/classes（先生）
 * @typedef {Object} CreateClassRequest
 * @property {string} name
 */

/**
 * POST /api/classes のレスポンス
 * @typedef {Object} CreateClassResponse
 * @property {number} id
 * @property {string} join_code 8桁英数字
 */

/**
 * GET /api/classes の要素
 * @typedef {Object} ClassSummary
 * @property {number} id
 * @property {string} name
 * @property {{ id: number, name: string, icon_url: string|null }} teacher
 * @property {number|null} live_lesson_id 開催中の授業（無ければ null）
 */

/**
 * POST /api/classes/join（生徒）
 * @typedef {Object} JoinClassRequest
 * @property {string} join_code
 */

/**
 * GET /api/classes/:id（v4.1）。join_code は先生にのみ含める
 * @typedef {Object} ClassDetail
 * @property {number} id
 * @property {string} name
 * @property {{ id: number, name: string, icon_url: string|null }} teacher
 * @property {string} [join_code]
 * @property {number|null} live_lesson_id
 */

/**
 * GET /api/classes/:id/members（先生）の要素
 * @typedef {UserBrief & { joined_at: string }} ClassMember
 */

// ---------------------------------------------------------------- 授業

/**
 * POST /api/classes/:id/lessons（先生）
 * @typedef {Object} CreateLessonRequest
 * @property {string} title
 * @property {string[]} [tags]
 */

/**
 * POST /api/classes/:id/lessons のレスポンス
 * @typedef {Object} CreateLessonResponse
 * @property {number} id
 * @property {string} room_name LiveKit ルーム名
 */

/**
 * GET /api/classes/:id/lessons?tag= の要素
 * @typedef {Object} LessonSummary
 * @property {number} id
 * @property {string} title
 * @property {LessonStatus} status
 * @property {string[]} tags
 * @property {string|null} started_at
 * @property {string|null} ended_at
 * @property {number} material_count
 */

/**
 * GET /api/classes/:id/tags の要素
 * @typedef {Object} Tag
 * @property {number} id
 * @property {string} name
 */

/**
 * PATCH /api/lessons/:id（先生）
 * @typedef {Object} UpdateLessonRequest
 * @property {number} [away_timeout_min]
 * @property {string} [title]
 * @property {string[]} [tags]
 */

/**
 * GET /api/lessons/:id
 * @typedef {Object} LessonDetail
 * @property {number} id
 * @property {number} class_id
 * @property {string} title
 * @property {LessonStatus} status
 * @property {string} room_name
 * @property {number|null} spotlight_user_id
 * @property {number} away_timeout_min
 * @property {string|null} understanding_reset_at 理解リアクションを最後にリセットした時刻。未リセットは null（pending #9 → B・v4.5）
 * @property {LessonMode} mode                      現在のモード。既定 'video'（F-10・v4.5）
 * @property {number|null} active_task_id           先生が指定した「今の課題」。coding 前は null（F-10・v4.5）
 * @property {number|null} code_spotlight_user_id   コードスポットライト中の生徒。null で解除（F-10・v4.5）
 * @property {string[]} tags
 * @property {string|null} started_at
 * @property {string|null} ended_at
 * @property {{ id: number, name: string, icon_url: string|null }} teacher
 */

// ---------------------------------------------------------------- 配信トークン・スポットライト

/**
 * POST /api/lessons/:id/token のレスポンス
 * @typedef {Object} TokenResponse
 * @property {string|null} token   LiveKit のアクセストークン（JWT）。LiveKit 未設定なら null（v4.3）
 * @property {string|null} url     LiveKit サーバーの URL（wss://...）。未設定なら null（v4.3）
 * @property {string} room_name
 * @property {string} identity 自分の participant identity（"user:{id}" 形式）
 */

/**
 * PUT /api/lessons/:id/spotlight（先生）
 * @typedef {Object} SpotlightRequest
 * @property {number|null} user_id null で解除
 */

// ---------------------------------------------------------------- 出席

/**
 * GET /api/lessons/:id/attendance（先生）の要素。未入室の生徒は status:"absent", joined_at:null
 * @typedef {Object} AttendanceRow
 * @property {UserBrief} user
 * @property {AttendanceStatus} status
 * @property {string|null} joined_at
 * @property {string|null} away_since
 * @property {number} away_total_sec 累積退出秒数
 * @property {number} remaining_sec  欠課までの残り秒数（閾値 − 累積 − 現在の経過。0未満にしない）
 * @property {string|null} note
 */

/**
 * GET /api/lessons/:id/attendance/me（生徒）
 * @typedef {Object} AttendanceMe
 * @property {AttendanceStatus} status
 * @property {number} away_total_sec
 * @property {number} remaining_sec
 */

/**
 * PATCH /api/lessons/:id/attendance/:user_id（先生）
 * @typedef {Object} UpdateAttendanceRequest
 * @property {AttendanceStatus} status
 * @property {string} [note]
 */

// POST /api/lessons/:id/attendance/away  … ボディ無し。204 または { status:"away" }
// POST /api/lessons/:id/attendance/return … ボディ無し。成功は AttendanceMe、欠課確定は 409 ALREADY_ABSENT

// ---------------------------------------------------------------- 確認ボタン

/**
 * POST /api/lessons/:id/attention（先生）
 * @typedef {Object} IssueAttentionRequest
 * @property {number} [timeout_sec] 既定 60
 */

/**
 * POST /api/lessons/:id/attention のレスポンス
 * @typedef {Object} AttentionCheck
 * @property {number} check_id
 * @property {string} deadline_at
 */

/**
 * PATCH /api/lessons/:id/attention/auto（先生）
 * @typedef {Object} AttentionAutoRequest
 * @property {number} interval_min 0 で無効
 */

/**
 * GET /api/attention/:check_id（先生）
 * @typedef {Object} AttentionStatus
 * @property {number} check_id
 * @property {string} deadline_at
 * @property {UserBrief[]} responded
 * @property {UserBrief[]} pending
 */

// POST /api/attention/:check_id/respond（生徒）… ボディ無し。締切超過は 409 CHECK_EXPIRED（応答済みの再押下は成功・v4.3）

/**
 * GET /api/lessons/:id/attention の要素（先生・v4.3）
 * @typedef {Object} AttentionSummary
 * @property {number} check_id
 * @property {string} issued_at
 * @property {string} deadline_at
 * @property {boolean} auto 自動発動なら true
 * @property {number} responded_count
 * @property {number} pending_count
 * @property {{ id: number, name: string }[]} pending 未応答者の id と名前（pending_count と同じ集合。授業結果で名前を出す・v4.5）
 */

// GET /api/lessons/:id/attention/auto（先生・v4.3）… {interval_min}

// ---------------------------------------------------------------- 理解リアクション

/**
 * GET /api/lessons/:id/understanding（先生・v4.1）
 * @typedef {Object} UnderstandingSummary
 * @property {{ understood: number, confused: number, again: number, total: number }} current 最後のリセット以降の各生徒の最新1件
 * @property {{ understood: number, confused: number, again: number }} totals 授業全体の送信回数
 */

// ---------------------------------------------------------------- 質問

/**
 * POST /api/lessons/:id/questions（生徒）。挙手のみは body 省略
 * @typedef {Object} PostQuestionRequest
 * @property {string} [body]
 * @property {boolean} [is_anonymous]
 */

/**
 * GET /api/lessons/:id/questions の要素。匿名の user は先生にのみ含める
 * @typedef {Object} Question
 * @property {number} id
 * @property {UserBrief} [user]
 * @property {string|null} body null は挙手のみ
 * @property {boolean} is_anonymous
 * @property {QuestionStatus} status
 * @property {string} created_at
 */

/**
 * PATCH /api/questions/:id（先生）
 * @typedef {Object} UpdateQuestionRequest
 * @property {'answered'} status
 */

// DELETE /api/questions/:id（生徒本人）… ボディ無し。挙手のみ（body null）・open・live 中だけ。204 → 全員に question:cancelled {id}（v4.5）

// ---------------------------------------------------------------- 資料・添付

/**
 * POST /api/lessons/:id/files（multipart: kind, file）のレスポンス
 * @typedef {Object} UploadFileResponse
 * @property {number} file_id
 * @property {string} url
 * @property {string|null} preview_url Office 資料を変換したプレビュー用 PDF の URL（/uploads/...）。変換していない・失敗したときは null（v4.4）
 */

/**
 * GET /api/lessons/:id/files?kind= の要素
 * @typedef {Object} FileInfo
 * @property {number} id
 * @property {FileKind} kind
 * @property {string} file_name
 * @property {string} url
 * @property {string|null} preview_url Office 資料を変換したプレビュー用 PDF の URL（/uploads/...）。変換していない・失敗したときは null（v4.4）
 * @property {string} mime
 * @property {number} size
 * @property {number} uploader_id
 * @property {string} created_at
 */

// DELETE /api/files/:id … アップロード者のみ。204

// ---------------------------------------------------------------- チャット

/**
 * GET /api/lessons/:id/chat?before=&limit= の要素（chat:message と同じ形）
 * @typedef {Object} ChatMessage
 * @property {number} id
 * @property {UserBrief} user
 * @property {string|null} body
 * @property {FileInfo} [file]
 * @property {string} created_at
 */

// ---------------------------------------------------------------- F-10 プログラミングモード（docs/04 §7・v4.5）

/**
 * PUT /api/lessons/:id/mode（先生）。レスポンスは LessonDetail
 * @typedef {Object} SetLessonModeRequest
 * @property {LessonMode} mode
 */

/**
 * 課題。GET /api/lessons/:id/code/tasks の要素、POST / PATCH の `{task}`、code:task_added の `task`
 * @typedef {Object} CodeTask
 * @property {number} id
 * @property {number} lesson_id
 * @property {string} title
 * @property {CodeLanguage} language
 * @property {string} template   初期コード（空なら CODE_DEFAULT_TEMPLATE を入れて保存する）
 * @property {number} sort_order
 * @property {boolean} is_active lessons.active_task_id と一致するか
 * @property {string} created_at
 */

/**
 * POST /api/lessons/:id/code/tasks（先生）
 * @typedef {Object} CreateCodeTaskRequest
 * @property {string} title           CODE_LIMITS.TASK_TITLE_MAX 文字以内
 * @property {string} [template]      省略・空なら既定の雛形
 * @property {CodeLanguage} [language] 既定 'java'
 */

/**
 * PATCH /api/code/tasks/:task_id（先生）
 * @typedef {Object} UpdateCodeTaskRequest
 * @property {string} [title]
 * @property {string} [template]  既存の生徒コードには影響しない
 */

/**
 * PUT /api/lessons/:id/code/active-task（先生）。レスポンスも {task_id}
 * @typedef {Object} SetActiveTaskRequest
 * @property {number} task_id
 */

// POST /api/code/tasks/:task_id/redistribute（先生）… ボディ無し。204。対象生徒に code:reset

/**
 * GET /api/code/tasks/:task_id/documents（先生）の要素。コードグリッド用
 * @typedef {Object} CodeDocumentSummary
 * @property {UserBrief} user
 * @property {string} source_head          先頭 CODE_LIMITS.GRID_HEAD_LINES 行。未着手の生徒はテンプレート
 * @property {CodeState} state             枠色。未着手は 'idle'
 * @property {string|null} last_saved_at   最後の保存（code_snapshots.saved_at）。未保存は null
 * @property {CodeRunStatus|null} last_run_status 直近のコンパイル／実行の結果。無ければ null
 */

/**
 * コンパイル・実行 1 回分。code:run_result と同じ形
 * @typedef {Object} CodeRun
 * @property {number} run_id
 * @property {number} task_id
 * @property {number} user_id
 * @property {CodeRunKind} kind
 * @property {CodeRunStatus} status
 * @property {string|null} stdout      CODE_LIMITS.OUTPUT_MAX_BYTES で切り詰め済み
 * @property {string|null} stderr
 * @property {number|null} exit_code
 * @property {number|null} duration_ms
 * @property {string} created_at
 */

/**
 * GET /api/code/tasks/:task_id/documents/:user_id（先生・本人）
 * @typedef {Object} CodeDocumentDetail
 * @property {UserBrief} user
 * @property {string} source
 * @property {string} updated_at
 * @property {string|null} last_saved_at
 * @property {CodeRun[]} runs   直近 CODE_LIMITS.RECENT_RUNS 件（新しい順）
 */

/**
 * POST /api/code/tasks/:task_id/save（生徒・先生）
 * @typedef {Object} SaveCodeRequest
 * @property {string} source                 CODE_LIMITS.SOURCE_MAX_BYTES 以内
 * @property {boolean} [edited_by_teacher]   先生が生徒のコードを保存するとき true
 * @property {number} [target_user_id]       先生のときだけ必須（保存先の生徒）。生徒が付けると 400
 */

/**
 * コンパイルエラー 1 件
 * @typedef {Object} CompileError
 * @property {number} line
 * @property {number|null} col
 * @property {string} message
 */

/**
 * POST /api/code/tasks/:task_id/save のレスポンス
 * @typedef {Object} SaveCodeResponse
 * @property {number} snapshot_id
 * @property {{ status: CodeRunStatus, errors: CompileError[] }} compile  status は ok / compile_error / runner_unavailable
 */

/**
 * POST /api/code/tasks/:task_id/run（生徒）
 * @typedef {Object} RunCodeRequest
 * @property {string} source
 * @property {string} [stdin]  CODE_LIMITS.STDIN_MAX_BYTES 以内
 */

/**
 * POST /api/code/tasks/:task_id/run のレスポンス（202）。結果は code:run_result で届く
 * @typedef {Object} RunCodeResponse
 * @property {number} run_id
 * @property {number} queued_position  0 なら即実行
 */

/**
 * PUT /api/lessons/:id/code/spotlight（先生）。レスポンスも {user_id}
 * @typedef {Object} CodeSpotlightRequest
 * @property {number|null} user_id null で解除
 */

/**
 * GET /api/lessons/:id/code/summary（先生）の要素。授業結果画面用
 * @typedef {Object} CodeTaskSummary
 * @property {CodeTask} task
 * @property {number} total              クラスの生徒数
 * @property {number} compiled_ok_count  最後の保存で compile_ok の生徒数
 * @property {{ saves: number, users: number }[]} saves_histogram  保存回数ごとの人数（saves 昇順。0 回も含む）
 * @property {{ user: UserBrief, first_ok_at: string|null, last_state: CodeState, edited_by_teacher: boolean }[]} first_ok_at_by_user
 */

/**
 * GET /api/lessons/:id/code/mine（生徒）の要素。授業後の自分のコード
 * @typedef {Object} MyCodeDocument
 * @property {CodeTask} task
 * @property {string} source
 * @property {string|null} last_saved_at
 */

export {};
