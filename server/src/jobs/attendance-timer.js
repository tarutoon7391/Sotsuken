// 出席タイマー（1分間隔）— 担当：W2
// 開催中の授業で「累積退出秒数＋今回の経過 ≥ 閾値」になった退出中の生徒を欠課にし、先生に attendance:update を送る。
// 判定 SQL は docs/03_DB設計.md「判定SQL 2」。中身は services/attendance.js の absentExpiredAll。
const { DEFAULTS } = require('@sotsuken/shared/constants');
const { getPool } = require('../db/pool');
const attendance = require('../services/attendance');

module.exports = {
  name: '出席タイマー',
  intervalMs: DEFAULTS.ATTENDANCE_JOB_INTERVAL_MS,
  async run() {
    if (!getPool()) return; // DB 未設定の開発環境では何もしない
    await attendance.absentExpiredAll();
  },
};
