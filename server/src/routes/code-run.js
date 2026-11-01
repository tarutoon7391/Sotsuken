// F-10 プログラミングモード：モード切替・保存（コンパイル）・実行・コードスポットライト API（docs/04 §7.1）— 担当：W2
// 課題・コード本体・集計は routes/code-tasks.js（W1）
const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { requireTeacher } = require('../middleware/role');
const { requireLessonAccess } = require('../middleware/class-member');
const { asyncHandler } = require('../middleware/error');
const { requireTaskAccess } = require('./code-tasks');
const codeMode = require('../services/code-mode');
const codeRunner = require('../services/code-runner');

const router = express.Router();

// PUT /api/lessons/:id/mode（先生・live 中）{mode} → LessonDetail。全員に lesson:mode
router.put(
  '/lessons/:id/mode',
  requireTeacher,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(await codeMode.setMode(req.lessonAccess.lesson, req.body));
  })
);

// PUT /api/lessons/:id/code/spotlight（先生・live 中）{user_id|null} → {user_id}。全員に code:spotlight
router.put(
  '/lessons/:id/code/spotlight',
  requireTeacher,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    res.json(await codeMode.setCodeSpotlight(req.lessonAccess, req.body));
  })
);

// POST /api/code/tasks/:task_id/save（生徒・先生）{source, edited_by_teacher?, target_user_id?} → SaveCodeResponse
router.post(
  '/code/tasks/:task_id/save',
  requireLogin,
  requireTaskAccess(),
  asyncHandler(async (req, res) => {
    res.json(await codeRunner.saveCode(req.taskAccess, req.session.user, req.body));
  })
);

// POST /api/code/tasks/:task_id/run（生徒）{source, stdin?} → 202 RunCodeResponse。結果は code:run_result
router.post(
  '/code/tasks/:task_id/run',
  requireLogin,
  requireTaskAccess(),
  asyncHandler(async (req, res) => {
    res.status(202).json(await codeRunner.runCode(req.taskAccess, req.session.user, req.body));
  })
);

module.exports = router;
