// F-10 プログラミングモード：課題・コード本体・集計 API（docs/04 §7.1）— 担当：W1
// 保存（save）・実行（run）・モード切替・コードスポットライトは routes/code-run.js（W2）
const express = require('express');
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { requireLogin } = require('../middleware/auth');
const { requireTeacher, requireStudent } = require('../middleware/role');
const { requireLessonAccess } = require('../middleware/class-member');
const { ApiError, asyncHandler } = require('../middleware/error');
const codeTasks = require('../services/code-tasks');

const router = express.Router();

function parseId(raw, label) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, `${label}が不正です`);
  return id;
}

/** /code/tasks/:task_id の所属チェック（課題の授業のクラス所属で判定）→ req.taskAccess */
function requireTaskAccess(options = {}) {
  return asyncHandler(async (req, res, next) => {
    const taskId = parseId(req.params.task_id, '課題ID');
    req.taskAccess = await codeTasks.getTaskAccess(req.session.user, taskId, options);
    next();
  });
}

// ---- 課題（授業単位）

// POST /api/lessons/:id/code/tasks（先生）{title, template?, language?} → 201 {task}。全員に code:task_added
router.post(
  '/lessons/:id/code/tasks',
  requireTeacher,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    const task = await codeTasks.createTask(req.lessonAccess.lesson, req.body);
    res.status(201).json({ task });
  })
);

// GET /api/lessons/:id/code/tasks（全員・ended でも可）→ CodeTask[]
router.get(
  '/lessons/:id/code/tasks',
  requireLogin,
  requireLessonAccess('id'),
  asyncHandler(async (req, res) => {
    res.json(await codeTasks.listTasks(req.lessonAccess.lesson));
  })
);

// PUT /api/lessons/:id/code/active-task（先生）{task_id} → {task_id}。全員に code:active_task
router.put(
  '/lessons/:id/code/active-task',
  requireTeacher,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(await codeTasks.setActiveTask(req.lessonAccess.lesson, req.body));
  })
);

// GET /api/lessons/:id/code/summary（先生）→ CodeTaskSummary[]（授業結果画面用）
router.get(
  '/lessons/:id/code/summary',
  requireTeacher,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(await codeTasks.summary(req.lessonAccess));
  })
);

// GET /api/lessons/:id/code/mine（生徒）→ MyCodeDocument[]（自分のコードだけ）
router.get(
  '/lessons/:id/code/mine',
  requireStudent,
  requireLessonAccess('id'),
  asyncHandler(async (req, res) => {
    res.json(await codeTasks.mine(req.lessonAccess.lesson, req.session.user));
  })
);

// ---- 課題（課題単位）

// PATCH /api/code/tasks/:task_id（先生）{title?, template?} → {task}
router.patch(
  '/code/tasks/:task_id',
  requireTeacher,
  requireTaskAccess({ teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json({ task: await codeTasks.updateTask(req.taskAccess, req.body) });
  })
);

// POST /api/code/tasks/:task_id/redistribute（先生）→ 204。対象の生徒に code:reset
router.post(
  '/code/tasks/:task_id/redistribute',
  requireTeacher,
  requireTaskAccess({ teacherOnly: true }),
  asyncHandler(async (req, res) => {
    await codeTasks.redistribute(req.taskAccess);
    res.status(204).end();
  })
);

// GET /api/code/tasks/:task_id/documents（先生）→ CodeDocumentSummary[]
router.get(
  '/code/tasks/:task_id/documents',
  requireTeacher,
  requireTaskAccess({ teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(await codeTasks.listDocuments(req.taskAccess));
  })
);

// GET /api/code/tasks/:task_id/documents/:user_id（先生・本人）→ CodeDocumentDetail
router.get(
  '/code/tasks/:task_id/documents/:user_id',
  requireLogin,
  requireTaskAccess(),
  asyncHandler(async (req, res) => {
    const userId = parseId(req.params.user_id, 'ユーザーID');
    res.json(await codeTasks.getDocument(req.taskAccess, req.session.user, userId));
  })
);

module.exports = { router, requireTaskAccess };
