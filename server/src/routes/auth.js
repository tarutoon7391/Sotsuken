// アカウント API（docs/04 §2「アカウント」）— 担当：W1（認証・クラス・授業・資料）
// register / login / logout / me / me(PUT) / me/icon
// 実装は services/auth.js に置き、ここは入力チェックと呼び出しだけにする。
const express = require('express');
const { ERROR_CODES, ROLES } = require('@sotsuken/shared/constants');
const { requireLogin } = require('../middleware/auth');
const { ApiError, asyncHandler } = require('../middleware/error');
const authService = require('../services/auth');
const { uploadIcon, urlOf, removeUploadedFile } = require('../services/files');

const router = express.Router();

const LOGIN_ID_PATTERN = /^[A-Za-z0-9_.-]{3,50}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt は 72 バイトまでしか見ない
const NAME_MAX = 30;

function badRequest(message) {
  return new ApiError(400, ERROR_CODES.BAD_REQUEST, message);
}

/** 表示名（前後空白を除いて 1〜30 文字） */
function parseName(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw badRequest('表示名を入力してください');
  const name = raw.trim();
  if (name.length > NAME_MAX) throw badRequest(`表示名は${NAME_MAX}文字以内にしてください`);
  return name;
}

/** セッションを作り直してからユーザーを入れる（セッション固定攻撃の対策） */
function startSession(req, me) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = authService.toSessionUser(me);
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

// POST /api/register  {name, login_id, password, role} → MeResponse（登録と同時にログイン）
router.post('/register', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = parseName(body.name);
  if (typeof body.login_id !== 'string' || !LOGIN_ID_PATTERN.test(body.login_id)) {
    throw badRequest('ログインIDは半角英数字と _ . - の3〜50文字にしてください');
  }
  if (typeof body.password !== 'string'
    || body.password.length < PASSWORD_MIN
    || Buffer.byteLength(body.password) > PASSWORD_MAX) {
    throw badRequest(`パスワードは${PASSWORD_MIN}文字以上・${PASSWORD_MAX}バイト以内にしてください`);
  }
  if (!Object.values(ROLES).includes(body.role)) throw badRequest('ロールが不正です');

  const me = await authService.register({
    name, login_id: body.login_id, password: body.password, role: body.role,
  });
  await startSession(req, me);
  res.status(201).json(me);
}));

// POST /api/login  {login_id, password} → MeResponse
router.post('/login', asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (typeof body.login_id !== 'string' || typeof body.password !== 'string'
    || !body.login_id || !body.password) {
    throw badRequest('ログインIDとパスワードを入力してください');
  }
  const me = await authService.login(body.login_id, body.password);
  await startSession(req, me);
  res.json(me);
}));

// POST /api/logout → 204
router.post('/logout', requireLogin, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid');
    res.status(204).end();
  });
});

// GET /api/me → {id, name, role, icon_url}
router.get('/me', requireLogin, asyncHandler(async (req, res) => {
  res.json(await authService.getMe(req.session.user.id));
}));

// PUT /api/me  {name} → MeResponse
router.put('/me', requireLogin, asyncHandler(async (req, res) => {
  const name = parseName((req.body || {}).name);
  const me = await authService.updateName(req.session.user.id, name);
  req.session.user = authService.toSessionUser(me);
  res.json(me);
}));

// POST /api/me/icon  multipart(icon) → {icon_url}（画像のみ）
router.post('/me/icon', requireLogin, uploadIcon, asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('アイコン画像を選択してください');
  const iconUrl = urlOf(req.file);
  try {
    res.json(await authService.updateIcon(req.session.user.id, iconUrl));
  } catch (err) {
    await removeUploadedFile(iconUrl); // DB 更新に失敗したら保存したファイルを残さない
    throw err;
  }
}));

module.exports = router;
