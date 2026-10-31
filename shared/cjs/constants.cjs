// 自動生成（shared/build-cjs.js）。直接編集せず constants.js を直して再生成する。
'use strict';
// 共有定数（docs/04_API・イベント仕様.md と docs/03_DB設計.md に対応）
// ここに無い値を各担当が勝手に増やさない。変更は @manager に相談してから。
// サーバー（CommonJS）からは require('@sotsuken/shared/constants')、
// クライアントからは import { ... } from '@sotsuken/shared/constants' で読む。

/** ロール（users.role） */
const ROLES = Object.freeze({
  TEACHER: 'teacher',
  STUDENT: 'student',
});

/** 授業の状態（lessons.status） */
const LESSON_STATUS = Object.freeze({
  PREPARING: 'preparing',
  LIVE: 'live',
  ENDED: 'ended',
});

/** 出席の状態（attendance.status） */
const ATTENDANCE_STATUS = Object.freeze({
  PRESENT: 'present',
  AWAY: 'away',
  ABSENT: 'absent',
});

/** 理解リアクションの種別（understanding_reactions.type） */
const UNDERSTANDING_TYPES = Object.freeze({
  UNDERSTOOD: 'understood', // わかった
  CONFUSED: 'confused',     // わからない
  AGAIN: 'again',           // もう一度
});

/** 質問の状態（questions.status） */
const QUESTION_STATUS = Object.freeze({
  OPEN: 'open',
  ANSWERED: 'answered',
});

/** ファイルの種別（files.kind） */
const FILE_KINDS = Object.freeze({
  MATERIAL: 'material',     // 先生の資料
  ATTACHMENT: 'attachment', // チャット添付
});

/** API のエラーコード（{ error: { code, message } } の code） */
const ERROR_CODES = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST',         // 400 パラメータ不正
  UNAUTHORIZED: 'UNAUTHORIZED',       // 401 未ログイン
  FORBIDDEN: 'FORBIDDEN',             // 403 権限なし・ロール不一致・クラス外
  NOT_FOUND: 'NOT_FOUND',             // 404 対象なし
  ALREADY_LIVE: 'ALREADY_LIVE',       // 409 同一クラスに開催中の授業がある
  ALREADY_ABSENT: 'ALREADY_ABSENT',   // 409 復帰時に欠課確定済み
  CHECK_EXPIRED: 'CHECK_EXPIRED',     // 409 確認ボタンの締切超過
  CONFLICT: 'CONFLICT',               // 409 その他の競合（ログインID重複など）
  NOT_CODING_MODE: 'NOT_CODING_MODE', // 409 プログラミングモード以外で save / run した（F-10・v4.5）
  RATE_LIMITED: 'RATE_LIMITED',       // 429 実行回数の上限超過（F-10・v4.5）
  INTERNAL_ERROR: 'INTERNAL_ERROR',   // 500
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED', // 501 スタブ（フェーズ0のみ。本実装で消える）
  RUNNER_UNAVAILABLE: 'RUNNER_UNAVAILABLE', // 503 実行サーバー（Piston）に接続できない（F-10・v4.5）
});

/** 既定値・上限 */
const DEFAULTS = Object.freeze({
  AWAY_TIMEOUT_MIN: 15,                 // 欠課判定の閾値（lessons.away_timeout_min の既定）
  ATTENTION_TIMEOUT_SEC: 60,            // 確認ボタンの応答猶予
  ATTENTION_AUTO_INTERVAL_MIN: 0,       // 自動発動の間隔（0 = 無効）
  ATTENDANCE_JOB_INTERVAL_MS: 60 * 1000, // 出席タイマーの実行間隔（1分）
  FILE_MAX_BYTES: 10 * 1024 * 1024,     // アップロード上限 10MB
  CHAT_PAGE_LIMIT: 50,                  // GET /chat の既定 limit
  CHAT_PAGE_LIMIT_MAX: 100,             // GET /chat の最大 limit
  JOIN_CODE_LENGTH: 8,                  // classes.join_code の桁数（英数字）
});

