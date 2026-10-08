// 確認ボタンのビジネスロジック — 担当：W2
// - 発動：deadline_at = 発動時刻 + timeout_sec。全員に attention:check、直後に先生へ attention:update（v4.3）
// - 応答：live 中で、deadline 以内のみ受理（超過は 409 CHECK_EXPIRED。応答済みの再押下は締切後でも成功）
// - 未応答者 ＝ その授業で present の生徒のうち、応答に無い者（docs/03）
const { ATTENDANCE_STATUS, DEFAULTS, ERROR_CODES, LESSON_STATUS } = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { getLessonAccess } = require('./access');
const { getLesson } = require('./attendance');
const { emitToLesson, emitToTeachers } = require('../sockets/io');

// 範囲は docs/04 §6「確認ボタンの範囲」（v4.3）
const TIMEOUT_SEC_MIN = 10;
const TIMEOUT_SEC_MAX = 600;
const AUTO_INTERVAL_MIN_MAX = 180;

const LIVE = LESSON_STATUS.LIVE;
const NOT_LIVE_MESSAGE = '授業は開催中ではありません';

// 自動発動の設定（授業ID → { intervalMin, lastIssuedAt }）。
// DB にカラムが無いのでサーバーのメモリに持つ（docs/03・04 §6。再起動で消える。授業が終わったら破棄）。
const autoSettings = new Map();
// 自動発動した確認の ID（GET /lessons/:id/attention の auto 用）。同じ理由でメモリに持つ（再起動後は false になる）
const autoCheckIds = new Set();

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function parseIntStrict(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/** 確認の行と、授業へのアクセス権を返す。クラス外は 403、存在しなければ 404 */
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
      WHERE a.lesson_id = ? AND a.status = ?
        AND NOT EXISTS (SELECT 1 FROM attention_responses r WHERE r.check_id = ? AND r.user_id = a.user_id)
      ORDER BY u.name, u.id`,
    [check.lesson_id, ATTENDANCE_STATUS.PRESENT, check.id]
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
 * @param {number} lessonId
 * @param {number} timeoutSec
 * @param {boolean} auto 自動発動なら true
 * @returns {Promise<{ check_id: number, deadline_at: string }>}
 */
async function issueCheck(lessonId, timeoutSec, auto) {
  // live の確認と記録を1文で行う（終了処理とすれ違っても終了後の確認を作らない）
  const result = await query(
    `INSERT INTO attention_checks (lesson_id, issued_at, deadline_at)
     SELECT l.id, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND) FROM lessons l
      WHERE l.id = ? AND l.status = ?`,
    [timeoutSec, lessonId, LIVE]
  );
  if (result.affectedRows === 0) throw new ApiError(409, ERROR_CODES.CONFLICT, NOT_LIVE_MESSAGE);
  if (auto) autoCheckIds.add(result.insertId);

  const rows = await query('SELECT id, lesson_id, issued_at, deadline_at FROM attention_checks WHERE id = ?', [
    result.insertId,
  ]);
  const check = rows[0];
  emitToLesson(lessonId, SERVER_EVENTS.ATTENTION_CHECK, {
    check_id: check.id,
    issued_at: toIso(check.issued_at),
    deadline_at: toIso(check.deadline_at),
    auto,
  });
  await notifyTeachers(check);
  return { check_id: check.id, deadline_at: toIso(check.deadline_at) };
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
  return issueCheck(lessonId, timeoutSec, false);
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

/** GET /lessons/:id/attention/auto（先生）→ {interval_min}（未設定は 0） */
function getAuto(lessonId) {
  const setting = autoSettings.get(lessonId);
  return { interval_min: setting ? setting.intervalMin : 0 };
}

/**
 * 自動発動（jobs/attention-auto.js から ATTENTION_AUTO_TICK_SEC ごとに呼ぶ）。間隔が経過した授業で発動する。
 * 1つの授業で失敗しても、ほかの授業は続ける
 * @returns {Promise<number>} 発動した回数
 */
async function runAutoChecks(now = Date.now()) {
  let count = 0;
  for (const [lessonId, setting] of autoSettings) {
    try {
      const lesson = await getLesson(lessonId);
      if (!lesson || lesson.status === LESSON_STATUS.ENDED) {
        autoSettings.delete(lessonId);
        continue;
      }
      if (lesson.status !== LIVE) continue;
      if (now - setting.lastIssuedAt < setting.intervalMin * 60 * 1000) continue;
      setting.lastIssuedAt = now;
      await issueCheck(lessonId, DEFAULTS.ATTENTION_TIMEOUT_SEC, true);
      count += 1;
    } catch (err) {
      console.error(`確認ボタンの自動発動に失敗（授業 ${lessonId}）:`, err);
    }
  }
  return count;
}

/**
 * 応答（REST の POST /attention/:check_id/respond と Socket の attention:respond の共通）
 * @param {number} checkId
 * @param {{ id: number }} user
 * @param {{ lessonId?: number }} [options] lessonId を渡すと、その授業の確認でなければ 403（Socket 用）
 */
async function respond(checkId, user, options = {}) {
  const { check, access } = await loadCheck(checkId, user);
  if (access.isTeacher) throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は生徒だけができます');
  if (options.lessonId !== undefined && check.lesson_id !== options.lessonId) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, '接続中の授業の確認ではありません');
  }
  if (access.lesson.status !== LIVE) throw new ApiError(409, ERROR_CODES.CONFLICT, NOT_LIVE_MESSAGE);

  // 締切・授業状態の判定と記録を1文で行う（締切後・終了後の INSERT を防ぐ）
  const result = await query(
    `INSERT IGNORE INTO attention_responses (check_id, user_id, responded_at)
     SELECT c.id, ?, UTC_TIMESTAMP() FROM attention_checks c
       JOIN lessons l ON l.id = c.lesson_id AND l.status = ?
      WHERE c.id = ? AND UTC_TIMESTAMP() <= c.deadline_at`,
    [user.id, LIVE, check.id]
  );
  if (result.affectedRows === 0) {
    const already = await query('SELECT 1 FROM attention_responses WHERE check_id = ? AND user_id = ?', [
      check.id,
      user.id,
    ]);
    if (already.length) return; // 応答済みの再押下は締切後でも成功（docs/04 §2 v4.3）
    const lesson = await getLesson(check.lesson_id);
    if (!lesson || lesson.status !== LIVE) throw new ApiError(409, ERROR_CODES.CONFLICT, NOT_LIVE_MESSAGE);
    throw new ApiError(409, ERROR_CODES.CHECK_EXPIRED, '確認の締切を過ぎています');
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

/**
 * GET /lessons/:id/attention（先生・v4.3）授業の確認の一覧（発動順）
 * 未応答数は「今 present の生徒のうち応答していない人数」（getResponders の pending と同じ定義）
 */
async function listChecks(lessonId) {
  const rows = await query(
    `SELECT c.id, c.issued_at, c.deadline_at,
            (SELECT COUNT(*) FROM attention_responses r WHERE r.check_id = c.id) AS responded_count,
            (SELECT COUNT(*) FROM attendance a
              WHERE a.lesson_id = c.lesson_id AND a.status = ?
                AND NOT EXISTS (SELECT 1 FROM attention_responses r WHERE r.check_id = c.id AND r.user_id = a.user_id)
            ) AS pending_count
       FROM attention_checks c
      WHERE c.lesson_id = ?
      ORDER BY c.issued_at, c.id`,
    [ATTENDANCE_STATUS.PRESENT, lessonId]
  );
  return rows.map((r) => ({
    check_id: r.id,
    issued_at: toIso(r.issued_at),
    deadline_at: toIso(r.deadline_at),
    auto: autoCheckIds.has(r.id),
    responded_count: Number(r.responded_count),
    pending_count: Number(r.pending_count),
  }));
}

module.exports = {
  issueCheck,
  issueCheckByTeacher,
  setAuto,
  getAuto,
  runAutoChecks,
  respond,
  getStatus,
  listChecks,
};
