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
  INTERNAL_ERROR: 'INTERNAL_ERROR',   // 500
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED', // 501 スタブ（フェーズ0のみ。本実装で消える）
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
});

module.exports = { ROLES, LESSON_STATUS, ATTENDANCE_STATUS, UNDERSTANDING_TYPES, QUESTION_STATUS, FILE_KINDS, ERROR_CODES, DEFAULTS, LIMITS, LIVEKIT_IDENTITY_PREFIX, ATTENTION_AUTO_TICK_SEC, ALLOWED_UPLOAD_MIMES, roomNames };
