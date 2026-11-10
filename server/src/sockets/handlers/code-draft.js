// 生徒の書きかけ（未保存）のコード（code:draft）→ 先生に code:draft（docs/04 §7.2・v4.6）— 担当：W2
// 先生のコードグリッド・拡大パネルに、保存を待たずにリアルタイムで映すためのもの。
// 生徒クライアントは変更のたびに CODE_LIMITS.DRAFT_DEBOUNCE_MS でデバウンスして送る。
// DB には書かず services/code-live.js（メモリ）に最新 1 件を持つ（先生が画面を開き直したときに使う）。
// 結果は ack（任意）で { } / { error:{code,message} } を返す。
const { CODE_LIMITS, ERROR_CODES, LESSON_MODES, ROLES } = require('@sotsuken/shared/constants');
const { CLIENT_EVENTS, SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query } = require('../../db/pool');
const { emitToTeachers } = require('../../sockets/io');
const codeLive = require('../../services/code-live');

module.exports = function register(io, socket) {
  const { user, role, lessonId } = socket.data;

  socket.on(CLIENT_EVENTS.CODE_DRAFT, async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      if (role !== ROLES.STUDENT) {
        return reply({ error: { code: ERROR_CODES.FORBIDDEN, message: 'この操作は生徒だけができます' } });
      }
      const p = payload || {};
      const taskId = Number(p.task_id);
      if (!Number.isInteger(taskId) || taskId <= 0 || typeof p.source !== 'string') {
        return reply({ error: { code: ERROR_CODES.BAD_REQUEST, message: 'task_id と source を指定してください' } });
      }
      if (Buffer.byteLength(p.source) > CODE_LIMITS.SOURCE_MAX_BYTES) {
        return reply({ error: { code: ERROR_CODES.BAD_REQUEST, message: `コードは${CODE_LIMITS.SOURCE_MAX_BYTES / 1024}KB 以内です` } });
      }
      // この授業の課題で、授業がプログラミングモード中かを確かめる（所属は接続時に検証済み）
      const rows = await query(
        `SELECT 1 FROM code_tasks t JOIN lessons l ON l.id = t.lesson_id
          WHERE t.id = ? AND t.lesson_id = ? AND l.mode = ? LIMIT 1`,
        [taskId, lessonId, LESSON_MODES.CODING]
      );
      if (!rows.length) {
        return reply({ error: { code: ERROR_CODES.NOT_FOUND, message: '課題が見つかりません' } });
      }
      codeLive.setDraft(taskId, user.id, p.source);
      emitToTeachers(lessonId, SERVER_EVENTS.CODE_DRAFT, { task_id: taskId, user_id: user.id, source: p.source });
      return reply({});
    } catch (err) {
      console.error('code:draft でエラー:', err);
      return reply({ error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'サーバーエラーが発生しました' } });
    }
  });
};
