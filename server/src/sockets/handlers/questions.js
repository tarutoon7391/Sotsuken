// 挙手（question:raise）— 担当：W2
// REST の body 無し POST /api/lessons/:id/questions と同義。結果は ack（任意）で { } / { error:{code,message} } を返す。
const { ERROR_CODES, ROLES } = require('@sotsuken/shared/constants');
const { CLIENT_EVENTS } = require('@sotsuken/shared/socket-events');
const { ApiError } = require('../../middleware/error');
const questions = require('../../services/questions');

module.exports = function register(io, socket) {
  const { user, role, lessonId } = socket.data;

  socket.on(CLIENT_EVENTS.QUESTION_RAISE, async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const access = { lesson: { id: lessonId }, isTeacher: role === ROLES.TEACHER };
      await questions.postQuestion(access, user, {});
      reply({});
    } catch (err) {
      if (!(err instanceof ApiError)) console.error('question:raise でエラー:', err);
      const e = err instanceof ApiError ? err : new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'サーバーエラーが発生しました');
      reply({ error: { code: e.code, message: e.message } });
    }
  });
};
