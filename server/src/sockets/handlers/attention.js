// 確認ボタン応答（attention:respond）— 担当：W2
// REST の POST /api/attention/:check_id/respond と同じ処理。結果は ack（任意）で { } / { error:{code,message} } を返す。
const { ERROR_CODES, ROLES } = require('@sotsuken/shared/constants');
const { CLIENT_EVENTS } = require('@sotsuken/shared/socket-events');
const { ApiError } = require('../../middleware/error');
const attention = require('../../services/attention');

module.exports = function register(io, socket) {
  const { user, role } = socket.data;

  socket.on(CLIENT_EVENTS.ATTENTION_RESPOND, async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      if (role !== ROLES.STUDENT) throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は生徒だけができます');
      const checkId = Number(payload && payload.check_id);
      if (!Number.isInteger(checkId) || checkId <= 0) {
        throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'check_id が不正です');
      }
      await attention.respond(checkId, user);
      reply({});
    } catch (err) {
      if (!(err instanceof ApiError)) console.error('attention:respond でエラー:', err);
      const e = err instanceof ApiError ? err : new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'サーバーエラーが発生しました');
      reply({ error: { code: e.code, message: e.message } });
    }
  });
};
