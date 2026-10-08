// 授業のビジネスロジック（docs/04 §2「授業」）— 担当：W1
// 所属・先生チェックは middleware/class-member.js で済ませてから呼ぶ前提
// ※ 出席（present 記録・終了時の確定）は W2 の services/attendance.js が担当。ここからは呼ぶだけ
const crypto = require('crypto');
const { ERROR_CODES, LESSON_STATUS, FILE_KINDS } = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query, transaction } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { emitToLesson, emitToTeachers } = require('../sockets/io');
const attendance = require('./attendance');

/** LiveKit のルーム名（推測されにくいランダム文字列） */
function generateRoomName() {
  return `lesson-${crypto.randomBytes(12).toString('hex')}`;
}

/** IN (?, ?, ...) のプレースホルダ */
function placeholders(n) {
  return new Array(n).fill('?').join(', ');
}

/**
 * 授業のタグを names に置き換える（tags はクラスごとに upsert）
 * @param {object} conn      トランザクション中の接続
 * @param {number} classId
 * @param {number} lessonId
 * @param {string[]} names   ルートで正規化済み（trim・重複除去・長さ検証済み）
 */
async function replaceLessonTags(conn, classId, lessonId, names) {
  await conn.execute('DELETE FROM lesson_tags WHERE lesson_id = ?', [lessonId]);
  for (const name of names) {
    // 既存タグなら LAST_INSERT_ID(id) でその id を insertId として受け取る
    const [result] = await conn.execute(
      `INSERT INTO tags (class_id, name) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [classId, name]
    );
    await conn.execute(
      'INSERT IGNORE INTO lesson_tags (lesson_id, tag_id) VALUES (?, ?)',
      [lessonId, result.insertId]
    );
  }
}

/** 授業 id ごとのタグ名一覧 { [lessonId]: string[] } */
async function tagsByLesson(lessonIds) {
  const map = {};
  if (lessonIds.length === 0) return map;
  const rows = await query(
    `SELECT lt.lesson_id, t.name
       FROM lesson_tags lt
       JOIN tags t ON t.id = lt.tag_id
      WHERE lt.lesson_id IN (${placeholders(lessonIds.length)})
      ORDER BY t.name`,
    lessonIds
  );
  for (const r of rows) (map[r.lesson_id] ||= []).push(r.name);
  return map;
}

/**
 * 授業作成（status は preparing）
 * @returns {Promise<{id:number, room_name:string}>}
 */
async function createLesson(classId, { title, tags }) {
  const roomName = generateRoomName();
  return transaction(async (conn) => {
    const [result] = await conn.execute(
      'INSERT INTO lessons (class_id, title, room_name, status) VALUES (?, ?, ?, ?)',
      [classId, title, roomName, LESSON_STATUS.PREPARING]
    );
    await replaceLessonTags(conn, classId, result.insertId, tags || []);
    return { id: result.insertId, room_name: roomName };
  });
}

/**
 * クラスの授業一覧（開催中 → 予定 → 終了済み、それぞれ新しい順）
 * @param {number} classId
 * @param {string} [tag]  指定時はそのタグが付いた授業だけ
 */
async function listLessons(classId, tag) {
  const params = [FILE_KINDS.MATERIAL, classId];
  let tagFilter = '';
  if (tag) {
    tagFilter = `AND EXISTS (SELECT 1 FROM lesson_tags lt JOIN tags t ON t.id = lt.tag_id
                              WHERE lt.lesson_id = l.id AND t.name = ?)`;
    params.push(tag);
  }
  params.push(LESSON_STATUS.LIVE, LESSON_STATUS.PREPARING, LESSON_STATUS.ENDED);
  const rows = await query(
    `SELECT l.id, l.title, l.status, l.started_at, l.ended_at,
            (SELECT COUNT(*) FROM files f WHERE f.lesson_id = l.id AND f.kind = ?) AS material_count
       FROM lessons l
      WHERE l.class_id = ? ${tagFilter}
      ORDER BY FIELD(l.status, ?, ?, ?), COALESCE(l.started_at, l.created_at) DESC, l.id DESC`,
    params
  );
  const tags = await tagsByLesson(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    tags: tags[r.id] || [],
    started_at: r.started_at,
    ended_at: r.ended_at,
    material_count: Number(r.material_count),
  }));
}

/** クラスのタグ一覧（名前順） */
async function listTags(classId) {
  return query('SELECT id, name FROM tags WHERE class_id = ? ORDER BY name, id', [classId]);
}

/** 授業詳細（LessonDetail） */
async function getLessonDetail(lessonId) {
  const rows = await query(
    `SELECT l.id, l.class_id, l.title, l.status, l.room_name, l.spotlight_user_id,
            l.away_timeout_min, l.started_at, l.ended_at,
            t.id AS teacher_id, t.name AS teacher_name, t.icon_url AS teacher_icon_url
       FROM lessons l
       JOIN classes c ON c.id = l.class_id
       JOIN users t ON t.id = c.teacher_id
      WHERE l.id = ?`,
    [lessonId]
  );
  const r = rows[0];
  if (!r) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '授業が見つかりません');
  const tags = await tagsByLesson([r.id]);
  return {
    id: r.id,
    class_id: r.class_id,
    title: r.title,
    status: r.status,
    room_name: r.room_name,
    spotlight_user_id: r.spotlight_user_id,
    away_timeout_min: r.away_timeout_min,
    tags: tags[r.id] || [],
    started_at: r.started_at,
    ended_at: r.ended_at,
    teacher: { id: r.teacher_id, name: r.teacher_name, icon_url: r.teacher_icon_url },
  };
}

/**
 * 授業開始。同一クラスに live があれば 409 ALREADY_LIVE
 * クラス行を FOR UPDATE でロックし、同じクラスの開始処理を直列にする（二重開始の競合対策）
 */
async function startLesson(lessonId, classId) {
  await transaction(async (conn) => {
    await conn.execute('SELECT id FROM classes WHERE id = ? FOR UPDATE', [classId]);
    const [own] = await conn.execute('SELECT status FROM lessons WHERE id = ? FOR UPDATE', [lessonId]);
    if (!own[0]) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '授業が見つかりません');
    if (own[0].status === LESSON_STATUS.ENDED) {
      throw new ApiError(409, ERROR_CODES.CONFLICT, '終了した授業は開始できません');
    }
    const [live] = await conn.execute(
      'SELECT id FROM lessons WHERE class_id = ? AND status = ? LIMIT 1',
      [classId, LESSON_STATUS.LIVE]
    );
    if (live[0]) {
      throw new ApiError(409, ERROR_CODES.ALREADY_LIVE, 'このクラスには開催中の授業があります');
    }
    await conn.execute(
      'UPDATE lessons SET status = ?, started_at = UTC_TIMESTAMP() WHERE id = ?',
      [LESSON_STATUS.LIVE, lessonId]
    );
  });

  // 待機中（Socket 接続済み）の生徒を present で記録する。
  // 授業はもう live なので、ここで失敗しても lesson:started は必ず送る（送らないと生徒が待機画面に残り、
  // 再度 start しても ALREADY_LIVE になって復旧できない）。記録漏れの生徒は再接続時に present になる
  try {
    await attendance.markPresentOnStart(lessonId);
  } catch (err) {
    console.error('授業開始時の出席記録に失敗しました', err);
  }
  emitToLesson(lessonId, SERVER_EVENTS.LESSON_STARTED, {});
  return getLessonDetail(lessonId);
}

/** 授業終了（live のときだけ）。ended_at を記録し、全員に lesson:ended */
async function endLesson(lessonId) {
  const changed = await transaction(async (conn) => {
    const [own] = await conn.execute('SELECT status FROM lessons WHERE id = ? FOR UPDATE', [lessonId]);
    if (!own[0]) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '授業が見つかりません');
    if (own[0].status !== LESSON_STATUS.LIVE) {
      throw new ApiError(409, ERROR_CODES.CONFLICT, '開催中の授業ではありません');
    }
    await conn.execute(
      'UPDATE lessons SET status = ?, ended_at = UTC_TIMESTAMP() WHERE id = ?',
      [LESSON_STATUS.ENDED, lessonId]
    );
    // 出席を出席／欠課の2値に確定する（docs/03「判定SQL」3。同じトランザクション内）
    // 戻り値は状態が変わった生徒の一覧 [{user_id, status, away_total_sec}]（v4.3 裁定）
    return attendance.finalizeAttendance(lessonId, conn);
  });

  // コミット後に、確定で変わった生徒の出席を先生に送る（先生の出席一覧を再読込なしで更新するため）
  for (const row of Array.isArray(changed) ? changed : []) {
    emitToTeachers(lessonId, SERVER_EVENTS.ATTENDANCE_UPDATE, {
      user_id: row.user_id, status: row.status, away_total_sec: row.away_total_sec,
    });
  }
  emitToLesson(lessonId, SERVER_EVENTS.LESSON_ENDED, {});
  return getLessonDetail(lessonId);
}

/**
 * 授業の更新（閾値・タイトル・タグ）。指定された項目だけ変える
 * @param {number} lessonId
 * @param {number} classId
 * @param {{away_timeout_min?:number, title?:string, tags?:string[]}} changes  ルートで検証済み
 */
async function updateLesson(lessonId, classId, changes) {
  await transaction(async (conn) => {
    const sets = [];
    const params = [];
    if (changes.title !== undefined) {
      sets.push('title = ?');
      params.push(changes.title);
    }
    if (changes.away_timeout_min !== undefined) {
      sets.push('away_timeout_min = ?');
      params.push(changes.away_timeout_min);
    }
    if (sets.length > 0) {
      await conn.execute(`UPDATE lessons SET ${sets.join(', ')} WHERE id = ?`, [...params, lessonId]);
    }
    if (changes.tags !== undefined) await replaceLessonTags(conn, classId, lessonId, changes.tags);
  });
  return getLessonDetail(lessonId);
}

module.exports = {
  createLesson,
  listLessons,
  listTags,
  getLessonDetail,
  startLesson,
  endLesson,
  updateLesson,
};
