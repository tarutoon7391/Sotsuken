// 出席 API（docs/04 §2「出席」）— 担当：W2（出席・確認・理解度・質問）
// 状態遷移と判定 SQL は docs/03_DB設計.md「attendance」を正とする（時刻は UTC_TIMESTAMP()）
const express = require('express');
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { requireLogin } = require('../middleware/auth');
const { requireLessonAccess } = require('../middleware/class-member');
const { ApiError, asyncHandler } = require('../middleware/error');
const attendance = require('../services/attendance');

const router = express.Router();

// GET /api/lessons/:id/attendance（先生）クラスの全生徒 → AttendanceRow[]（未入室は absent, joined_at:null）
router.get(
  '/lessons/:id/attendance',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(await attendance.listAttendance(req.lessonAccess));
  })
);

// GET /api/lessons/:id/attendance/me（生徒）→ {status, away_total_sec, remaining_sec}
router.get(
  '/lessons/:id/attendance/me',
  requireLogin,
  requireLessonAccess('id'),
  asyncHandler(async (req, res) => {
    res.json(await attendance.getMyAttendance(req.lessonAccess, req.session.user.id));
  })
);

// POST /api/lessons/:id/attendance/away（生徒）一時退出（away_since 記録）→ {status:"away"}
router.post(
  '/lessons/:id/attendance/away',
  requireLogin,
  requireLessonAccess('id'),
  asyncHandler(async (req, res) => {
    res.json(await attendance.goAway(req.lessonAccess, req.session.user.id));
  })
);

// POST /api/lessons/:id/attendance/return（生徒）復帰。累積加算・閾値以上なら 409 ALREADY_ABSENT
router.post(
  '/lessons/:id/attendance/return',
  requireLogin,
  requireLessonAccess('id'),
  asyncHandler(async (req, res) => {
    res.json(await attendance.returnFromAway(req.lessonAccess, req.session.user.id));
  })
);

// PATCH /api/lessons/:id/attendance/:user_id（先生）{status, note} 手動修正 → AttendanceRow
router.patch(
  '/lessons/:id/attendance/:user_id',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'ユーザーIDが不正です');
    }
    res.json(await attendance.updateAttendance(req.lessonAccess, userId, req.body));
  })
);

module.exports = router;
