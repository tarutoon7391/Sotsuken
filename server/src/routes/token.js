// 配信トークン・スポットライト API（docs/04 §2「配信トークン」「スポットライト」）— 担当：W3（LiveKit 基盤）
// トークン発行は services/livekit.js（livekit-server-sdk の AccessToken）。シークレットはサーバーだけが持つ。
// LIVEKIT_* が未設定の環境では 503 ではなく、url を空にしたレスポンスを返してクライアント側で「未設定」表示にする（クラッシュさせない）。
const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { requireLessonAccess } = require('../middleware/class-member');
const { notImplemented } = require('./_stub');

const router = express.Router();

// POST /api/lessons/:id/token（全員・クラス外は 403）→ {token, url, room_name, identity}
// 先生：publish 可・全員 subscribe 可。生徒：publish 可、subscribe は先生＋スポットライト中の生徒のみ
router.post('/lessons/:id/token', requireLogin, requireLessonAccess('id'), notImplemented('POST /api/lessons/:id/token'));

// PUT /api/lessons/:id/spotlight（先生）{user_id | null} → lessons.spotlight_user_id 更新。全員に spotlight:update
router.put(
  '/lessons/:id/spotlight',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  notImplemented('PUT /api/lessons/:id/spotlight')
);

module.exports = router;
