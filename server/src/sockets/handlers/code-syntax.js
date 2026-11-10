// 生徒クライアントの構文解析結果（code:syntax）→ 先生に code:status（docs/04 §7.2）— 担当：W2
// 生徒クライアントは変化したときだけ（500ms デバウンス）送る。DB には残さず、services/code-live.js（メモリ）に最新を持つ。
// 構文エラーの間は、保存（コンパイル）や実行の結果が返っても先生のグリッドは「構文エラー」のまま（code-runner.js の broadcastRun）。
// 構文エラーが消えたら、直近の保存・実行の結果の状態に戻す。
// 結果は ack（任意）で { } / { error:{code,message} } を返す。
const { CODE_STATES, ERROR_CODES, ROLES } = require('@sotsuken/shared/constants');
const { CLIENT_EVENTS, SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query } = require('../../db/pool');
const { emitToTeachers } = require('../../sockets/io');
const codeLive = require('../../services/code-live');
const { stateOfRunStatus } = require('../../services/code-tasks');

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
      const line = Number(p.line);
      const validLine = Number.isInteger(line) && line > 0 ? line : null;
      codeLive.setSyntax(taskId, user.id, p.has_error, validLine);

      const status = { task_id: taskId, user_id: user.id };
      if (p.has_error) {
        status.state = CODE_STATES.SYNTAX_ERROR;
        if (validLine) status.line = validLine;
      } else {
        // 構文エラーが直った → 直近の保存・実行の結果に戻す（無ければ idle）
        const runs = await query('SELECT status FROM code_runs WHERE task_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1', [
          taskId,
          user.id,
        ]);
        status.state = stateOfRunStatus(runs.length ? runs[0].status : null);
      }
      emitToTeachers(lessonId, SERVER_EVENTS.CODE_STATUS, status);
      return reply({});
    } catch (err) {
      console.error('code:syntax でエラー:', err);
      return reply({ error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'サーバーエラーが発生しました' } });
    }
  });
};
