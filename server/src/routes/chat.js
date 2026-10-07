// チャット API（docs/04 §2「チャット」v4.1）— 担当：W2（出席・確認・理解度・質問）
// 投稿は Socket（chat:message）。REST は履歴の取得だけ。
const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { requireLessonAccess } = require('../middleware/class-member');
const { asyncHandler } = require('../middleware/error');
const chat = require('../services/chat');

const router = express.Router();

// GET /api/lessons/:id/chat?before=&limit=（全員）新しい順。既定 limit=50・最大 100 → ChatMessage[]
router.get(
  '/lessons/:id/chat',
  requireLogin,
  requireLessonAccess('id'),
  asyncHandler(async (req, res) => {
    res.json(await chat.listMessages(req.lessonAccess.lesson.id, req.query));
  })
);

module.exports = router;
