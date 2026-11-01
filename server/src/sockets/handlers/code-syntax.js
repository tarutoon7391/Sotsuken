// 生徒クライアントの構文解析結果（code:syntax）→ 先生に code:status（docs/04 §7.2）— 担当：W2
// 生徒クライアントは変化したときだけ（500ms デバウンス）送る。サーバーは検証して先生に転送するだけで、DB には残さない。
// 結果は ack（任意）で { } / { error:{code,message} } を返す。
const { CODE_STATES, ERROR_CODES, ROLES } = require('@sotsuken/shared/constants');
const { CLIENT_EVENTS, SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query } = require('../../db/pool');
const { emitToTeachers } = require('../../sockets/io');

module.exports = function register(io, socket) {
  const { user, role, lessonId } = socket.data;

  socket.on(CLIENT_EVENTS.CODE_SYNTAX, async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      if (role !== ROLES.STUDENT) {
        return reply({ error: { code: ERROR_CODES.FORBIDDEN, message: 'この操作は生徒だけができます' } });
      }
      const p = payload || {};
      const taskId = Number(p.task_id);
      if (!Number.isInteger(taskId) || taskId <= 0 || typeof p.has_error !== 'boolean') {
        return reply({ error: { code: ERROR_CODES.BAD_REQUEST, message: 'task_id と has_error を指定してください' } });
      }
      // この授業の課題かだけ確かめる（所属は接続時に検証済み）
      const rows = await query('SELECT 1 FROM code_tasks WHERE id = ? AND lesson_id = ? LIMIT 1', [taskId, lessonId]);
      if (!rows.length) {
        return reply({ error: { code: ERROR_CODES.NOT_FOUND, message: '課題が見つかりません' } });
      }
      const status = {
        task_id: taskId,
        user_id: user.id,
        state: p.has_error ? CODE_STATES.SYNTAX_ERROR : CODE_STATES.IDLE,
      };
      const line = Number(p.line);
      if (p.has_error && Number.isInteger(line) && line > 0) status.line = line;
      emitToTeachers(lessonId, SERVER_EVENTS.CODE_STATUS, status);
      return reply({});
    } catch (err) {
      console.error('code:syntax でエラー:', err);
      return reply({ error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'サーバーエラーが発生しました' } });
    }
  });
};
