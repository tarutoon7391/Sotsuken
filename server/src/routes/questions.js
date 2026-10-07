// 質問 API（docs/04 §2「質問」）— 担当：W2（出席・確認・理解度・質問）
const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { requireTeacher } = require('../middleware/role');
const { requireLessonAccess } = require('../middleware/class-member');
const { notImplemented } = require('./_stub');

const router = express.Router();

// POST /api/lessons/:id/questions（生徒）{body?, is_anonymous?}。挙手のみは body 省略。全員に question:new
router.post(
  '/lessons/:id/questions',
  requireLogin,
  requireLessonAccess('id'),
  notImplemented('POST /api/lessons/:id/questions')
);

// GET /api/lessons/:id/questions（全員）匿名の投稿者は先生にのみ含める → Question[]
router.get(
  '/lessons/:id/questions',
  requireLogin,
  requireLessonAccess('id'),
  notImplemented('GET /api/lessons/:id/questions')
);

// PATCH /api/questions/:id（先生）{status:"answered"}。全員に question:answered
// ※ question → lesson の所属確認は services 側で行う
router.patch('/questions/:id', requireTeacher, notImplemented('PATCH /api/questions/:id'));

module.exports = router;
