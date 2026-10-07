// 確認ボタンのビジネスロジック — 担当：W2
// - 発動：deadline_at = 発動時刻 + timeout_sec。生徒に attention:check、先生に attention:update
// - 応答：deadline 以内のみ受理（超過は 409 CHECK_EXPIRED）
// - 未応答者 ＝ その授業で present の生徒のうち、応答に無い者（docs/03）
const { DEFAULTS, ERROR_CODES, LESSON_STATUS } = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { getLessonAccess } = require('./access');
const { getLesson } = require('./attendance');
const { emitToStudents, emitToTeachers } = require('../sockets/io');

const TIMEOUT_SEC_MIN = 10;
const TIMEOUT_SEC_MAX = 600;
const AUTO_INTERVAL_MIN_MAX = 180;

// 自動発動の設定（授業ID → { intervalMin, lastIssuedAt }）。
// DB にカラムが無いのでサーバーのメモリに持つ（再起動で消える。授業が live でなくなったら破棄）。
const autoSettings = new Map();

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function parseIntStrict(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/** 確認の行と、授業の先生かどうかを返す。クラス外は 403、存在しなければ 404 */
async function loadCheck(checkId, user) {
  const rows = await query('SELECT id, lesson_id, issued_at, deadline_at FROM attention_checks WHERE id = ?', [checkId]);
  const check = rows[0];
  if (!check) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '確認が見つかりません');
  const access = await getLessonAccess(user, check.lesson_id);
  if (!access.isTeacher && !access.isMember) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この授業にアクセスする権限がありません');
  }
  return { check, access };
}

/** 応答者／未応答者（UserBrief[]） */
async function getResponders(check) {
  const responded = await query(
    `SELECT u.id, u.name, u.role, u.icon_url
       FROM attention_responses r
       JOIN users u ON u.id = r.user_id
      WHERE r.check_id = ?
      ORDER BY r.responded_at, u.id`,
    [check.id]
  );
  const pending = await query(
    `SELECT u.id, u.name, u.role, u.icon_url
       FROM attendance a
       JOIN users u ON u.id = a.user_id
      WHERE a.lesson_id = ? AND a.status = 'present'
        AND NOT EXISTS (SELECT 1 FROM attention_responses r WHERE r.check_id = ? AND r.user_id = a.user_id)
      ORDER BY u.name, u.id`,
    [check.lesson_id, check.id]
  );
  const brief = (u) => ({ id: u.id, name: u.name, role: u.role, icon_url: u.icon_url });
  return { responded: responded.map(brief), pending: pending.map(brief) };
}

async function notifyTeachers(check) {
  const { responded, pending } = await getResponders(check);
  emitToTeachers(check.lesson_id, SERVER_EVENTS.ATTENTION_UPDATE, { responded, pending });
}

/**
 * 発動（先生の手動・自動発動の共通）。授業が live のときだけ
 * @returns {Promise<{ check_id: number, deadline_at: string }>}
 */
async function issueCheck(lessonId, timeoutSec = DEFAULTS.ATTENTION_TIMEOUT_SEC) {
  const lesson = await getLesson(lessonId);
  if (!lesson || lesson.status !== LESSON_STATUS.LIVE) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, '授業は開催中ではありません');
  }
  const result = await query(
    `INSERT INTO attention_checks (lesson_id, issued_at, deadline_at)
     VALUES (?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))`,
    [lessonId, timeoutSec]
  );
  const rows = await query('SELECT id, lesson_id, issued_at, deadline_at FROM attention_checks WHERE id = ?', [
    result.insertId,
  ]);
  const check = rows[0];
  const payload = { check_id: check.id, deadline_at: toIso(check.deadline_at) };
  emitToStudents(lessonId, SERVER_EVENTS.ATTENTION_CHECK, payload);
  await notifyTeachers(check);
  return payload;
}

/** POST /lessons/:id/attention（先生）{timeout_sec?} */
async function issueCheckByTeacher(lessonId, body) {
  let timeoutSec = DEFAULTS.ATTENTION_TIMEOUT_SEC;
  if (body && body.timeout_sec !== undefined) {
    timeoutSec = parseIntStrict(body.timeout_sec);
    if (timeoutSec === null || timeoutSec < TIMEOUT_SEC_MIN || timeoutSec > TIMEOUT_SEC_MAX) {
      throw new ApiError(
        400,
        ERROR_CODES.BAD_REQUEST,
        `timeout_sec は ${TIMEOUT_SEC_MIN}〜${TIMEOUT_SEC_MAX} の整数です`
      );
    }
  }
  return issueCheck(lessonId, timeoutSec);
}

/** PATCH /lessons/:id/attention/auto（先生）{interval_min}（0 で無効） */
function setAuto(lessonId, body) {
  const intervalMin = parseIntStrict(body && body.interval_min);
  if (intervalMin === null || intervalMin < 0 || intervalMin > AUTO_INTERVAL_MIN_MAX) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, `interval_min は 0〜${AUTO_INTERVAL_MIN_MAX} の整数です`);
  }
  if (intervalMin === 0) {
    autoSettings.delete(lessonId);
  } else {
    // 設定した時点から数え始める（設定直後にいきなり発動しない）
    autoSettings.set(lessonId, { intervalMin, lastIssuedAt: Date.now() });
  }
  return { interval_min: intervalMin };
}

/**
 * 自動発動（jobs/attention-auto.js から定期的に呼ぶ）。間隔が経過した授業で発動する
 * @returns {Promise<number>} 発動した回数
 */
async function runAutoChecks(now = Date.now()) {
  let count = 0;
  for (const [lessonId, setting] of autoSettings) {
    const lesson = await getLesson(lessonId);
    if (!lesson || lesson.status === LESSON_STATUS.ENDED) {
      autoSettings.delete(lessonId);
      continue;
    }
    if (lesson.status !== LESSON_STATUS.LIVE) continue;
    if (now - setting.lastIssuedAt < setting.intervalMin * 60 * 1000) continue;
    setting.lastIssuedAt = now;
    await issueCheck(lessonId, DEFAULTS.ATTENTION_TIMEOUT_SEC);
    count += 1;
  }
  return count;
}

/** 応答（REST の POST /attention/:check_id/respond と Socket の attention:respond の共通） */
async function respond(checkId, user) {
  const { check, access } = await loadCheck(checkId, user);
  if (access.isTeacher) throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は生徒だけができます');

  // 締切判定と記録を1文で行う（締切後の INSERT を防ぐ）
  const result = await query(
    `INSERT IGNORE INTO attention_responses (check_id, user_id, responded_at)
     SELECT c.id, ?, UTC_TIMESTAMP() FROM attention_checks c
      WHERE c.id = ? AND UTC_TIMESTAMP() <= c.deadline_at`,
    [user.id, check.id]
  );
  if (result.affectedRows === 0) {
    const already = await query('SELECT 1 FROM attention_responses WHERE check_id = ? AND user_id = ?', [
      check.id,
      user.id,
    ]);
    if (!already.length) throw new ApiError(409, ERROR_CODES.CHECK_EXPIRED, '確認の締切を過ぎています');
    return; // 二度押しは成功扱い
  }
  await notifyTeachers(check);
}

/** GET /attention/:check_id（先生） */
async function getStatus(checkId, user) {
  const { check, access } = await loadCheck(checkId, user);
  if (!access.isTeacher) throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は授業の先生だけができます');
  const { responded, pending } = await getResponders(check);
  return { check_id: check.id, deadline_at: toIso(check.deadline_at), responded, pending };
}

module.exports = { issueCheck, issueCheckByTeacher, setAuto, runAutoChecks, respond, getStatus };
