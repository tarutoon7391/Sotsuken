// 確認ボタン API（docs/04 §2「確認ボタン」）— 担当：W2（出席・確認・理解度・質問）
const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { requireTeacher, requireStudent } = require('../middleware/role');
const { requireLessonAccess } = require('../middleware/class-member');
const { notImplemented } = require('./_stub');

const router = express.Router();

// POST /api/lessons/:id/attention（先生）{timeout_sec:60} → {check_id, deadline_at}。全生徒に attention:check
router.post(
  '/lessons/:id/attention',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  notImplemented('POST /api/lessons/:id/attention')
);

// PATCH /api/lessons/:id/attention/auto（先生）{interval_min}（0 で無効）
router.patch(
  '/lessons/:id/attention/auto',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  notImplemented('PATCH /api/lessons/:id/attention/auto')
);

// POST /api/attention/:check_id/respond（生徒）deadline 超過は 409 CHECK_EXPIRED
// ※ check_id → lesson の所属確認は services 側で行う（check_id から lesson_id を引く）
router.post('/attention/:check_id/respond', requireStudent, notImplemented('POST /api/attention/:check_id/respond'));

// GET /api/attention/:check_id（先生）→ {check_id, deadline_at, responded[], pending[]}
router.get('/attention/:check_id', requireTeacher, notImplemented('GET /api/attention/:check_id'));

module.exports = router;
