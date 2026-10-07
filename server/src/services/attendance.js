// 出席（累積方式）のビジネスロジック — 担当：W2
// 状態遷移と判定 SQL は docs/03_DB設計.md「attendance」の v4.1 確定版をそのまま使う。
// - 時刻は必ず UTC_TIMESTAMP()（NOW() は使わない）
// - 累積の加算は JOIN を使わない単一テーブルの UPDATE で書く（SET の評価順を左→右に保つ）
// - 出席を記録するのは授業が live の間だけ
const { ATTENDANCE_STATUS, ERROR_CODES, LESSON_STATUS, ROLES, roomNames } = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query, transaction } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { emitToTeachers, getIo } = require('../sockets/io');

const NOTE_MAX_LENGTH = 100; // attendance.note の VARCHAR(100)

/** トランザクション内（conn あり）でも外でも同じ書き方で SQL を実行する */
function executor(conn) {
  if (!conn) return query;
  return async (sql, params = []) => {
    const [rows] = await conn.execute(sql, params);
    return rows;
  };
}

/** DATETIME（Date）を ISO 8601 / UTC の文字列にする */
function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

/**
 * 欠課までの残り秒数（閾値 − 累積 − 現在の経過）。0 未満にしない
 * @param {{ timeoutMin: number, awayTotalSec: number, awaySince: Date|string|null, now?: Date }} p
 */
function computeRemainingSec({ timeoutMin, awayTotalSec, awaySince, now = new Date() }) {
  const elapsed = awaySince ? Math.max(0, Math.floor((now.getTime() - new Date(awaySince).getTime()) / 1000)) : 0;
  return Math.max(0, timeoutMin * 60 - awayTotalSec - elapsed);
}

/** 授業の最新状態（status・閾値など）。判定は接続時のスナップショットではなく毎回 DB を見る */
async function getLesson(lessonId, conn) {
  const rows = await executor(conn)(
    'SELECT id, class_id, status, away_timeout_min, understanding_reset_at, started_at FROM lessons WHERE id = ?',
    [lessonId]
  );
  return rows[0] || null;
}

async function getRow(lessonId, userId, conn) {
  const rows = await executor(conn)(
    `SELECT user_id, status, joined_at, away_since, away_total_sec, note
       FROM attendance WHERE lesson_id = ? AND user_id = ?`,
    [lessonId, userId]
  );
  return rows[0] || null;
}

/** 先生に attendance:update を送る（行が無ければ送らない） */
async function notifyTeachers(lessonId, userId) {
  const row = await getRow(lessonId, userId);
  if (!row) return;
  emitToTeachers(lessonId, SERVER_EVENTS.ATTENDANCE_UPDATE, {
    user_id: row.user_id,
    status: row.status,
    away_total_sec: row.away_total_sec,
  });
}

/**
 * 判定SQL 2（タイマー）を1人分に絞ったもの。累積＋今回分が閾値以上の退出中の生徒を欠課にする。
 * 復帰時に閾値を超えていた生徒にも使う（タイマー待ちのすき間をなくす）。
 * @returns {Promise<boolean>} 欠課にしたら true
 */
