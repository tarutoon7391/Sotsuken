// 理解リアクション API（docs/04 §2「理解リアクション」v4.1）— 担当：W2（出席・確認・理解度・質問）
// 送信・リセットは Socket（understanding:send / understanding:reset）。REST は先生の再読込用の取得だけ。
const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { requireLessonAccess } = require('../middleware/class-member');
const { asyncHandler } = require('../middleware/error');
const understanding = require('../services/understanding');

const router = express.Router();

// GET /api/lessons/:id/understanding（先生）→ {current:{understood,confused,again,total}, totals:{...}}
router.get(
  '/lessons/:id/understanding',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(await understanding.getSummary(req.lessonAccess.lesson.id));
  })
);

module.exports = router;
