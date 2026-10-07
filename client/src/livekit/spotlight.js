// スポットライトの API 呼び出し（担当：W3）。PUT /api/lessons/:id/spotlight（先生）
// 全員への spotlight:update はサーバーが送るので、画面は Socket の SERVER_EVENTS.SPOTLIGHT_UPDATE で状態を更新する。
import { put } from '../api/client';

/**
 * @param {number|string} lessonId
 * @param {number|null} userId  null で解除
 * @returns {Promise<{ user_id: number|null }>}
 */
export function putSpotlight(lessonId, userId) {
  return put(`/lessons/${lessonId}/spotlight`, { user_id: userId });
}
