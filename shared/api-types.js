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
 * @property {string[]} tags
 * @property {string|null} started_at
 * @property {string|null} ended_at
 * @property {{ id: number, name: string, icon_url: string|null }} teacher
 */

// ---------------------------------------------------------------- 配信トークン・スポットライト

/**
 * POST /api/lessons/:id/token のレスポンス
 * @typedef {Object} TokenResponse
 * @property {string} token   LiveKit のアクセストークン（JWT）
 * @property {string} url     LiveKit サーバーの URL（wss://...）
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

// POST /api/attention/:check_id/respond（生徒）… ボディ無し。締切超過は 409 CHECK_EXPIRED

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

// ---------------------------------------------------------------- 資料・添付

/**
 * POST /api/lessons/:id/files（multipart: kind, file）のレスポンス
 * @typedef {Object} UploadFileResponse
 * @property {number} file_id
 * @property {string} url
 */

/**
 * GET /api/lessons/:id/files?kind= の要素
 * @typedef {Object} FileInfo
 * @property {number} id
 * @property {FileKind} kind
 * @property {string} file_name
 * @property {string} url
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

export {};
