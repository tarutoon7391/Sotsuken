// REST API の入口（ベースパス /api）。
// 各担当は routes/ にファイルを足して、ここで router.use する。
// 追加してよい API は docs/04_API・イベント仕様.md にあるものだけ。
const express = require('express');
const { getPool } = require('../db/pool');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

// 動作確認用（Railway のヘルスチェックにも使う）。DB につながっていれば db: true
router.get('/health', asyncHandler(async (req, res) => {
  let db = false;
  const pool = getPool();
  if (pool) {
    try {
      await pool.query('SELECT 1');
      db = true;
    } catch (err) {
      db = false;
    }
  }
  res.json({ ok: true, db });
}));

// ここから下に各機能のルートを足していく（例）
// router.use(require('./account'));     // /register, /login, /logout, /me
// router.use(require('./classes'));     // /classes...
// router.use(require('./lessons'));     // /lessons...

module.exports = router;