async function absentIfExpired(lessonId, userId) {
  const result = await query(
    `UPDATE attendance a
        SET a.away_total_sec = a.away_total_sec + TIMESTAMPDIFF(SECOND, a.away_since, UTC_TIMESTAMP()),
            a.status = 'absent', a.away_since = NULL, a.updated_at = UTC_TIMESTAMP()
      WHERE a.lesson_id = ? AND a.user_id = ? AND a.status = 'away'
        AND a.away_total_sec + TIMESTAMPDIFF(SECOND, a.away_since, UTC_TIMESTAMP())
            >= (SELECT l.away_timeout_min * 60 FROM lessons l WHERE l.id = a.lesson_id AND l.status = 'live')`,
    [lessonId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * 判定SQL 1（復帰）。累積＋今回分が閾値未満のときだけ出席に戻す
 * @returns {Promise<boolean>} 出席に戻せたら true
 */
async function returnIfWithinLimit(lessonId, userId, timeoutMin) {
  const result = await query(
    `UPDATE attendance
        SET away_total_sec = away_total_sec + TIMESTAMPDIFF(SECOND, away_since, UTC_TIMESTAMP()),
            status = 'present', away_since = NULL, updated_at = UTC_TIMESTAMP()
      WHERE lesson_id = ? AND user_id = ? AND status = 'away'
        AND away_total_sec + TIMESTAMPDIFF(SECOND, away_since, UTC_TIMESTAMP()) < ? * 60`,
    [lessonId, userId, timeoutMin]
  );
  return result.affectedRows > 0;
}

/**
 * 入室（Socket 接続・授業開始時の接続中）。live のときだけ記録する。
 * - 行が無ければ present で作成（joined_at 記録）
 * - away なら復帰（判定SQL 1）。閾値以上ならその場で欠課
 * - present / absent はそのまま（欠課からの復帰は先生の手動修正だけ）
 * @returns {Promise<boolean>} 状態が変わったら true（attendance:update を送り済み）
 */
async function markJoined(lessonId, userId) {
  const lesson = await getLesson(lessonId);
  if (!lesson || lesson.status !== LESSON_STATUS.LIVE) return false;

  const inserted = await query(
    `INSERT IGNORE INTO attendance (lesson_id, user_id, status, joined_at, away_total_sec, updated_at)
     VALUES (?, ?, 'present', UTC_TIMESTAMP(), 0, UTC_TIMESTAMP())`,
    [lessonId, userId]
  );
  let changed = inserted.affectedRows > 0;
  if (!changed) {
    changed = await returnIfWithinLimit(lessonId, userId, lesson.away_timeout_min);
    if (changed) {
      // 先生の手動修正で行だけ作られていた場合など、初回入室時刻が空なら埋める
      await query(
        'UPDATE attendance SET joined_at = UTC_TIMESTAMP() WHERE lesson_id = ? AND user_id = ? AND joined_at IS NULL',
        [lessonId, userId]
      );
    } else {
      changed = await absentIfExpired(lessonId, userId);
    }
  }
  if (changed) await notifyTeachers(lessonId, userId);
  return changed;
}

/**
 * 退出（Socket 切断）。live のときだけ、present → away にする
 * @returns {Promise<boolean>} 状態が変わったら true
 */
async function markDisconnected(lessonId, userId) {
  const lesson = await getLesson(lessonId);
  if (!lesson || lesson.status !== LESSON_STATUS.LIVE) return false;

  const result = await query(
    `UPDATE attendance SET status = 'away', away_since = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
      WHERE lesson_id = ? AND user_id = ? AND status = 'present'`,
    [lessonId, userId]
  );
  if (result.affectedRows > 0) {
    await notifyTeachers(lessonId, userId);
    return true;
  }
  return false;
}

function assertLive(lesson) {
  if (lesson.status !== LESSON_STATUS.LIVE) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, '授業は開催中ではありません');
  }
}

function assertStudent(access) {
  if (access.isTeacher) throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は生徒だけができます');
}

/** AttendanceMe の形にする */
function toMe(row, timeoutMin) {
  return {
    status: row.status,
    away_total_sec: row.away_total_sec,
    remaining_sec: computeRemainingSec({
      timeoutMin,
      awayTotalSec: row.away_total_sec,
      awaySince: row.away_since,
    }),
  };
}

/** POST /lessons/:id/attendance/away（生徒）一時退出 */
async function goAway(access, userId) {
  assertStudent(access);
  const lesson = await getLesson(access.lesson.id);
  assertLive(lesson);

  const result = await query(
    `UPDATE attendance SET status = 'away', away_since = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
      WHERE lesson_id = ? AND user_id = ? AND status = 'present'`,
    [lesson.id, userId]
  );
  if (result.affectedRows > 0) {
    await notifyTeachers(lesson.id, userId);
    return { status: ATTENDANCE_STATUS.AWAY };
  }

  const row = await getRow(lesson.id, userId);
  if (!row) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '出席の記録がありません（授業に入室していません）');
  if (row.status === ATTENDANCE_STATUS.ABSENT) {
    throw new ApiError(409, ERROR_CODES.ALREADY_ABSENT, '欠課が確定しています。先生に修正を依頼してください');
  }
  return { status: ATTENDANCE_STATUS.AWAY }; // 既に away（二度押し）
}

