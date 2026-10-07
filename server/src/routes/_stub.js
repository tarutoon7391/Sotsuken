// フェーズ0のスタブ。各ルートは 501 NOT_IMPLEMENTED を返す。
// 本実装に置き換えたら、そのファイルから notImplemented の import を消す。
// 全ルートが置き換わったらこのファイルは削除する。
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { ApiError } = require('../middleware/error');

/** @param {string} label  例 'POST /api/classes'（エラーメッセージに出す） */
function notImplemented(label) {
  return (req, res, next) => {
    next(new ApiError(501, ERROR_CODES.NOT_IMPLEMENTED, `${label} は未実装です（フェーズ1で実装）`));
  };
}

module.exports = { notImplemented };
