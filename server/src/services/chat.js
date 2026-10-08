// 雑談チャットのビジネスロジック — 担当：W2
// 投稿は Socket（chat:message）、履歴は REST（GET /lessons/:id/chat）。要素の形は同じ ChatMessage。
// 本文はそのまま保存し、表示側（React）でエスケープする。
const { DEFAULTS, ERROR_CODES, FILE_KINDS, LESSON_STATUS, LIMITS } = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { emitToLesson } = require('../sockets/io');

const SELECT_MESSAGE = `
  SELECT m.id, m.body, m.created_at,
         u.id AS user_id, u.name AS user_name, u.role AS user_role, u.icon_url AS user_icon_url,
         f.id AS file_id, f.kind AS file_kind, f.file_name, f.url AS file_url, f.mime AS file_mime,
         f.size AS file_size, f.uploader_id AS file_uploader_id, f.created_at AS file_created_at
    FROM chat_messages m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN files f ON f.id = m.file_id`;

/** DB の行 → ChatMessage */
function toMessage(row) {
  const msg = {
    id: Number(row.id),
    user: { id: row.user_id, name: row.user_name, role: row.user_role, icon_url: row.user_icon_url },
    body: row.body,
    created_at: new Date(row.created_at).toISOString(),
  };
  if (row.file_id) {
    msg.file = {
      id: row.file_id,
      kind: row.file_kind,
      file_name: row.file_name,
      url: row.file_url,
      mime: row.file_mime,
      size: row.file_size,
      uploader_id: row.file_uploader_id,
      created_at: new Date(row.file_created_at).toISOString(),
    };
  }
  return msg;
}

/**
 * chat:message（全員）。保存してルーム全員に配信する
 * @param {number} lessonId  接続時に所属検証済みの授業
 * @param {{ id: number }} user
 * @param {{ body?: string, file_id?: number }} input
 */
async function postMessage(lessonId, user, input) {
  const raw = input || {};
  let body = null;
  if (raw.body !== undefined && raw.body !== null) {
    if (typeof raw.body !== 'string') throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'body は文字列です');
    body = raw.body.trim();
    if (body.length > LIMITS.BODY_MAX) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, `メッセージは${LIMITS.BODY_MAX}文字以内です`);
    }
    if (body === '') body = null;
  }
  let fileId = null;
  if (raw.file_id !== undefined && raw.file_id !== null) {
    // 正の整数だけ受け付ける（true や "1" は不可）
    if (typeof raw.file_id !== 'number' || !Number.isInteger(raw.file_id) || raw.file_id <= 0) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'file_id が不正です');
    }
    fileId = raw.file_id;
  }
  if (body === null && fileId === null) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '本文か添付ファイルのどちらかが必要です');
  }

  if (fileId !== null) {
    // 同じ授業のチャット添付（kind=attachment）で、自分がアップロードしたものだけ貼れる
    const files = await query('SELECT id FROM files WHERE id = ? AND lesson_id = ? AND kind = ? AND uploader_id = ?', [
      fileId,
      lessonId,
      FILE_KINDS.ATTACHMENT,
      user.id,
    ]);
    if (!files.length) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '添付ファイルが見つかりません');
  }

  // 授業が終了していないことの確認と記録を1文で行う（待機中の会話は許容。docs/04 §6）
  const result = await query(
    `INSERT INTO chat_messages (lesson_id, user_id, body, file_id, created_at)
     SELECT l.id, ?, ?, ?, UTC_TIMESTAMP() FROM lessons l WHERE l.id = ? AND l.status <> ?`,
    [user.id, body, fileId, lessonId, LESSON_STATUS.ENDED]
  );
  if (result.affectedRows === 0) throw new ApiError(409, ERROR_CODES.CONFLICT, '授業は終了しています');
  const rows = await query(`${SELECT_MESSAGE} WHERE m.id = ?`, [result.insertId]);
  const message = toMessage(rows[0]);
  emitToLesson(lessonId, SERVER_EVENTS.CHAT_MESSAGE, message);
  return message;
}

/** GET /lessons/:id/chat?before=&limit=（全員）新しい順 */
async function listMessages(lessonId, params) {
  const p = params || {};
  let limit = DEFAULTS.CHAT_PAGE_LIMIT;
  if (p.limit !== undefined) {
    limit = Number(p.limit);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'limit は 1 以上の整数です');
    }
    limit = Math.min(limit, DEFAULTS.CHAT_PAGE_LIMIT_MAX); // 最大を超えたら丸める
  }
  let before = null;
  if (p.before !== undefined) {
    before = Number(p.before);
    if (!Number.isInteger(before) || before <= 0) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'before が不正です');
  }

  // LIMIT のプレースホルダは mysql2 の execute だと文字列で渡す必要がある（検証済みの整数なので安全）
  const rows = before
    ? await query(`${SELECT_MESSAGE} WHERE m.lesson_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?`, [
        lessonId,
        before,
        String(limit),
      ])
    : await query(`${SELECT_MESSAGE} WHERE m.lesson_id = ? ORDER BY m.id DESC LIMIT ?`, [lessonId, String(limit)]);
  return rows.map(toMessage);
}

module.exports = { postMessage, listMessages };
