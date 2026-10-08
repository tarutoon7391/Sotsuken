// クラスのビジネスロジック（docs/04 §2「クラス」）— 担当：W1
// 所属チェックは middleware/class-member.js（services/access.js）で済ませてから呼ぶ前提
const crypto = require('crypto');
const { ERROR_CODES, DEFAULTS, LESSON_STATUS, ROLES } = require('@sotsuken/shared/constants');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');

// 参加コードの文字種。読み間違えやすい 0/O・1/I/L は除く（英大文字＋数字）
const JOIN_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const JOIN_CODE_RETRY = 5;

/** 推測困難な参加コードを作る（暗号論的乱数） */
function generateJoinCode() {
  let code = '';
  for (let i = 0; i < DEFAULTS.JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_CHARS[crypto.randomInt(JOIN_CODE_CHARS.length)];
  }
  return code;
}

/**
 * 入力された参加コードを比較用にそろえる（空白・ハイフン除去・大文字化）
 * 画面では XXXX-XXXX と区切って表示するので、ハイフン付きで入力されても通す（v4.3 裁定）
 */
function normalizeJoinCode(raw) {
  return String(raw).replace(/[\s-]/g, '').toUpperCase();
}

// クラス一覧・詳細で共通の SELECT（先生の情報と開催中の授業 id を付ける）
const CLASS_SELECT = `
  SELECT c.id, c.name, c.join_code,
         t.id AS teacher_id, t.name AS teacher_name, t.icon_url AS teacher_icon_url,
         (SELECT l.id FROM lessons l
           WHERE l.class_id = c.id AND l.status = ?
           LIMIT 1) AS live_lesson_id
    FROM classes c
    JOIN users t ON t.id = c.teacher_id`;

/** CLASS_SELECT に条件を足して実行する（先頭の ? は開催中の status） */
function queryClasses(rest, params) {
  return query(`${CLASS_SELECT} ${rest}`, [LESSON_STATUS.LIVE, ...params]);
}

/** DB 行 → ClassSummary（join_code は含めない） */
function toSummary(row) {
  return {
    id: row.id,
    name: row.name,
    teacher: { id: row.teacher_id, name: row.teacher_name, icon_url: row.teacher_icon_url },
    live_lesson_id: row.live_lesson_id ?? null,
  };
}

/**
 * クラス作成。参加コードが衝突したら作り直す
 * @returns {Promise<{id:number, join_code:string}>}
 */
async function createClass(teacherId, name) {
  for (let i = 0; i < JOIN_CODE_RETRY; i += 1) {
    const joinCode = generateJoinCode();
    try {
      const result = await query(
        'INSERT INTO classes (teacher_id, name, join_code) VALUES (?, ?, ?)',
        [teacherId, name, joinCode]
      );
      return { id: result.insertId, join_code: joinCode };
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
  }
  throw new ApiError(500, ERROR_CODES.INTERNAL_ERROR, '参加コードの生成に失敗しました');
}

/** 自分が作った（先生）／参加している（生徒）クラス一覧。新しい順 */
async function listClasses(user) {
  const rows = user.role === ROLES.TEACHER
    ? await queryClasses('WHERE c.teacher_id = ? ORDER BY c.created_at DESC, c.id DESC', [user.id])
    : await queryClasses(
      `JOIN class_members cm ON cm.class_id = c.id AND cm.user_id = ?
       ORDER BY cm.joined_at DESC, c.id DESC`,
      [user.id]
    );
  return rows.map(toSummary);
}

/**
 * 参加コードでクラスに加入する（加入済みならそのまま成功）
 * @returns {Promise<object>} ClassSummary
 */
async function joinClass(userId, rawJoinCode) {
  const rows = await queryClasses('WHERE c.join_code = ?', [normalizeJoinCode(rawJoinCode)]);
  const row = rows[0];
  if (!row) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '参加コードに一致するクラスがありません');
  await query('INSERT IGNORE INTO class_members (class_id, user_id) VALUES (?, ?)', [row.id, userId]);
  return toSummary(row);
}

/**
 * クラス詳細（v4.1）。join_code は先生にだけ含める
 * @param {number} classId
 * @param {boolean} isTeacher  req.classAccess.isTeacher
 */
async function getClassDetail(classId, isTeacher) {
  const rows = await queryClasses('WHERE c.id = ?', [classId]);
  const row = rows[0];
  if (!row) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'クラスが見つかりません');
  const detail = toSummary(row);
  if (isTeacher) detail.join_code = row.join_code;
  return detail;
}

/** メンバー（生徒）一覧。参加順 */
async function listMembers(classId) {
  const rows = await query(
    `SELECT u.id, u.name, u.role, u.icon_url, cm.joined_at
       FROM class_members cm
       JOIN users u ON u.id = cm.user_id
      WHERE cm.class_id = ?
      ORDER BY cm.joined_at, u.id`,
    [classId]
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, role: r.role, icon_url: r.icon_url, joined_at: r.joined_at,
  }));
}

module.exports = { createClass, listClasses, joinClass, getClassDetail, listMembers };
