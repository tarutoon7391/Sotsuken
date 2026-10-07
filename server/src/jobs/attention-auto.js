// 確認ボタンの自動発動 — 担当：W2
// PATCH /api/lessons/:id/attention/auto で設定された間隔（分）が経過した授業で確認を発動する。
// 間隔は分単位なので 15 秒ごとに見れば十分（最大 15 秒の遅れ）。
const { getPool } = require('../db/pool');
const attention = require('../services/attention');

module.exports = {
  name: '確認ボタン自動発動',
  intervalMs: 15 * 1000,
  async run() {
    if (!getPool()) return;
    await attention.runAutoChecks();
  },
};
