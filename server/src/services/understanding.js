// 理解リアクションのビジネスロジック — 担当：W2
// 集計の定義（docs/03 v4.1）：
// - current：lessons.understanding_reset_at 以降（NULL なら授業全体）の「各生徒の最新1件」を数える
// - totals ：その授業の全リアクションの件数（リセットしても減らない）
// リセットは understanding_reset_at を更新するだけで行は消さない。
const { ERROR_CODES, LESSON_STATUS, UNDERSTANDING_TYPES } = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { getLesson } = require('./attendance');
const { emitToLesson, emitToTeachers } = require('../sockets/io');

const TYPES = Object.values(UNDERSTANDING_TYPES);

function emptyCounts() {
  return Object.fromEntries(TYPES.map((t) => [t, 0]));
}

/** 現在の集計 { understood, confused, again, total } */
async function getCurrent(lessonId) {
  const rows = await query(
    `SELECT t.type, COUNT(*) AS cnt
       FROM (
         SELECT r.type,
                ROW_NUMBER() OVER (PARTITION BY r.user_id ORDER BY r.created_at DESC, r.id DESC) AS rn
           FROM understanding_reactions r
           JOIN lessons l ON l.id = r.lesson_id
          WHERE r.lesson_id = ?
            AND (l.understanding_reset_at IS NULL OR r.created_at > l.understanding_reset_at)
       ) t
      WHERE t.rn = 1
      GROUP BY t.type`,
    [lessonId]
  );
  const counts = emptyCounts();
  let total = 0;
  for (const r of rows) {
    counts[r.type] = Number(r.cnt);
    total += Number(r.cnt);
  }
  return { ...counts, total };
}

/** 授業全体の送信回数 { understood, confused, again } */
async function getTotals(lessonId) {
  const rows = await query(
    'SELECT type, COUNT(*) AS cnt FROM understanding_reactions WHERE lesson_id = ? GROUP BY type',
    [lessonId]
  );
  const counts = emptyCounts();
  for (const r of rows) counts[r.type] = Number(r.cnt);
  return counts;
}

/** GET /lessons/:id/understanding（先生） */
async function getSummary(lessonId) {
  const [current, totals] = await Promise.all([getCurrent(lessonId), getTotals(lessonId)]);
  return { current, totals };
}

/** understanding:send（生徒）。保存して先生に understanding:update */
async function send(lessonId, userId, type) {
  if (!TYPES.includes(type)) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'type は understood / confused / again のいずれかです');
  }
  const lesson = await getLesson(lessonId);
  if (!lesson || lesson.status !== LESSON_STATUS.LIVE) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, '授業は開催中ではありません');
  }
  await query(
    'INSERT INTO understanding_reactions (lesson_id, user_id, type, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())',
    [lessonId, userId, type]
  );
  const current = await getCurrent(lessonId);
  emitToTeachers(lessonId, SERVER_EVENTS.UNDERSTANDING_UPDATE, current);
  return current;
}

/** understanding:reset（先生）。全員に understanding:reset、先生に 0 件の understanding:update */
async function reset(lessonId) {
  await query('UPDATE lessons SET understanding_reset_at = UTC_TIMESTAMP() WHERE id = ?', [lessonId]);
  emitToLesson(lessonId, SERVER_EVENTS.UNDERSTANDING_RESET, {});
  const current = await getCurrent(lessonId);
  emitToTeachers(lessonId, SERVER_EVENTS.UNDERSTANDING_UPDATE, current);
  return current;
}

module.exports = { getCurrent, getTotals, getSummary, send, reset };
