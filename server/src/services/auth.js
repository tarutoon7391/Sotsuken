// アカウントのビジネスロジック（docs/04 §2「アカウント」）— 担当：W1
// パスワードは bcrypt でハッシュ化する。平文は保存もログ出力もしない。
const bcrypt = require('bcrypt');
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { removeUploadedFile } = require('./files');

const BCRYPT_ROUNDS = 10;
// ログインIDが存在しないときも bcrypt.compare を1回走らせ、応答時間でID の有無が分からないようにする
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

/** DB の users 行 → MeResponse */
function toMe(row) {
  return { id: row.id, name: row.name, role: row.role, icon_url: row.icon_url };
}

/** セッションに入れる形（req.session.user） */
function toSessionUser(me) {
  return { id: me.id, name: me.name, role: me.role };
}

/**
 * 新規登録
 * @param {{name:string, login_id:string, password:string, role:string}} input  ルートで検証済み
 * @returns {Promise<object>} MeResponse
 */
async function register({ name, login_id: loginId, password, role }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const result = await query(
      'INSERT INTO users (name, login_id, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, loginId, passwordHash, role]
    );
    return { id: result.insertId, name, role, icon_url: null };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, ERROR_CODES.CONFLICT, 'このログインIDは既に使われています');
    }
    throw err;
  }
}

/**
 * ログイン。ID かパスワードが違えば 401（どちらが違うかは教えない）
 * @returns {Promise<object>} MeResponse
 */
async function login(loginId, password) {
  const rows = await query(
    'SELECT id, name, role, icon_url, password_hash FROM users WHERE login_id = ?',
    [loginId]
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'ログインIDまたはパスワードが違います');
  }
  return toMe(user);
}

/** @returns {Promise<object>} MeResponse。ユーザーが消えていれば 401 */
async function getMe(userId) {
  const rows = await query('SELECT id, name, role, icon_url FROM users WHERE id = ?', [userId]);
  if (!rows[0]) throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'ログインが必要です');
  return toMe(rows[0]);
}

/** 表示名の変更 */
async function updateName(userId, name) {
  await query('UPDATE users SET name = ? WHERE id = ?', [name, userId]);
  return getMe(userId);
}

/**
 * アイコンの差し替え。古いアイコンのファイル本体は削除する
 * @param {number} userId
 * @param {string} iconUrl  /uploads/<ファイル名>
 */
async function updateIcon(userId, iconUrl) {
  const before = await getMe(userId);
  await query('UPDATE users SET icon_url = ? WHERE id = ?', [iconUrl, userId]);
  if (before.icon_url) await removeUploadedFile(before.icon_url);
  return { icon_url: iconUrl };
}

module.exports = { toSessionUser, register, login, getMe, updateName, updateIcon };
