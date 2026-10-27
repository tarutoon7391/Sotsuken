// ユーザー管理（運用者向け）のビジネスロジック
// 一覧・パスワードの照合／再設定・ユーザー削除。呼ぶ前に middleware/admin.js で権限を確認しておく
const bcrypt = require('bcrypt');
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { query, transaction } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { removeUploadedFile } = require('./files');

const BCRYPT_ROUNDS = 10;

function notFound() {
  return new ApiError(404, ERROR_CODES.NOT_FOUND, 'ユーザーが見つかりません');
}

/** 全ユーザー一覧（新しい順）。担当クラス数（先生）＋参加クラス数（生徒）を class_count に付ける */
async function listUsers() {
  const rows = await query(
    `SELECT u.id, u.name, u.login_id, u.role, u.icon_url, u.created_at,
            (SELECT COUNT(*) FROM classes c WHERE c.teacher_id = u.id)       AS teaching_count,
            (SELECT COUNT(*) FROM class_members cm WHERE cm.user_id = u.id) AS member_count
       FROM users u
      ORDER BY u.created_at DESC, u.id DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    login_id: r.login_id,
    role: r.role,
    icon_url: r.icon_url,
    created_at: r.created_at,
    class_count: Number(r.teaching_count) + Number(r.member_count),
  }));
}

/** そのユーザーのログインセッションを全部消す（削除・パスワード再設定の後に呼ぶ）。sessions が無ければ何もしない */
async function destroySessionsOf(userId) {
  try {
    await query("DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.user.id') = ?", [userId]);
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
  }
}

/**
 * 入力されたパスワードが登録済みのものと一致するか（ハッシュなので中身は見せられない。合う／合わないだけ返す）
 * @returns {Promise<{match: boolean}>}
 */
async function verifyPassword(userId, password) {
  const rows = await query('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (!rows[0]) throw notFound();
  return { match: await bcrypt.compare(password, rows[0].password_hash) };
}

/** パスワードを新しいものに置き換える。そのユーザーのセッションは全部無効にする */
async function resetPassword(userId, password) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
  if (result.affectedRows === 0) throw notFound();
  await destroySessionsOf(userId);
}

/**
 * ユーザーを削除する。users を参照する行（出席・質問・チャットなど）もまとめて消す。
 * 先生なら担当クラスごと消える（授業・資料・出席は外部キーの CASCADE で消える）。
 * アップロード済みのファイル本体はコミット後にまとめて消す
 */
async function deleteUser(userId) {
  const fileUrls = await transaction(async (conn) => {
    const [users] = await conn.execute('SELECT id, icon_url FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!users[0]) throw notFound();

    // 消えるファイル：本人がアップロードしたもの＋担当クラスの授業に属するもの（他の人の添付も含む）
    const [files] = await conn.execute(
      `SELECT f.url, f.preview_url
         FROM files f
         LEFT JOIN lessons l ON l.id = f.lesson_id
         LEFT JOIN classes c ON c.id = l.class_id
        WHERE f.uploader_id = ? OR c.teacher_id = ?`,
      [userId, userId]
    );

    // users を直接参照していて CASCADE が付いていないテーブルから順に消す
    await conn.execute('DELETE FROM chat_messages WHERE user_id = ?', [userId]);
    await conn.execute('DELETE FROM files WHERE uploader_id = ?', [userId]); // chat_messages.file_id は SET NULL
    await conn.execute('DELETE FROM questions WHERE user_id = ?', [userId]);
    await conn.execute('DELETE FROM understanding_reactions WHERE user_id = ?', [userId]);
    await conn.execute('DELETE FROM attention_responses WHERE user_id = ?', [userId]);
    await conn.execute('DELETE FROM attendance WHERE user_id = ?', [userId]);
    await conn.execute('DELETE FROM class_members WHERE user_id = ?', [userId]);
    await conn.execute('DELETE FROM classes WHERE teacher_id = ?', [userId]); // lessons 以下は CASCADE
    await conn.execute('DELETE FROM users WHERE id = ?', [userId]);          // lessons.spotlight_user_id は SET NULL

    const urls = [users[0].icon_url];
    for (const f of files) urls.push(f.url, f.preview_url);
    return urls.filter(Boolean);
  });

  await destroySessionsOf(userId);
  // ファイル本体の削除に失敗しても DB の削除は取り消さない（ログだけ残す）
  await Promise.all(fileUrls.map((url) => removeUploadedFile(url).catch((err) => console.error(err))));
}

module.exports = { listUsers, verifyPassword, resetPassword, deleteUser };
