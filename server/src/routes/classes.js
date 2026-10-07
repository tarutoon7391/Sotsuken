// クラス API（docs/04 §2「クラス」）— 担当：W1（認証・クラス・授業・資料）
const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { requireTeacher, requireStudent } = require('../middleware/role');
const { requireClassAccess } = require('../middleware/class-member');
const { notImplemented } = require('./_stub');

const router = express.Router();

// POST /api/classes（先生）{name} → {id, join_code}
router.post('/classes', requireTeacher, notImplemented('POST /api/classes'));

// GET /api/classes（全員）→ ClassSummary[]
router.get('/classes', requireLogin, notImplemented('GET /api/classes'));

// POST /api/classes/join（生徒）{join_code} → 加入
// ※ '/classes/:id' より前に置く（join が :id に食われないように）
router.post('/classes/join', requireStudent, notImplemented('POST /api/classes/join'));

// GET /api/classes/:id（全員）→ ClassDetail（join_code は先生のみ）
router.get('/classes/:id', requireLogin, requireClassAccess('id'), notImplemented('GET /api/classes/:id'));

// GET /api/classes/:id/members（先生）→ ClassMember[]
router.get(
  '/classes/:id/members',
  requireLogin,
  requireClassAccess('id', { teacherOnly: true }),
  notImplemented('GET /api/classes/:id/members')
);

module.exports = router;
