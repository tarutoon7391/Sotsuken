// F-10 プログラミングモード：モード切替・コードスポットライト（docs/04 §7.1）— 担当：W2（配信）
// 先生チェックは middleware/class-member.js（teacherOnly）で済ませてから呼ぶ前提
const { ERROR_CODES, LESSON_MODES, LESSON_STATUS } = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { emitToLesson } = require('../sockets/io');
const lessons = require('./lessons');
const codeTasks = require('./code-tasks');

const NOT_LIVE_MESSAGE = '授業は開催中ではありません';

/**
 * PUT /lessons/:id/mode（先生・live 中）{mode} → LessonDetail。全員に lesson:mode
 * coding にするとき課題が 1 つも無ければ 409（先生画面は起動ダイアログで課題 1 を先に作る）
 */
async function setMode(lesson, input) {
  if (lesson.status !== LESSON_STATUS.LIVE) throw new ApiError(409, ERROR_CODES.CONFLICT, NOT_LIVE_MESSAGE);
  const mode = input && input.mode;
  if (!Object.values(LESSON_MODES).includes(mode)) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'mode は "video" か "coding" です');
  }
  if (mode === LESSON_MODES.CODING) {
    const tasks = await query('SELECT 1 FROM code_tasks WHERE lesson_id = ? LIMIT 1', [lesson.id]);
    if (!tasks.length) {
      throw new ApiError(409, ERROR_CODES.CONFLICT, '課題が 1 つもありません。先に課題を追加してください');
    }
  }
  await query('UPDATE lessons SET mode = ? WHERE id = ?', [mode, lesson.id]);
  emitToLesson(lesson.id, SERVER_EVENTS.LESSON_MODE, { mode });
  return lessons.getLessonDetail(lesson.id);
}

/**
 * PUT /lessons/:id/code/spotlight（先生・live 中）{user_id|null} → {user_id}
 * 全員に code:spotlight（生徒は他人のコードを読めないので、サーバーが source も載せる）
 */
async function setCodeSpotlight(access, input) {
  const { lesson, classRow } = access;
  if (lesson.status !== LESSON_STATUS.LIVE) throw new ApiError(409, ERROR_CODES.CONFLICT, NOT_LIVE_MESSAGE);
  const body = input || {};
  if (!Object.prototype.hasOwnProperty.call(body, 'user_id')) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'user_id を指定してください（解除は null）');
  }
  const userId = body.user_id;
  if (userId !== null && !(Number.isInteger(userId) && userId > 0)) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'user_id が不正です');
  }

  let payload = { user_id: null, task_id: lesson.active_task_id };
  if (userId !== null) {
    const member = await query(
      `SELECT u.id, u.name FROM class_members m JOIN users u ON u.id = m.user_id
        WHERE m.class_id = ? AND m.user_id = ? LIMIT 1`,
      [classRow.id, userId]
    );
    if (!member.length) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '指定したユーザーはこのクラスの生徒ではありません');
    if (lesson.active_task_id == null) {
      throw new ApiError(409, ERROR_CODES.CONFLICT, '今の課題がありません。先に課題を追加してください');
    }
    const task = await codeTasks.findTask(lesson.active_task_id);
    const doc = await codeTasks.findDocument(task.id, userId);
    payload = {
      user_id: userId,
      task_id: task.id,
      user: { id: member[0].id, name: member[0].name },
      source: doc ? doc.source : task.template,
    };
  }

  await query('UPDATE lessons SET code_spotlight_user_id = ? WHERE id = ?', [userId, lesson.id]);
  emitToLesson(lesson.id, SERVER_EVENTS.CODE_SPOTLIGHT, payload);
  return { user_id: userId };
}

module.exports = { setMode, setCodeSpotlight };
