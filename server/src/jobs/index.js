// 定期ジョブの枠。jobs/ 配下の .js（index.js 以外）を自動で読み込み、それぞれの間隔で run() を呼ぶ。
// 各ジョブは { name, intervalMs, run } を export する。
//
// 例：jobs/attendance-timer.js
//   module.exports = {
//     name: '出席タイマー',
//     intervalMs: DEFAULTS.ATTENDANCE_JOB_INTERVAL_MS,
//     async run() { /* away_total_sec + 経過 >= 閾値 の生徒を absent にして attendance:update */ },
//   };
const fs = require('fs');
const path = require('path');
const { DEFAULTS } = require('@sotsuken/shared/constants');

const timers = [];

function loadJobs() {
  return fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .sort()
    .map((f) => {
      const job = require(path.join(__dirname, f));
      if (typeof job.run !== 'function') throw new Error(`jobs/${f} は run() を export してください`);
      return {
        name: job.name || f,
        intervalMs: job.intervalMs || DEFAULTS.ATTENDANCE_JOB_INTERVAL_MS,
        run: job.run,
      };
    });
}

/** サーバー起動時に1回呼ぶ。ジョブの例外は握りつぶしてログに出す（サーバーを落とさない） */
function startJobs() {
  const jobs = loadJobs();
  for (const job of jobs) {
    const timer = setInterval(async () => {
      try {
        await job.run();
      } catch (err) {
        console.error(`ジョブ「${job.name}」でエラー:`, err);
      }
    }, job.intervalMs);
    timer.unref(); // ジョブだけでプロセスが生き残らないようにする
    timers.push(timer);
  }
  if (jobs.length) console.log(`定期ジョブを開始: ${jobs.map((j) => j.name).join(', ')}`);
  return jobs;
}

/** テストや終了処理用 */
function stopJobs() {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
}

module.exports = { startJobs, stopJobs };
