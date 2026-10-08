// LiveKit の participant identity と ユーザーID の変換（担当：W3）
// identity はサーバー（services/livekit.js）が LIVEKIT_IDENTITY_PREFIX + id（"user:{id}"）で発行する。
// ロールは token の属性（attributes.role）に入っていて、本人は書き換えられない（canUpdateOwnMetadata=false）。
// role はその授業での立場（クラスの teacher_id なら teacher）。
import { ROLES, LIVEKIT_IDENTITY_PREFIX } from '@sotsuken/shared/constants';

const PREFIX = LIVEKIT_IDENTITY_PREFIX;

/** ユーザーID → identity */
export function toIdentity(userId) {
  return `${PREFIX}${userId}`;
}

/** identity → ユーザーID（形式外は null） */
export function fromIdentity(identity) {
  if (typeof identity !== 'string' || !identity.startsWith(PREFIX)) return null;
  const id = Number(identity.slice(PREFIX.length));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** participant のロール（'teacher' | 'student' | null） */
export function roleOf(participant) {
  const role = participant && participant.attributes ? participant.attributes.role : null;
  return role === ROLES.TEACHER || role === ROLES.STUDENT ? role : null;
}
