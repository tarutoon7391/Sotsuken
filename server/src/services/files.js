// 資料・添付・アイコンのアップロードと管理（docs/04 §2「資料・添付」）— 担当：W1
// 保存先は config.uploadDir（本番は Railway Volume）。URL は /uploads/<ファイル名>（app.js で static 公開済み）
// 保存ファイル名はサーバーでランダムに付ける（利用者が付けた名前はパスに使わない＝パストラバーサル対策）
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { ERROR_CODES, LIMITS, FILE_KINDS, ALLOWED_UPLOAD_MIMES } = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const config = require('../config');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { emitToLesson } = require('../sockets/io');

const UPLOAD_URL_PREFIX = '/uploads/';
// アイコンは PNG・JPEG のみ（docs/04 §6）
const ICON_MIMES = ['image/png', 'image/jpeg'];

// MIME → 保存時の拡張子（配信時の Content-Type を正しくするため）
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

const storage = multer.diskStorage({
  destination(req, file, cb) {
    fs.mkdir(config.uploadDir, { recursive: true }, (err) => cb(err, config.uploadDir));
  },
  filename(req, file, cb) {
    cb(null, crypto.randomBytes(16).toString('hex') + (EXT_BY_MIME[file.mimetype] || ''));
  },
});

/**
 * 1ファイルを受け取るミドルウェアを作る。MIME 違い・サイズ超過は 400
 * @param {string} field     multipart のフィールド名
 * @param {string[]} mimes   許可する MIME
 * @param {number} maxBytes  サイズ上限（LIMITS から渡す）
 */
function singleUpload(field, mimes, maxBytes) {
  const upload = multer({
    storage,
    defParamCharset: 'utf8', // 日本語のファイル名を文字化けさせない
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter(req, file, cb) {
      if (!mimes.includes(file.mimetype)) {
        return cb(new ApiError(400, ERROR_CODES.BAD_REQUEST, 'このファイル形式はアップロードできません'));
      }
      cb(null, true);
    },
  }).single(field);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? `ファイルサイズは ${maxBytes / 1024 / 1024}MB までです`
          : 'アップロードの形式が不正です';
        return next(new ApiError(400, ERROR_CODES.BAD_REQUEST, message));
      }
      next(err);
    });
  };
}

/** 資料・添付用（POST /api/lessons/:id/files の file） */
const uploadLessonFile = singleUpload('file', ALLOWED_UPLOAD_MIMES, LIMITS.MATERIAL_MAX_BYTES);
/** アイコン用（POST /api/me/icon の icon。PNG・JPEG） */
const uploadIcon = singleUpload('icon', ICON_MIMES, LIMITS.ICON_MAX_BYTES);

/** multer が保存したファイル → 配信 URL */
function urlOf(savedFile) {
  return UPLOAD_URL_PREFIX + savedFile.filename;
}

/**
 * /uploads/<ファイル名> のファイル本体を消す。無ければ何もしない
 * URL からはファイル名だけを取り出して uploadDir 直下に限定する
 */
async function removeUploadedFile(url) {
  if (typeof url !== 'string' || !url.startsWith(UPLOAD_URL_PREFIX)) return;
  const filePath = path.join(config.uploadDir, path.basename(url));
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

/** DB の files 行 → FileInfo */
function toFileInfo(row) {
  return {
    id: row.id,
    kind: row.kind,
    file_name: row.file_name,
    url: row.url,
    mime: row.mime,
    size: row.size,
    uploader_id: row.uploader_id,
    created_at: row.created_at,
  };
}

/**
 * アップロード済みのファイルを files に登録する。資料（material）なら全員に material:added を送る（v4.3）
 * @param {{lessonId:number, uploaderId:number, kind:string, savedFile:object}} p  savedFile は req.file
 * @returns {Promise<{file_id:number, url:string}>}
 */
async function createFile({ lessonId, uploaderId, kind, savedFile }) {
  const url = urlOf(savedFile);
  const fileName = (savedFile.originalname || 'file').slice(0, 255);
  const result = await query(
    `INSERT INTO files (uploader_id, lesson_id, kind, file_name, url, mime, size)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uploaderId, lessonId, kind, fileName, url, savedFile.mimetype, savedFile.size]
  );
  if (kind === FILE_KINDS.MATERIAL) {
    const rows = await query(
      `SELECT id, kind, file_name, url, mime, size, uploader_id, created_at FROM files WHERE id = ?`,
      [result.insertId]
    );
    emitToLesson(lessonId, SERVER_EVENTS.MATERIAL_ADDED, { file: toFileInfo(rows[0]) });
  }
  return { file_id: result.insertId, url };
}

/** 授業のファイル一覧（kind 指定なしは全種別）。古い順 */
async function listFiles(lessonId, kind) {
  const params = [lessonId];
  let where = 'lesson_id = ?';
  if (kind) {
    where += ' AND kind = ?';
    params.push(kind);
  }
  const rows = await query(
    `SELECT id, kind, file_name, url, mime, size, uploader_id, created_at
       FROM files WHERE ${where} ORDER BY created_at, id`,
    params
  );
  return rows.map(toFileInfo);
}

/** ファイル削除（アップロード者のみ）。行を消してから本体を消す */
async function deleteFile(fileId, userId) {
  const rows = await query('SELECT id, uploader_id, url FROM files WHERE id = ?', [fileId]);
  const file = rows[0];
  if (!file) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'ファイルが見つかりません');
  if (file.uploader_id !== userId) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'アップロードした本人だけが削除できます');
  }
  await query('DELETE FROM files WHERE id = ?', [fileId]);
  await removeUploadedFile(file.url);
}

module.exports = {
  uploadLessonFile,
  uploadIcon,
  urlOf,
  removeUploadedFile,
  createFile,
  listFiles,
  deleteFile,
};
