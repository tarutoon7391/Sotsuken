// 確認ボタンの自動発動 — 担当：W2
// PATCH /api/lessons/:id/attention/auto で設定された間隔（分）が経過した授業で確認を発動する。
// 実行間隔は shared の ATTENTION_AUTO_TICK_SEC（間隔は分単位なので、最大でこの秒数だけ遅れる）。
const { ATTENTION_AUTO_TICK_SEC } = require('@sotsuken/shared/constants');
const { getPool } = require('../db/pool');
const attention = require('../services/attention');

module.exports = {
  name: '確認ボタン自動発動',
  intervalMs: ATTENTION_AUTO_TICK_SEC * 1000,
  async run() {
    if (!getPool()) return;
    await attention.runAutoChecks();
  },
};
