// エラーの共通形式：{ "error": { "code": "...", "message": "..." } }
// （docs/04_API・イベント仕様.md の「共通ルール」）

/** API で投げるエラー。例：throw new ApiError(409, 'ALREADY_LIVE', '開催中の授業があります') */
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** async なルートの例外を next に渡すラッパー */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** /api 配下で該当なし */
function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: '対象が見つかりません' } });
}

/** 最後に通るエラーハンドラ */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' } });
}

module.exports = { ApiError, asyncHandler, notFound, errorHandler };
