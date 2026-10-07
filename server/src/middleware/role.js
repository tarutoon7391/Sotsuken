// ロールのチェック（auth.js の requireRole を役割名で呼びやすくしたもの）
// 使い方：router.post('/classes', requireTeacher, ...) / router.post('/classes/join', requireStudent, ...)
const { ROLES } = require('@sotsuken/shared/constants');
const { requireRole } = require('./auth');

/** 先生以外は 403（未ログインは 401） */
const requireTeacher = requireRole(ROLES.TEACHER);

/** 生徒以外は 403（未ログインは 401） */
const requireStudent = requireRole(ROLES.STUDENT);

module.exports = { requireTeacher, requireStudent };