/** 入力の上限（docs/04 §6「入力の上限」と1対1。文字数は String.length で数える） */
const LIMITS = Object.freeze({
  LOGIN_ID_MIN: 3,
  LOGIN_ID_MAX: 50,
  LOGIN_ID_PATTERN: '^[A-Za-z0-9_.-]+$', // 半角英数字と _ . -（new RegExp(LIMITS.LOGIN_ID_PATTERN) で使う）
  NAME_MAX: 30,                          // 表示名（users.name）
  CLASS_NAME_MAX: 50,                    // クラス名（classes.name）
  LESSON_TITLE_MAX: 100,                 // 授業タイトル（lessons.title）
  TAG_NAME_MAX: 30,                      // タグ1つの文字数（tags.name）
  TAGS_PER_LESSON_MAX: 10,               // 1授業のタグ数
  BODY_MAX: 1000,                        // チャット・質問の本文
  PASSWORD_MIN: 8,                       // パスワード（文字数）
  PASSWORD_MAX_BYTES: 72,                // パスワード（UTF-8 のバイト数。bcrypt の上限）
  ICON_MAX_BYTES: 2 * 1024 * 1024,       // アイコン画像 2MB
  MATERIAL_MAX_BYTES: 10 * 1024 * 1024,  // 資料・添付 10MB（DEFAULTS.FILE_MAX_BYTES と同じ値）
});

/** LiveKit の participant identity の接頭辞（identity = `${LIVEKIT_IDENTITY_PREFIX}${user.id}`） */
const LIVEKIT_IDENTITY_PREFIX = 'user:';

/** 確認ボタンの自動発動ジョブの実行間隔（秒） */
const ATTENTION_AUTO_TICK_SEC = 15;

/** アップロードを許可する MIME（画像・PDF・Office 文書） */
const ALLOWED_UPLOAD_MIMES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

/** Socket.IO のルーム名（サーバー側の宛先振り分けに使う） */
const roomNames = Object.freeze({
  /** 授業の全員 */
  lesson: (lessonId) => `lesson:${lessonId}`,
  /** 授業の先生だけ */
  teachers: (lessonId) => `lesson:${lessonId}:teacher`,
  /** 授業の生徒だけ */
  students: (lessonId) => `lesson:${lessonId}:student`,
  /** 授業内の特定のユーザーだけ（code:reset / code:queue / code:teacher_editing の宛先。F-10・v4.5） */
  user: (lessonId, userId) => `lesson:${lessonId}:user:${userId}`,
});

// ---------------------------------------------------------------- F-10 プログラミングモード（docs/04 §7・docs/03 v4.5）

/** 授業のモード（lessons.mode） */
const LESSON_MODES = Object.freeze({
  VIDEO: 'video',   // 通常（映像）
  CODING: 'coding', // プログラミングモード（生徒の映像エリアがエディタになる）
});

/** 課題の言語（code_tasks.language）。対応は java のみ */
const CODE_LANGUAGES = Object.freeze({
  JAVA: 'java',
});

/** コンパイル・実行の種別（code_runs.kind） */
const CODE_RUN_KINDS = Object.freeze({
  COMPILE: 'compile', // 保存（Ctrl+S）＝コンパイルのみ
  RUN: 'run',         // ▶ 実行＝コンパイル＋実行
});

/** コンパイル・実行の結果（code_runs.status、code:run_result の status、SaveCodeResponse.compile.status） */
const CODE_RUN_STATUS = Object.freeze({
  OK: 'ok',
  COMPILE_ERROR: 'compile_error',
  RUNTIME_ERROR: 'runtime_error',
  TIMEOUT: 'timeout',                       // CPU 制限で打ち切り
  RUNNER_UNAVAILABLE: 'runner_unavailable', // 実行サーバーに繋がらない
});

