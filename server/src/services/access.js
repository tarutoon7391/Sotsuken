// アクセス権の共通判定（フェーズ0で用意。各担当はこれを使い、自前で所属チェックを書かない）
// - クラス：先生（teacher_id）か、class_members に居る生徒だけがアクセスできる
// - 授業：その授業が属するクラスに対して同じ判定をする
const { query } = require('../db/pool');

/**
 * クラスへのアクセス権を返す
 * @param {{id:number, role:string}} user  req.session.user
 * @param {number} classId
 * @returns {Promise<{ classRow: object|null, isTeacher: boolean, isMember: boolean }>}
 *   classRow が null ならクラスが存在しない
 */
async function getClassAccess(user, classId) {
  const rows = await query(
    'SELECT id, teacher_id, name, join_code FROM classes WHERE id = ?',
    [classId]
  );
  const classRow = rows[0] || null;
  if (!classRow) return { classRow: null, isTeacher: false, isMember: false };

  const isTeacher = classRow.teacher_id === user.id;
  let isMember = false;
  if (!isTeacher) {
    const m = await query(
      'SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ? LIMIT 1',
      [classId, user.id]
    );
    isMember = m.length > 0;
  }
  return { classRow, isTeacher, isMember };
}

/**
 * 授業へのアクセス権を返す
 * @param {{id:number, role:string}} user  req.session.user
 * @param {number} lessonId
 * @returns {Promise<{ lesson: object|null, classRow: object|null, isTeacher: boolean, isMember: boolean }>}
 *   lesson が null なら授業が存在しない
 */
async function getLessonAccess(user, lessonId) {
  const rows = await query(
    `SELECT id, class_id, title, room_name, status, spotlight_user_id,
            away_timeout_min, understanding_reset_at, started_at, ended_at
       FROM lessons WHERE id = ?`,
    [lessonId]
  );
  const lesson = rows[0] || null;
  if (!lesson) return { lesson: null, classRow: null, isTeacher: false, isMember: false };

  const access = await getClassAccess(user, lesson.class_id);
  return { lesson, ...access };
}

module.exports = { getClassAccess, getLessonAccess };
