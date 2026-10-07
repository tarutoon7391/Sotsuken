// アカウント API（docs/04 §2「アカウント」）— 担当：W1（認証・クラス・授業・資料）
// register / login / logout / me / me(PUT) / me/icon
// 実装は services/auth.js に置き、ここは入力チェックと呼び出しだけにする。
const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { notImplemented } = require('./_stub');

const router = express.Router();

// POST /api/register  {name, login_id, password, role} → MeResponse（登録と同時にログイン）
router.post('/register', notImplemented('POST /api/register'));

// POST /api/login  {login_id, password} → MeResponse
router.post('/login', notImplemented('POST /api/login'));

// POST /api/logout → 204
router.post('/logout', requireLogin, notImplemented('POST /api/logout'));

// GET /api/me → {id, name, role, icon_url}
router.get('/me', requireLogin, notImplemented('GET /api/me'));

// PUT /api/me  {name} → MeResponse
router.put('/me', requireLogin, notImplemented('PUT /api/me'));

// POST /api/me/icon  multipart(icon) → {icon_url}
router.post('/me/icon', requireLogin, notImplemented('POST /api/me/icon'));

module.exports = router;
