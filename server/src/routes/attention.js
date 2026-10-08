// 確認ボタン API（docs/04 §2「確認ボタン」）— 担当：W2（出席・確認・理解度・質問）
const express = require('express');
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { requireLogin } = require('../middleware/auth');
const { requireTeacher, requireStudent } = require('../middleware/role');
const { requireLessonAccess } = require('../middleware/class-member');
const { ApiError, asyncHandler } = require('../middleware/error');
const attention = require('../services/attention');

const router = express.Router();

function parseCheckId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '確認IDが不正です');
  return id;
}

// POST /api/lessons/:id/attention（先生）{timeout_sec:60} → {check_id, deadline_at}。全生徒に attention:check
router.post(
  '/lessons/:id/attention',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await attention.issueCheckByTeacher(req.lessonAccess.lesson.id, req.body));
  })
);

// GET /api/lessons/:id/attention（先生・v4.3）→ [{check_id, issued_at, deadline_at, auto, responded_count, pending_count}]
router.get(
  '/lessons/:id/attention',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(await attention.listChecks(req.lessonAccess.lesson.id));
  })
);

// GET /api/lessons/:id/attention/auto（先生・v4.3）→ {interval_min}
router.get(
  '/lessons/:id/attention/auto',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  (req, res) => {
    res.json(attention.getAuto(req.lessonAccess.lesson.id));
  }
);

// PATCH /api/lessons/:id/attention/auto（先生）{interval_min}（0 で無効）
router.patch(
  '/lessons/:id/attention/auto',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(attention.setAuto(req.lessonAccess.lesson.id, req.body));
  })
);

// POST /api/attention/:check_id/respond（生徒）deadline 超過は 409 CHECK_EXPIRED
// ※ check_id → lesson の所属確認は services 側で行う（check_id から lesson_id を引く）
router.post(
  '/attention/:check_id/respond',
  requireStudent,
  asyncHandler(async (req, res) => {
    await attention.respond(parseCheckId(req.params.check_id), req.session.user);
    res.status(204).end();
  })
);

// GET /api/attention/:check_id（先生）→ {check_id, deadline_at, responded[], pending[]}
router.get(
  '/attention/:check_id',
  requireTeacher,
  asyncHandler(async (req, res) => {
    res.json(await attention.getStatus(parseCheckId(req.params.check_id), req.session.user));
  })
);

module.exports = router;
