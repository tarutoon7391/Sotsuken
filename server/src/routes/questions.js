// 質問 API（docs/04 §2「質問」）— 担当：W2（出席・確認・理解度・質問）
const express = require('express');
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { requireLogin } = require('../middleware/auth');
const { requireTeacher } = require('../middleware/role');
const { requireLessonAccess } = require('../middleware/class-member');
const { ApiError, asyncHandler } = require('../middleware/error');
const questions = require('../services/questions');

const router = express.Router();

// POST /api/lessons/:id/questions（生徒）{body?, is_anonymous?}。挙手のみは body 省略。全員に question:new
router.post(
  '/lessons/:id/questions',
  requireLogin,
  requireLessonAccess('id'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await questions.postQuestion(req.lessonAccess, req.session.user, req.body));
  })
);

// GET /api/lessons/:id/questions（全員）匿名の投稿者は先生にのみ含める → Question[]
router.get(
  '/lessons/:id/questions',
  requireLogin,
  requireLessonAccess('id'),
  asyncHandler(async (req, res) => {
    res.json(await questions.listQuestions(req.lessonAccess));
  })
);

// PATCH /api/questions/:id（先生）{status:"answered"}。全員に question:answered
// ※ question → lesson の所属確認は services 側で行う
router.patch(
  '/questions/:id',
  requireTeacher,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '質問IDが不正です');
    res.json(await questions.answerQuestion(id, req.session.user, req.body));
  })
);

// DELETE /api/questions/:id（生徒・投稿者本人）挙手の取り下げ。成功 204、全員に question:cancelled
// ※ 本人・挙手・open の判定は services 側で行う
router.delete(
  '/questions/:id',
  requireLogin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '質問IDが不正です');
    await questions.cancelQuestion(id, req.session.user);
    res.status(204).end();
  })
);

module.exports = router;
