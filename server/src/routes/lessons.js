// 授業 API（docs/04 §2「授業」）— 担当：W1（認証・クラス・授業・資料）
// ※ token / spotlight は routes/token.js（W3）、attendance 以下は routes/attendance.js（W2）
const express = require('express');
const { ERROR_CODES, LIMITS } = require('@sotsuken/shared/constants');
const { requireLogin } = require('../middleware/auth');
const { requireTeacher } = require('../middleware/role');
const { requireClassAccess, requireLessonAccess } = require('../middleware/class-member');
const { ApiError, asyncHandler } = require('../middleware/error');
const lessonService = require('../services/lessons');

const router = express.Router();

// away_timeout_min の範囲（docs/04 §6。LIMITS には無い値）
const AWAY_TIMEOUT_MIN_RANGE = [1, 180];

function badRequest(message) {
  return new ApiError(400, ERROR_CODES.BAD_REQUEST, message);
}

/** タイトル（前後空白を除いて 1〜100 文字） */
function parseTitle(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > LIMITS.LESSON_TITLE_MAX) {
    throw badRequest(`タイトルは1〜${LIMITS.LESSON_TITLE_MAX}文字で入力してください`);
  }
  return raw.trim();
}

/** タグ配列（trim・空要素除去・重複除去。各30文字以内・最大10個） */
function parseTags(raw) {
  if (!Array.isArray(raw) || raw.some((t) => typeof t !== 'string')) {
    throw badRequest('tags は文字列の配列で指定してください');
  }
  const tags = [...new Set(raw.map((t) => t.trim()).filter(Boolean))];
  if (tags.some((t) => t.length > LIMITS.TAG_NAME_MAX)) throw badRequest(`タグは${LIMITS.TAG_NAME_MAX}文字以内にしてください`);
  if (tags.length > LIMITS.TAGS_PER_LESSON_MAX) throw badRequest(`タグは${LIMITS.TAGS_PER_LESSON_MAX}個までです`);
  return tags;
}

/** 欠課判定の閾値（分）。整数 1〜180 */
function parseAwayTimeout(raw) {
  const [min, max] = AWAY_TIMEOUT_MIN_RANGE;
  if (!Number.isInteger(raw) || raw < min || raw > max) {
    throw badRequest(`away_timeout_min は${min}〜${max}の整数で指定してください`);
  }
  return raw;
}

// POST /api/classes/:id/lessons（先生）{title, tags?} → {id, room_name}
router.post(
  '/classes/:id/lessons',
  requireTeacher,
  requireClassAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const title = parseTitle(body.title);
    const tags = body.tags === undefined ? [] : parseTags(body.tags);
    res.status(201).json(await lessonService.createLesson(req.classAccess.classRow.id, { title, tags }));
  })
);

// GET /api/classes/:id/lessons?tag=（全員）→ LessonSummary[]
router.get(
  '/classes/:id/lessons',
  requireLogin,
  requireClassAccess('id'),
  asyncHandler(async (req, res) => {
    const { tag } = req.query;
    if (tag !== undefined && typeof tag !== 'string') throw badRequest('tag は1つだけ指定してください');
    res.json(await lessonService.listLessons(req.classAccess.classRow.id, tag ? tag.trim() : undefined));
  })
);

// GET /api/classes/:id/tags（全員）→ Tag[]
router.get(
  '/classes/:id/tags',
  requireLogin,
  requireClassAccess('id'),
  asyncHandler(async (req, res) => {
    res.json(await lessonService.listTags(req.classAccess.classRow.id));
  })
);

// POST /api/lessons/:id/start（先生）同一クラスに live があれば 409 ALREADY_LIVE。全員に lesson:started → LessonDetail
router.post(
  '/lessons/:id/start',
  requireTeacher,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    const { lesson } = req.lessonAccess;
    res.json(await lessonService.startLesson(lesson.id, lesson.class_id));
  })
);

// POST /api/lessons/:id/end（先生）ended_at 記録・出席を2値に確定（services/attendance.js）。先生に attendance:update、全員に lesson:ended → LessonDetail
router.post(
  '/lessons/:id/end',
  requireTeacher,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(await lessonService.endLesson(req.lessonAccess.lesson.id));
  })
);

// PATCH /api/lessons/:id（先生）{away_timeout_min?, title?, tags?} → LessonDetail
router.patch(
  '/lessons/:id',
  requireTeacher,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const changes = {};
    if (body.title !== undefined) changes.title = parseTitle(body.title);
    if (body.tags !== undefined) changes.tags = parseTags(body.tags);
    if (body.away_timeout_min !== undefined) changes.away_timeout_min = parseAwayTimeout(body.away_timeout_min);
    if (Object.keys(changes).length === 0) throw badRequest('変更する項目を指定してください');

    const { lesson } = req.lessonAccess;
    res.json(await lessonService.updateLesson(lesson.id, lesson.class_id, changes));
  })
);

// GET /api/lessons/:id（全員）→ LessonDetail
router.get('/lessons/:id', requireLogin, requireLessonAccess('id'), asyncHandler(async (req, res) => {
  res.json(await lessonService.getLessonDetail(req.lessonAccess.lesson.id));
}));

module.exports = router;