/** 先生のコードグリッドの枠色に使う生徒の状態（code:status の state、CodeDocumentSummary.state） */
const CODE_STATES = Object.freeze({
  IDLE: 'idle',                   // 未保存・エラーなし（グレー）
  SYNTAX_ERROR: 'syntax_error',   // 生徒クライアントの Lezer 解析でエラー（赤）
  COMPILE_ERROR: 'compile_error', // 保存時のコンパイルエラー（赤＋行番号）
  RUNTIME_ERROR: 'runtime_error', // 実行時エラー（橙）
  OK: 'ok',                       // 正常終了（緑チェック）
  RUNNING: 'running',             // 実行中・実行待ち
});

/** プログラミングモードの制限・既定値（docs/04 §7。値を直書きしない） */
const CODE_LIMITS = Object.freeze({
  TASK_TITLE_MAX: 100,                  // 課題タイトル（code_tasks.title）の文字数
  SOURCE_MAX_BYTES: 256 * 1024,         // コード 1 本の上限（UTF-8 バイト数）
  STDIN_MAX_BYTES: 16 * 1024,           // 実行時の標準入力の上限
  OUTPUT_MAX_BYTES: 64 * 1024,          // stdout / stderr の切り詰め
  CPU_TIMEOUT_MS: 10 * 1000,            // 実行サーバーの CPU 制限（compile / run それぞれ）
  MEMORY_MB: 256,                       // 実行サーバーのメモリ制限
  CONCURRENT_RUNS: 4,                   // 授業あたりの同時実行本数（超過は待ち行列）
  RUNS_PER_MINUTE: 6,                   // ユーザー×課題あたり 1 分の実行回数（超過は 429 RATE_LIMITED）
  RUNNER_HTTP_TIMEOUT_MS: 15 * 1000,    // Piston への HTTP タイムアウト（超えたら runner_unavailable）
  RUNNER_HEALTH_INTERVAL_MS: 60 * 1000, // 実行サーバーの死活監視の間隔
  PERSIST_INTERVAL_MS: 5 * 1000,        // Yjs の更新を code_documents に書き戻す間隔
  SYNTAX_DEBOUNCE_MS: 500,              // code:syntax を送るデバウンス
  GRID_HEAD_LINES: 20,                  // コードグリッドの縮小表示に使う先頭行数（source_head）
  RECENT_RUNS: 5,                       // documents/:user_id に含める直近の runs 件数
});

/** 生徒に配るファイル名（1 本固定。クラス名 Main 必須） */
const CODE_MAIN_FILE = 'Main.java';

/** 課題テンプレートが空のときの既定の雛形 */
const CODE_DEFAULT_TEMPLATE = [
  'public class Main {',
  '    public static void main(String[] args) {',
  '        ',
  '    }',
  '}',
  '',
].join('\n');

/** Yjs 同期の WebSocket パス（Socket.IO とは別。段階 2）。wss://<app> + codeYjsPath(taskId, userId) */
const CODE_YJS_PATH_PREFIX = '/yjs';
const codeYjsPath = (taskId, userId) => `${CODE_YJS_PATH_PREFIX}/${taskId}/${userId}`;

module.exports = { ROLES, LESSON_STATUS, ATTENDANCE_STATUS, UNDERSTANDING_TYPES, QUESTION_STATUS, FILE_KINDS, ERROR_CODES, DEFAULTS, LIMITS, LIVEKIT_IDENTITY_PREFIX, ATTENTION_AUTO_TICK_SEC, ALLOWED_UPLOAD_MIMES, roomNames, LESSON_MODES, CODE_LANGUAGES, CODE_RUN_KINDS, CODE_RUN_STATUS, CODE_STATES, CODE_LIMITS, CODE_MAIN_FILE, CODE_DEFAULT_TEMPLATE, CODE_YJS_PATH_PREFIX, codeYjsPath };
