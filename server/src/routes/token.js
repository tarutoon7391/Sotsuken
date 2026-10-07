// 配信トークン・スポットライト API（docs/04 §2「配信トークン」「スポットライト」）— 担当：W3（LiveKit 基盤）
// トークン発行は services/livekit.js（livekit-server-sdk の AccessToken）。シークレットはサーバーだけが持つ。
// LIVEKIT_* が未設定の環境では 503 ではなく、url を空にしたレスポンスを返してクライアント側で「未設定」表示にする（クラッシュさせない）。
const express = require('express');
const { ERROR_CODES } = require('@sotsuken/shared/constants');
const { requireLogin } = require('../middleware/auth');
const { requireLessonAccess } = require('../middleware/class-member');
const { ApiError, asyncHandler } = require('../middleware/error');
const livekit = require('../services/livekit');

const router = express.Router();

// POST /api/lessons/:id/token（全員・クラス外は 403）→ {token, url, room_name, identity}
// 先生：publish 可・全員 subscribe 可。生徒：publish 可、subscribe は先生＋スポットライト中の生徒のみ
router.post(
  '/lessons/:id/token',
  requireLogin,
  requireLessonAccess('id'),
  asyncHandler(async (req, res) => {
    const result = await livekit.issueToken(req.session.user, req.lessonAccess.lesson);
    res.json(result);
  })
);

// PUT /api/lessons/:id/spotlight（先生）{user_id | null} → lessons.spotlight_user_id 更新。全員に spotlight:update
router.put(
  '/lessons/:id/spotlight',
  requireLogin,
  requireLessonAccess('id', { teacherOnly: true }),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!Object.prototype.hasOwnProperty.call(body, 'user_id')) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'user_id を指定してください（解除は null）');
    }
    const userId = body.user_id;
    if (userId !== null && !(Number.isInteger(userId) && userId > 0)) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'user_id が不正です');
    }

    const { lesson } = req.lessonAccess;
    // スポットライトにできるのはこのクラスの生徒だけ（クラス外の映像を全員に開放させない）
    if (userId !== null && !(await livekit.isStudentMember(lesson.class_id, userId))) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '指定したユーザーはこのクラスの生徒ではありません');
    }

    res.json(await livekit.setSpotlight(lesson.id, userId));
  })
);

module.exports = router;
