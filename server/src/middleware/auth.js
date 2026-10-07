// 認証・ロールのチェック。全 API ログイン必須（ゲスト無し）。
// ログイン時に req.session.user = { id, name, role } を入れる前提。
const { ApiError } = require('./error');

/** 未ログインなら 401 */
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'ログインが必要です'));
  }
  next();
}

/** ロールが違えば 403。例：router.post('/classes', requireRole('teacher'), ...) */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'ログインが必要です'));
    }
    if (req.session.user.role !== role) {
      return next(new ApiError(403, 'FORBIDDEN', 'この操作を行う権限がありません'));
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
