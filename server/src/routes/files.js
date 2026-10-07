// 資料・添付 API（docs/04 §2「資料・添付」）— 担当：W1（認証・クラス・授業・資料）
// アップロードは multer（画像／PDF／Office、10MB。許可 MIME は shared/constants の ALLOWED_UPLOAD_MIMES）
// 保存先は config.uploadDir。URL は /uploads/... で配信される（app.js で static 公開済み）
const express = require('express');
const { ERROR_CODES, FILE_KINDS } = require('@sotsuken/shared/constants');
const { requireLogin } = require('../middleware/auth');
const { requireLessonAccess } = require('../middleware/class-member');
const { ApiError, asyncHandler } = require('../middleware/error');
const fileService = require('../services/files');

const router = express.Router();

const KINDS = Object.values(FILE_KINDS);

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// POST /api/lessons/:id/files  multipart{kind, file}。material は先生のみ、attachment は全員 → {file_id, url}
// 所属チェックを先に通してからファイルを受け取る（クラス外の人のファイルをディスクに書かない）
router.post(
  '/lessons/:id/files',
  requireLogin,
  requireLessonAccess('id'),
  fileService.uploadLessonFile,
  asyncHandler(async (req, res) => {
    const { kind } = req.body || {};
    if (!req.file) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'ファイルを選択してください');
    const url = fileService.urlOf(req.file);
    try {
      if (!KINDS.includes(kind)) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'kind が不正です');
      if (kind === FILE_KINDS.MATERIAL && !req.lessonAccess.isTeacher) {
        throw new ApiError(403, ERROR_CODES.FORBIDDEN, '資料をアップロードできるのは先生だけです');
      }
      const created = await fileService.createFile({
        lessonId: req.lessonAccess.lesson.id,
        uploaderId: req.session.user.id,
        kind,
        savedFile: req.file,
      });
      res.status(201).json(created);
    } catch (err) {
      await fileService.removeUploadedFile(url); // 受け付けなかったファイルは残さない
      throw err;
    }
  })
);

// GET /api/lessons/:id/files?kind=material（全員。終了済み授業でも可）→ FileInfo[]
router.get(
  '/lessons/:id/files',
  requireLogin,
  requireLessonAccess('id'),
  asyncHandler(async (req, res) => {
    const { kind } = req.query;
    if (kind !== undefined && !KINDS.includes(kind)) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'kind が不正です');
    }
    res.json(await fileService.listFiles(req.lessonAccess.lesson.id, kind));
  })
);

// DELETE /api/files/:id（アップロード者のみ。ファイル本体も削除）→ 204
router.delete('/files/:id', requireLogin, asyncHandler(async (req, res) => {
  const fileId = parseId(req.params.id);
  if (!fileId) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'ファイルIDが不正です');
  await fileService.deleteFile(fileId, req.session.user.id);
  res.status(204).end();
}));

module.exports = router;
