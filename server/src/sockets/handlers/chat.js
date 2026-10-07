// 雑談チャット（chat:message）— 担当：W2
// 保存してルーム全員に chat:message を配信する。結果は ack（任意）で { } / { error:{code,message} } を返す。
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { CLIENT_EVENTS } = require('@sotsuken/shared/socket-events');
const { ApiError } = require('../../middleware/error');
const chat = require('../../services/chat');

module.exports = function register(io, socket) {
  const { user, lessonId } = socket.data;

  socket.on(CLIENT_EVENTS.CHAT_MESSAGE, async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      await chat.postMessage(lessonId, user, payload);
      reply({});
    } catch (err) {
      if (!(err instanceof ApiError)) console.error('chat:message でエラー:', err);
      const e = err instanceof ApiError ? err : new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'サーバーエラーが発生しました');
      reply({ error: { code: e.code, message: e.message } });
    }
  });
};
