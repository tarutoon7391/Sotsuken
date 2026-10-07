// クラス API（docs/04 §2「クラス」）— 担当：W1（認証・クラス・授業・資料）
const express = require('express');
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { requireLogin } = require('../middleware/auth');
const { requireTeacher, requireStudent } = require('../middleware/role');
const { requireClassAccess } = require('../middleware/class-member');
const { ApiError, asyncHandler } = require('../middleware/error');
const classService = require('../services/classes');

const router = express.Router();

const CLASS_NAME_MAX = 50;

// POST /api/classes（先生）{name} → {id, join_code}
router.post('/classes', requireTeacher, asyncHandler(async (req, res) => {
  const raw = (req.body || {}).name;
  if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > CLASS_NAME_MAX) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, `クラス名は1〜${CLASS_NAME_MAX}文字で入力してください`);
  }
  res.status(201).json(await classService.createClass(req.session.user.id, raw.trim()));
}));

// GET /api/classes（全員）→ ClassSummary[]
router.get('/classes', requireLogin, asyncHandler(async (req, res) => {
  res.json(await classService.listClasses(req.session.user));
}));

// POST /api/classes/join（生徒）{join_code} → 加入（ClassSummary を返す）
// ※ '/classes/:id' より前に置く（join が :id に食われないように）
router.post('/classes/join', requireStudent, asyncHandler(async (req, res) => {
  const code = (req.body || {}).join_code;
  if (typeof code !== 'string' || !code.trim()) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '参加コードを入力してください');
  }
  res.json(await classService.joinClass(req.session.user.id, code));
}));

// GET /api/classes/:id（全員）→ ClassDetail（join_code は先生のみ）
router.get('/classes/:id', requireLogin, requireClassAccess('id'), asyncHandler(async (req, res) => {
  const { classRow, isTeacher } = req.classAccess;
  res.json(await classService.getClassDetail(classRow.id, isTeacher));
}));

// GET /api/classes/:id/members（先生）→ ClassMember[]
router.get(
  '/classes/:id/members',
  requireLogin,
  requireClassAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(await classService.listMembers(req.classAccess.classRow.id));
  })
);

module.exports = router;
