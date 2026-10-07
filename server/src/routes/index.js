// REST API の入口（ベースパス /api）。
// docs/04_API・イベント仕様.md のエンドポイントは全部ここに登録済み（フェーズ0は 501 スタブ）。
// 各担当は自分のファイルの中身を本実装に置き換える。このファイルは触らない。
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

// --- W1：認証・クラス・授業・資料
router.use(require('./auth'));          // /register /login /logout /me /me/icon
router.use(require('./classes'));       // /classes /classes/join /classes/:id /classes/:id/members
router.use(require('./lessons'));       // /classes/:id/lessons /classes/:id/tags /lessons/:id(/start|/end)
router.use(require('./files'));         // /lessons/:id/files /files/:id

// --- W2：出席・確認・理解度・質問・チャット
router.use(require('./attendance'));    // /lessons/:id/attendance...
router.use(require('./attention'));     // /lessons/:id/attention... /attention/:check_id...
router.use(require('./questions'));     // /lessons/:id/questions /questions/:id
router.use(require('./understanding')); // /lessons/:id/understanding
router.use(require('./chat'));          // /lessons/:id/chat

// --- W3：LiveKit
router.use(require('./token'));         // /lessons/:id/token /lessons/:id/spotlight

module.exports = router;
