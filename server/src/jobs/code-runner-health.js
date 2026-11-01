// 実行サーバー（Piston）の死活監視 — 担当：W2（docs/04 §7.4）
// 起動時と CODE_LIMITS.RUNNER_HEALTH_INTERVAL_MS おきに GET /runtimes を叩く。
// 失敗していれば run を 503 RUNNER_UNAVAILABLE で返すモードになる（保存・エディタ・先生の監視は動き続ける）。
const { CODE_LIMITS } = require('@sotsuken/shared/constants');
const codeRunner = require('../services/code-runner');

// 起動直後に 1 回（jobs/index.js は間隔が来るまで run() を呼ばないため）。失敗してもサーバーは落とさない
setTimeout(() => {
  codeRunner.checkHealth().catch(() => {});
}, 0).unref();

module.exports = {
  name: '実行サーバー死活監視',
  intervalMs: CODE_LIMITS.RUNNER_HEALTH_INTERVAL_MS,
  async run() {
    await codeRunner.checkHealth();
  },
};
