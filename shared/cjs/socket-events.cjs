// 自動生成（shared/build-cjs.js）。直接編集せず socket-events.js を直して再生成する。
'use strict';
// Socket.IO イベント名（docs/04_API・イベント仕様.md §3 と1対1）
// イベント名の文字列をコードに直書きしない。必ずここから import する。
// 接続時は socket.io の auth オプションで { lesson_id } を渡す（CONNECT_AUTH 参照）。

/** 接続時に渡す認証情報のキー名（io(url, { auth: { lesson_id } })） */
const CONNECT_AUTH = Object.freeze({
  LESSON_ID: 'lesson_id',
});

/** クライアント → サーバー */
const CLIENT_EVENTS = Object.freeze({
  /** 雑談チャット。{ body?, file_id? }。全員 */
  CHAT_MESSAGE: 'chat:message',
  /** 理解リアクション。{ type }。生徒 */
  UNDERSTANDING_SEND: 'understanding:send',
  /** 理解度集計のリセット。{}。先生（v4.1） */
  UNDERSTANDING_RESET: 'understanding:reset',
  /** 挙手（質問ボタン）。{}。生徒 */
  QUESTION_RAISE: 'question:raise',
  /** 確認ボタン応答。{ check_id }。生徒 */
  ATTENTION_RESPOND: 'attention:respond',
});

/** サーバー → クライアント */
const SERVER_EVENTS = Object.freeze({
  /** { id, user:{id,name,role,icon_url}, body, file?, created_at }。全員 */
  CHAT_MESSAGE: 'chat:message',
  /** { understood, confused, again, total }。先生 */
  UNDERSTANDING_UPDATE: 'understanding:update',
  /** {}。全員。生徒は選択中のボタンを解除する（v4.1） */
  UNDERSTANDING_RESET: 'understanding:reset',
  /** { id, user?, body, is_anonymous, created_at }。全員（匿名時 user は先生のみ） */
  QUESTION_NEW: 'question:new',
  /** { id }。全員 */
  QUESTION_ANSWERED: 'question:answered',
  /** { user:{id,name} }。先生 */
  QUESTION_RAISED: 'question:raised',
  /** { check_id, deadline_at }。生徒 */
  ATTENTION_CHECK: 'attention:check',
  /** { responded[], pending[] }。先生 */
  ATTENTION_UPDATE: 'attention:update',
  /** { user_id, status, away_total_sec }。先生 */
  ATTENDANCE_UPDATE: 'attendance:update',
  /** { user_id | null }。全員 */
  SPOTLIGHT_UPDATE: 'spotlight:update',
  /** {}。全員。待機画面の生徒は授業画面へ（v4.1） */
  LESSON_STARTED: 'lesson:started',
  /** {}。全員 */
  LESSON_ENDED: 'lesson:ended',
});

/** 予約（ストレッチ。MVP では実装しない） */
const RESERVED_EVENTS = Object.freeze({
  STATS_UPDATE: 'stats:update',     // S-01
  QUIZ_PREFIX: 'quiz:',             // S-02
  CAPTION_UPDATE: 'caption:update', // S-05
  MATERIAL_PAGE: 'material:page',   // S-06
  BREAKOUT_PREFIX: 'breakout:',     // S-07
});

module.exports = { CONNECT_AUTH, CLIENT_EVENTS, SERVER_EVENTS, RESERVED_EVENTS };
