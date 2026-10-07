// 授業 API（docs/04 §2「授業」）— 担当：W1（認証・クラス・授業・資料）
// ※ token / spotlight は routes/token.js（W3）、attendance 以下は routes/attendance.js（W2）
const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { requireClassAccess, requireLessonAccess } = require('../middleware/class-member');
const { notImplemented } = require('./_stub');

const router = express.Router();

// POST /api/classes/:id/lessons（先生）{title, tags?} → {id, room_name}
router.post(
  '/classes/:id/lessons',
  requireLogin,
  requireClassAccess('id', { teacherOnly: true }),
  notImplemented('POST /api/classes/:id/lessons')
);

// GET /api/classes/:id/lessons?tag=（全員）→ LessonSummary[]
router.get(
  '/classes/:id/lessons',
  requireLogin,
  requireClassAccess('id'),
  notImplemented('GET /api/classes/:id/lessons')
);

// GET /api/classes/:id/tags（全員）→ Tag[]
router.get(
  '/classes/:id/tags',
  requireLogin,
  requireClassAccess('id'),
  notImplemented('GET /api/classes/:id/tags')
);

// POST /api/lessons/:id/start（先生）同一クラスに live があれば 409 ALREADY_LIVE。全員に lesson:started
router.post(
  '/lessons/:id/start',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  notImplemented('POST /api/lessons/:id/start')
);

// POST /api/lessons/:id/end（先生）ended_at 記録・出席を2値に確定（services/attendance.js の関数を呼ぶ）。全員に lesson:ended
router.post(
  '/lessons/:id/end',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  notImplemented('POST /api/lessons/:id/end')
);

// PATCH /api/lessons/:id（先生）{away_timeout_min?, title?, tags?}
router.patch(
  '/lessons/:id',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  notImplemented('PATCH /api/lessons/:id')
);

// GET /api/lessons/:id（全員）→ LessonDetail
router.get('/lessons/:id', requireLogin, requireLessonAccess('id'), notImplemented('GET /api/lessons/:id'));

module.exports = router;
