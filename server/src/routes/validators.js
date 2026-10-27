// ルートで共通に使う入力チェック（アカウント API とユーザー管理 API）
const { ERROR_CODES, LIMITS } = require('@sotsuken/shared/constants');
const { ApiError } = require('../middleware/error');

function badRequest(message) {
  return new ApiError(400, ERROR_CODES.BAD_REQUEST, message);
}

/** 表示名（前後空白を除いて 1〜LIMITS.NAME_MAX 文字） */
function parseName(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw badRequest('表示名を入力してください');
  const name = raw.trim();
  if (name.length > LIMITS.NAME_MAX) throw badRequest(`表示名は${LIMITS.NAME_MAX}文字以内にしてください`);
  return name;
}

/** パスワード（LIMITS.PASSWORD_MIN 文字以上・LIMITS.PASSWORD_MAX_BYTES バイト以内。bcrypt は 72 バイトまでしか見ない） */
function parsePassword(raw) {
  if (typeof raw !== 'string'
    || raw.length < LIMITS.PASSWORD_MIN
    || Buffer.byteLength(raw) > LIMITS.PASSWORD_MAX_BYTES) {
    throw badRequest(`パスワードは${LIMITS.PASSWORD_MIN}文字以上・${LIMITS.PASSWORD_MAX_BYTES}バイト以内にしてください`);
  }
  return raw;
}

module.exports = { badRequest, parseName, parsePassword };
