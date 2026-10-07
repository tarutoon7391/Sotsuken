// 理解リアクション（understanding:send / understanding:reset）— 担当：W2
// 結果は ack（任意）で { } / { error:{code,message} } を返す。
const { ERROR_CODES, ROLES } = require('@sotsuken/shared/constants');
const { CLIENT_EVENTS } = require('@sotsuken/shared/socket-events');
const { ApiError } = require('../../middleware/error');
const understanding = require('../../services/understanding');

function replyError(reply, eventName, err) {
  if (!(err instanceof ApiError)) console.error(`${eventName} でエラー:`, err);
  const e = err instanceof ApiError ? err : new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'サーバーエラーが発生しました');
  reply({ error: { code: e.code, message: e.message } });
}

module.exports = function register(io, socket) {
  const { user, role, lessonId } = socket.data;

  // 生徒：わかった／わからない／もう一度
  socket.on(CLIENT_EVENTS.UNDERSTANDING_SEND, async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      if (role !== ROLES.STUDENT) throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は生徒だけができます');
      await understanding.send(lessonId, user.id, payload && payload.type);
      reply({});
    } catch (err) {
      replyError(reply, CLIENT_EVENTS.UNDERSTANDING_SEND, err);
    }
  });

  // 先生：集計のリセット
  socket.on(CLIENT_EVENTS.UNDERSTANDING_RESET, async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      if (role !== ROLES.TEACHER) throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は授業の先生だけができます');
      await understanding.reset(lessonId);
      reply({});
    } catch (err) {
      replyError(reply, CLIENT_EVENTS.UNDERSTANDING_RESET, err);
    }
  });
};
