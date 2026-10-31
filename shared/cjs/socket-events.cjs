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
  /** 生徒クライアントの構文解析結果。{ task_id, has_error, line? }。生徒。変化時のみ・500ms デバウンス（F-10・v4.5） */
  CODE_SYNTAX: 'code:syntax',
});

/** サーバー → クライアント */
const SERVER_EVENTS = Object.freeze({
  /** { id, user:{id,name,role,icon_url}, body, file?, created_at }。全員 */
  CHAT_MESSAGE: 'chat:message',
  /** { understood, confused, again, total }。先生 */
  UNDERSTANDING_UPDATE: 'understanding:update',
  /** {}。全員。生徒は選択中のボタンを解除する（v4.1） */
  UNDERSTANDING_RESET: 'understanding:reset',
  /** { id, user?, body, is_anonymous, status, created_at }。全員（匿名時 user は先生のみ） */
  QUESTION_NEW: 'question:new',
  /** { id }。全員 */
  QUESTION_ANSWERED: 'question:answered',
  /** { id }。全員。挙手が取り下げられた（DELETE /api/questions/:id）。先生は一覧から消し、本人は挙手中表示を戻す（v4.5） */
  QUESTION_CANCELLED: 'question:cancelled',
  /** { user:{id,name} }。先生 */
  QUESTION_RAISED: 'question:raised',
  /** { check_id, issued_at, deadline_at, auto }。全員（生徒は応答ポップアップ、先生は応答状況の表示に使う） */
  ATTENTION_CHECK: 'attention:check',
  /** { responded[], pending[] }。先生。発動直後と応答のたびに送る */
  ATTENTION_UPDATE: 'attention:update',
  /** { user_id, status, away_total_sec }。先生 */
  ATTENDANCE_UPDATE: 'attendance:update',
  /** { user_id | null }。全員 */
  SPOTLIGHT_UPDATE: 'spotlight:update',
  /** {}。全員。待機画面の生徒は授業画面へ（v4.1） */
  LESSON_STARTED: 'lesson:started',
  /** {}。全員 */
  LESSON_ENDED: 'lesson:ended',
  /** { file }（FileInfo）。全員。先生が資料（kind=material）をアップロードしたとき */
  MATERIAL_ADDED: 'material:added',

  // ---- F-10 プログラミングモード（docs/04 §7・v4.5）
  /** { mode }。全員。モード切替（生徒画面は映像エリア⇔エディタ） */
  LESSON_MODE: 'lesson:mode',
  /** { task }（CodeTask）。全員。課題追加（生徒側にタブが生える） */
  CODE_TASK_ADDED: 'code:task_added',
  /** { task_id }。全員。今の課題の切替 */
  CODE_ACTIVE_TASK: 'code:active_task',
  /** { task_id }。対象生徒（roomNames.user）。テンプレート再配布。エディタ内容を置き換える */
  CODE_RESET: 'code:reset',
  /** { task_id, user_id, state, line? }。先生。コードグリッドの枠色更新（state は CODE_STATES） */
  CODE_STATUS: 'code:status',
  /** { run_id, task_id, user_id, kind, status, stdout, stderr, exit_code, duration_ms }（CodeRun）。本人＋先生 */
  CODE_RUN_RESULT: 'code:run_result',
  /** { position }。本人。待ち行列の順番（0 で実行開始） */
  CODE_QUEUE: 'code:queue',
  /** { user_id | null, task_id, user?:{id,name}, source? }。全員。コードスポットライト（null で解除） */
  CODE_SPOTLIGHT: 'code:spotlight',
  /** { task_id, user_id, editing }。対象生徒。先生が拡大表示して編集を始めた／やめた（Yjs 接続・切断） */
  CODE_TEACHER_EDITING: 'code:teacher_editing',
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
