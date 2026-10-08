// 質問箱・挙手のビジネスロジック — 担当：W2
// - 挙手のみ（質問ボタン / question:raise）は body NULL
// - 匿名の投稿者は先生にだけ見せる（DB には user_id を保持）
// 本文はそのまま保存し、表示側（React）でエスケープする。
const { ERROR_CODES, LESSON_STATUS, LIMITS, QUESTION_STATUS } = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { getLessonAccess } = require('./access');
const { emitToLesson, emitToStudents, emitToTeachers } = require('../sockets/io');

const SELECT_QUESTION = `
  SELECT q.id, q.body, q.is_anonymous, q.status, q.created_at,
         u.id AS user_id, u.name AS user_name, u.role AS user_role, u.icon_url AS user_icon_url
    FROM questions q
    JOIN users u ON u.id = q.user_id`;

/** DB の行 → Question。匿名の投稿者は先生以外には含めない */
function toQuestion(row, forTeacher) {
  const isAnonymous = Boolean(row.is_anonymous);
  const q = {
    id: row.id,
    body: row.body,
    is_anonymous: isAnonymous,
    status: row.status,
    created_at: new Date(row.created_at).toISOString(),
  };
  if (forTeacher || !isAnonymous) {
    q.user = { id: row.user_id, name: row.user_name, role: row.user_role, icon_url: row.user_icon_url };
  }
  return q;
}

/**
 * 入力チェック。挙手は body 省略（または question:raise）だけで、空白だけの本文は 400。
 * 挙手は匿名にしない（is_anonymous は無視して false）
 */
function normalizeInput(input) {
  const raw = input || {};
  if (raw.is_anonymous !== undefined && typeof raw.is_anonymous !== 'boolean') {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'is_anonymous は true / false です');
  }
  if (raw.body === undefined || raw.body === null) return { body: null, isAnonymous: false };

  if (typeof raw.body !== 'string') throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'body は文字列です');
  const body = raw.body.trim();
  if (body === '') throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '質問の本文が空です（挙手は本文を省略してください）');
  if (body.length > LIMITS.BODY_MAX) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, `質問は${LIMITS.BODY_MAX}文字以内です`);
  }
  return { body, isAnonymous: raw.is_anonymous === true };
}

/**
 * 投稿（REST の POST /lessons/:id/questions と Socket の question:raise の共通）。生徒のみ。
 * 全員に question:new（匿名なら生徒向けは user 抜き）。挙手（body なし）は先生に question:raised も送る
 * @param {{ lesson: object, isTeacher: boolean }} access
 * @param {{ id: number, name: string }} user
 */
async function postQuestion(access, user, input) {
  if (access.isTeacher) throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は生徒だけができます');
  const { body, isAnonymous } = normalizeInput(input);

  const lessonId = access.lesson.id;

  // live の確認と記録を1文で行う
  const result = await query(
    `INSERT INTO questions (lesson_id, user_id, body, is_anonymous, status, created_at)
     SELECT l.id, ?, ?, ?, ?, UTC_TIMESTAMP() FROM lessons l WHERE l.id = ? AND l.status = ?`,
    [user.id, body, isAnonymous, QUESTION_STATUS.OPEN, lessonId, LESSON_STATUS.LIVE]
  );
  if (result.affectedRows === 0) throw new ApiError(409, ERROR_CODES.CONFLICT, '授業は開催中ではありません');
  const rows = await query(`${SELECT_QUESTION} WHERE q.id = ?`, [result.insertId]);
  const row = rows[0];

  emitToTeachers(lessonId, SERVER_EVENTS.QUESTION_NEW, toQuestion(row, true));
  emitToStudents(lessonId, SERVER_EVENTS.QUESTION_NEW, toQuestion(row, false));
  if (body === null) {
    emitToTeachers(lessonId, SERVER_EVENTS.QUESTION_RAISED, { user: { id: user.id, name: row.user_name } });
  }
  // 投稿者本人への返り値には自分の情報を含めてよい
  return toQuestion(row, true);
}

/** GET /lessons/:id/questions（全員）古い順 */
async function listQuestions(access) {
  const rows = await query(`${SELECT_QUESTION} WHERE q.lesson_id = ? ORDER BY q.created_at, q.id`, [
    access.lesson.id,
  ]);
  return rows.map((r) => toQuestion(r, access.isTeacher));
}

/** PATCH /questions/:id（先生）{status:"answered"}。全員に question:answered */
async function answerQuestion(questionId, user, input) {
  if (!input || input.status !== QUESTION_STATUS.ANSWERED) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'status は "answered" のみ指定できます');
  }
  const found = await query('SELECT lesson_id FROM questions WHERE id = ?', [questionId]);
  if (!found.length) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '質問が見つかりません');

  const access = await getLessonAccess(user, found[0].lesson_id);
  if (!access.isTeacher) throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は授業の先生だけができます');

  // 終了済みの授業でも可（授業結果画面から操作する。docs/04 §2 v4.3）
  await query('UPDATE questions SET status = ? WHERE id = ?', [QUESTION_STATUS.ANSWERED, questionId]);
  emitToLesson(found[0].lesson_id, SERVER_EVENTS.QUESTION_ANSWERED, { id: questionId });

  const rows = await query(`${SELECT_QUESTION} WHERE q.id = ?`, [questionId]);
  return toQuestion(rows[0], true);
}

module.exports = { postQuestion, listQuestions, answerQuestion };
