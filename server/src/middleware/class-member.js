// クラス所属のチェック。クラス外のユーザーは 403、存在しなければ 404。
// 判定の中身は services/access.js（Socket の接続時検証と同じロジック）。
//
// 使い方：
//   router.get('/classes/:id/lessons', requireLogin, requireClassAccess('id'), handler)
//     → req.classAccess = { classRow, isTeacher, isMember }
//   router.get('/lessons/:id/attendance', requireLogin, requireLessonAccess('id'), handler)
//     → req.lessonAccess = { lesson, classRow, isTeacher, isMember }
//   先生の操作だけに限定したいときは requireLessonAccess('id', { teacherOnly: true })
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { ApiError } = require('./error');
const { getClassAccess, getLessonAccess } = require('../services/access');

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * クラス所属チェック
 * @param {string} param  クラスIDが入っているパスパラメータ名（既定 'id'）
 * @param {{ teacherOnly?: boolean }} [options]
 */
function requireClassAccess(param = 'id', options = {}) {
  return async (req, res, next) => {
    try {
      const classId = parseId(req.params[param]);
      if (!classId) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'クラスIDが不正です');

      const access = await getClassAccess(req.session.user, classId);
      if (!access.classRow) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'クラスが見つかりません');
      if (!access.isTeacher && !access.isMember) {
        throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'このクラスにアクセスする権限がありません');
      }
      if (options.teacherOnly && !access.isTeacher) {
        throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作はクラスの先生だけができます');
      }
      req.classAccess = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * 授業（＝その授業のクラス）所属チェック
 * @param {string} param  授業IDが入っているパスパラメータ名（既定 'id'）
 * @param {{ teacherOnly?: boolean }} [options]
 */
function requireLessonAccess(param = 'id', options = {}) {
  return async (req, res, next) => {
    try {
      const lessonId = parseId(req.params[param]);
      if (!lessonId) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '授業IDが不正です');

      const access = await getLessonAccess(req.session.user, lessonId);
      if (!access.lesson) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '授業が見つかりません');
      if (!access.isTeacher && !access.isMember) {
        throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この授業にアクセスする権限がありません');
      }
      if (options.teacherOnly && !access.isTeacher) {
        throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は授業の先生だけができます');
      }
      req.lessonAccess = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireClassAccess, requireLessonAccess };