/** POST /lessons/:id/attendance/return（生徒）復帰。閾値以上なら欠課にして 409 ALREADY_ABSENT */
async function returnFromAway(access, userId) {
  assertStudent(access);
  const lesson = await getLesson(access.lesson.id);
  assertLive(lesson);

  if (await returnIfWithinLimit(lesson.id, userId, lesson.away_timeout_min)) {
    await notifyTeachers(lesson.id, userId);
    return toMe(await getRow(lesson.id, userId), lesson.away_timeout_min);
  }

  // 0 行：閾値以上 or 既に欠課 or そもそも away ではない
  if (await absentIfExpired(lesson.id, userId)) await notifyTeachers(lesson.id, userId);

  const row = await getRow(lesson.id, userId);
  if (!row) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '出席の記録がありません（授業に入室していません）');
  if (row.status === ATTENDANCE_STATUS.PRESENT) return toMe(row, lesson.away_timeout_min); // 既に復帰済み
  throw new ApiError(409, ERROR_CODES.ALREADY_ABSENT, '欠課が確定しています。先生に修正を依頼してください');
}

/** GET /lessons/:id/attendance/me（生徒） */
async function getMyAttendance(access, userId) {
  assertStudent(access);
  const lesson = await getLesson(access.lesson.id);
  const row = await getRow(lesson.id, userId);
  if (!row) {
    // 未入室
    return { status: ATTENDANCE_STATUS.ABSENT, away_total_sec: 0, remaining_sec: lesson.away_timeout_min * 60 };
  }
  return toMe(row, lesson.away_timeout_min);
}

/** GET /lessons/:id/attendance（先生）クラスの全生徒。未入室は absent / joined_at:null */
async function listAttendance(access) {
  const lesson = await getLesson(access.lesson.id);
  const rows = await query(
    `SELECT u.id, u.name, u.role, u.icon_url,
            a.status, a.joined_at, a.away_since, a.away_total_sec, a.note
       FROM class_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN attendance a ON a.lesson_id = ? AND a.user_id = cm.user_id
      WHERE cm.class_id = ?
      ORDER BY u.name, u.id`,
    [lesson.id, lesson.class_id]
  );
  const now = new Date();
  return rows.map((r) => {
    const awayTotalSec = r.away_total_sec || 0;
    return {
      user: { id: r.id, name: r.name, role: r.role, icon_url: r.icon_url },
      status: r.status || ATTENDANCE_STATUS.ABSENT,
      joined_at: toIso(r.joined_at),
      away_since: toIso(r.away_since),
      away_total_sec: awayTotalSec,
      remaining_sec: computeRemainingSec({
        timeoutMin: lesson.away_timeout_min,
        awayTotalSec,
        awaySince: r.away_since,
        now,
      }),
      note: r.note || null,
    };
  });
}

/**
 * PATCH /lessons/:id/attendance/:user_id（先生）手動修正。どの状態からでも可
 * - away から抜けるときは今回の経過を累積に足す（記録を失わない）
 * - away にするときは away_since を今にする
 */
async function updateAttendance(access, targetUserId, body) {
  const status = body && body.status;
  if (!Object.values(ATTENDANCE_STATUS).includes(status)) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'status は present / away / absent のいずれかです');
  }
  let note = body.note === undefined ? undefined : body.note;
  if (note !== undefined && note !== null) {
    if (typeof note !== 'string') throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'note は文字列です');
    note = note.trim();
    if (note.length > NOTE_MAX_LENGTH) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, `note は${NOTE_MAX_LENGTH}文字以内です`);
    }
    if (note === '') note = null;
  }

  const lessonId = access.lesson.id;
  const member = await query(
    'SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ? LIMIT 1',
    [access.lesson.class_id, targetUserId]
  );
  if (!member.length) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'この授業のクラスの生徒ではありません');

  await transaction(async (conn) => {
    const exec = executor(conn);
    const rows = await exec(
      'SELECT status FROM attendance WHERE lesson_id = ? AND user_id = ? FOR UPDATE',
      [lessonId, targetUserId]
    );
    if (!rows.length) {
      await exec(
        `INSERT INTO attendance (lesson_id, user_id, status, joined_at, away_since, away_total_sec, updated_at, note)
         VALUES (?, ?, ?, NULL, IF(? = 'away', UTC_TIMESTAMP(), NULL), 0, UTC_TIMESTAMP(), ?)`,
        [lessonId, targetUserId, status, status, note === undefined ? null : note]
      );
      return;
    }
    const wasAway = rows[0].status === ATTENDANCE_STATUS.AWAY;
    const toAway = status === ATTENDANCE_STATUS.AWAY;
    let set;
    if (wasAway && !toAway) {
      set = `away_total_sec = away_total_sec + TIMESTAMPDIFF(SECOND, away_since, UTC_TIMESTAMP()),
             status = ?, away_since = NULL`;
    } else if (!wasAway && toAway) {
      set = 'status = ?, away_since = UTC_TIMESTAMP()';
    } else {
      set = 'status = ?';
    }
    const params = [status];
    if (note !== undefined) {
      set += ', note = ?';
      params.push(note);
    }
    await exec(
      `UPDATE attendance SET ${set}, updated_at = UTC_TIMESTAMP() WHERE lesson_id = ? AND user_id = ?`,
      [...params, lessonId, targetUserId]
    );
  });

  await notifyTeachers(lessonId, targetUserId);
  const list = await listAttendance(access);
  return list.find((r) => r.user.id === targetUserId);
}

