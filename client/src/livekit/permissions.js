// 生徒映像のトラック購読許可（担当：W3）。仕組みは docs/livekit-notes.md
// LiveKit の setTrackSubscriptionPermissions は「publisher 側が誰に購読を許すか」を SFU に登録する。
// SFU は許可されていない participant にはトラックを配らない（フロントの表示制御ではなく基盤側で止まる）。
//
// - 通常：先生の identity だけ許可
// - スポットライト中の本人：全員に許可
// - 先生IDが分からない間：誰にも許可しない（安全側）
import { toIdentity } from './identity';

/** 誰にも購読させない（接続直後の初期状態） */
export function denyAll(localParticipant) {
  localParticipant.setTrackSubscriptionPermissions(false, []);
}

/** 先生だけに購読を許可する */
export function allowTeacherOnly(localParticipant, teacherUserId) {
  if (!teacherUserId) {
    denyAll(localParticipant);
    return;
  }
  localParticipant.setTrackSubscriptionPermissions(false, [
    { participantIdentity: toIdentity(teacherUserId), allowAll: true },
  ]);
}

/** 全員に購読を許可する（スポットライト中） */
export function allowEveryone(localParticipant) {
  localParticipant.setTrackSubscriptionPermissions(true);
}

/**
 * 生徒の購読許可を現在の状態に合わせる
 * @param {import('livekit-client').LocalParticipant} localParticipant
 * @param {{ teacherUserId: number|null|undefined, spotlighted: boolean }} state
 */
export function applyStudentPermissions(localParticipant, { teacherUserId, spotlighted }) {
  if (spotlighted) allowEveryone(localParticipant);
  else allowTeacherOnly(localParticipant, teacherUserId);
}
