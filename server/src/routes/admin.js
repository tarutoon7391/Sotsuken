// ユーザー管理 API（運用者向け。.env の ADMIN_LOGIN_IDS に載っているユーザーだけ）
// GET    /api/admin/users                      → [{id, name, login_id, role, icon_url, created_at, class_count}]
// POST   /api/admin/users/:id/password/verify  {password} → {match}
// PUT    /api/admin/users/:id/password         {password} → 204（そのユーザーはログアウトされる）
// DELETE /api/admin/users/:id                  → 204（自分自身は 409）
const express = require('express');
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { requireAdmin } = require('../middleware/admin');
const { ApiError, asyncHandler } = require('../middleware/error');
const { badRequest, parsePassword } = require('./validators');
const adminUsers = require('../services/admin-users');

const router = express.Router();

router.use(requireAdmin);

/** :id を正の整数に。違えば 400 */
function parseUserId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('ユーザーIDが不正です');
  return id;
}

router.get('/users', asyncHandler(async (req, res) => {
  res.json(await adminUsers.listUsers());
}));

router.post('/users/:id/password/verify', asyncHandler(async (req, res) => {
  const userId = parseUserId(req.params.id);
  const password = (req.body || {}).password;
  if (typeof password !== 'string' || !password) throw badRequest('パスワードを入力してください');
  res.json(await adminUsers.verifyPassword(userId, password));
}));

router.put('/users/:id/password', asyncHandler(async (req, res) => {
  const userId = parseUserId(req.params.id);
  const password = parsePassword((req.body || {}).password);
  await adminUsers.resetPassword(userId, password);
  res.status(204).end();
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  const userId = parseUserId(req.params.id);
  if (userId === req.session.user.id) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, '自分自身は削除できません');
  }
  await adminUsers.deleteUser(userId);
  res.status(204).end();
}));

module.exports = router;