/**
 * タイマー（判定SQL 2）。開催中の授業で、累積＋今回分が閾値以上の退出中の生徒を欠課にする。
 * 先に対象を SELECT し、同じ条件で1行ずつ UPDATE して、更新できた行だけ通知する。
 * @returns {Promise<number>} 欠課にした人数
 */
async function absentExpiredAll() {
  const targets = await query(
    `SELECT a.lesson_id, a.user_id
       FROM attendance a
       JOIN lessons l ON l.id = a.lesson_id AND l.status = 'live'
      WHERE a.status = 'away'
        AND a.away_total_sec + TIMESTAMPDIFF(SECOND, a.away_since, UTC_TIMESTAMP()) >= l.away_timeout_min * 60`
  );
  let count = 0;
  for (const t of targets) {
    if (await absentIfExpired(t.lesson_id, t.user_id)) {
      await notifyTeachers(t.lesson_id, t.user_id);
      count += 1;
    }
  }
  return count;
}

/**
 * 授業開始時（W1 の POST /lessons/:id/start から、status を live にした後に呼ぶ）。
 * その時点で Socket 接続中の生徒を present で記録する。
 * @returns {Promise<number>} 記録した人数
 */
async function markPresentOnStart(lessonId) {
  const io = getIo();
  if (!io) return 0;
  const sockets = await io.in(roomNames.students(lessonId)).fetchSockets();
  const userIds = [
    ...new Set(sockets.filter((s) => s.data.role === ROLES.STUDENT).map((s) => s.data.user.id)),
  ];
  let count = 0;
  for (const userId of userIds) {
    if (await markJoined(lessonId, userId)) count += 1;
  }
  return count;
}

/**
 * 授業終了時の確定（判定SQL 3）。W1 の POST /lessons/:id/end のトランザクション内から conn を渡して呼ぶ。
 * 結果は出席／欠課の2値になり、away の行は残らない。一度も入室しなかったメンバーは欠課（joined_at NULL）。
 * conn を省略した場合は単独のトランザクションで実行する。
 * @param {number} lessonId
 * @param {import('mysql2/promise').PoolConnection} [conn]
 */
async function finalizeAttendance(lessonId, conn) {
  const run = async (c) => {
    const exec = executor(c);
    const lesson = await getLesson(lessonId, c);
    if (!lesson) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '授業が見つかりません');

    // (a) 退出中の生徒：今回分を足し、累積が閾値以上なら欠課、未満なら出席
    await exec(
      `UPDATE attendance
          SET status = IF(away_total_sec + TIMESTAMPDIFF(SECOND, away_since, UTC_TIMESTAMP()) >= ? * 60, 'absent', 'present'),
              away_total_sec = away_total_sec + TIMESTAMPDIFF(SECOND, away_since, UTC_TIMESTAMP()),
              away_since = NULL, updated_at = UTC_TIMESTAMP()
        WHERE lesson_id = ? AND status = 'away'`,
      [lesson.away_timeout_min, lessonId]
    );
    // (b) 一度も入室しなかったクラスメンバー：欠課の行を作る（joined_at は NULL）
    await exec(
      `INSERT INTO attendance (lesson_id, user_id, status, joined_at, away_total_sec, updated_at)
       SELECT ?, cm.user_id, 'absent', NULL, 0, UTC_TIMESTAMP()
         FROM class_members cm
        WHERE cm.class_id = ?
          AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.lesson_id = ? AND a.user_id = cm.user_id)`,
      [lessonId, lesson.class_id, lessonId]
    );
  };
  if (conn) return run(conn);
  return transaction(run);
}

module.exports = {
  computeRemainingSec,
  getLesson,
  markJoined,
  markDisconnected,
  goAway,
  returnFromAway,
  getMyAttendance,
  listAttendance,
  updateAttendance,
  absentExpiredAll,
  markPresentOnStart,
  finalizeAttendance,
};
