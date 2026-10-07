// 資料・添付 API（docs/04 §2「資料・添付」）— 担当：W1（認証・クラス・授業・資料）
// アップロードは multer（画像／PDF／Office、10MB。許可 MIME は shared/constants の ALLOWED_UPLOAD_MIMES）
// 保存先は config.uploadDir。URL は /uploads/... で配信される（app.js で static 公開済み）
const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { requireLessonAccess } = require('../middleware/class-member');
const { notImplemented } = require('./_stub');

const router = express.Router();

// POST /api/lessons/:id/files  multipart{kind, file}。material は先生のみ、attachment は全員 → {file_id, url}
router.post(
  '/lessons/:id/files',
  requireLogin,
  requireLessonAccess('id'),
  notImplemented('POST /api/lessons/:id/files')
);

// GET /api/lessons/:id/files?kind=material（全員。終了済み授業でも可）→ FileInfo[]
router.get(
  '/lessons/:id/files',
  requireLogin,
  requireLessonAccess('id'),
  notImplemented('GET /api/lessons/:id/files')
);

// DELETE /api/files/:id（アップロード者のみ。ファイル本体も削除）→ 204
router.delete('/files/:id', requireLogin, notImplemented('DELETE /api/files/:id'));

module.exports = router;
