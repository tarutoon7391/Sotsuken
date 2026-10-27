// ユーザー管理 API の権限チェック。.env の ADMIN_LOGIN_IDS に載っているログインIDのユーザーだけ通す
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { ApiError, asyncHandler } = require('./error');
const { isAdminUser } = require('../services/auth');

/** 未ログインは 401、管理者でなければ 403 */
const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.session || !req.session.user) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'ログインが必要です');
  }
  if (!(await isAdminUser(req.session.user.id))) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作を行う権限がありません');
  }
  next();
});

module.exports = { requireAdmin };
