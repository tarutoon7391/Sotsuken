// LiveKit 関連のサービス（担当：W3）
// - 配信トークンの発行（livekit-server-sdk の AccessToken）。シークレットはサーバーだけが持ち、フロントには JWT だけを返す
// - スポットライトの更新（lessons.spotlight_user_id）と spotlight:update の送信
//
// 生徒映像の購読制御（docs/livekit-notes.md）：
//   トークンでは「誰が何を publish できるか」を絞る（生徒はカメラ・マイクのみ、メタデータ・属性の書き換え不可）。
//   「誰が購読できるか」は publisher 側のトラック購読許可（client/src/livekit/permissions.js）で先生だけに限定する。
const { AccessToken, TrackSource } = require('livekit-server-sdk');
const { ROLES, LIVEKIT_IDENTITY_PREFIX } = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const config = require('../config');
const { query } = require('../db/pool');
const { emitToLesson } = require('../sockets/io');

/** トークンの有効期限（授業1コマ＋余裕。切れたら再取得で入り直す） */
const TOKEN_TTL = '6h';

/** participant identity（LIVEKIT_IDENTITY_PREFIX + id）。クライアントの livekit/identity.js と同じ形 */
function toIdentity(userId) {
  return `${LIVEKIT_IDENTITY_PREFIX}${userId}`;
}

/** LIVEKIT_URL / API キー / シークレットが揃っているか */
function isConfigured() {
  const { url, apiKey, apiSecret } = config.livekit;
  return Boolean(url && apiKey && apiSecret);
}

/**
 * 授業での立場に応じたグラント
 * - 先生（その授業のクラスの teacher_id）：publish（カメラ・マイク・画面共有）可、全員 subscribe 可
 * - 生徒：publish はカメラ・マイクのみ。subscribe は可だが、他の生徒のトラックは
 *         その生徒（publisher）側の購読許可で先生以外には配られない
 */
function buildGrant(roomName, isTeacher) {
  const grant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false, // role 属性などを自分で書き換えさせない
  };
  if (!isTeacher) {
    grant.canPublishSources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
  }
  return grant;
}

/**
 * 配信トークンを発行する
 * @param {{id:number, name:string}} user  req.session.user
 * @param {{room_name:string}} lesson
 * @param {boolean} isTeacher  その授業のクラスの先生（classes.teacher_id）か。users.role では決めない
 * @returns {Promise<import('@sotsuken/shared/api-types').TokenResponse>}
 *   LIVEKIT_* が未設定なら token / url を null で返す（docs/04 §6。クライアントは「未設定」表示）
 */
async function issueToken(user, lesson, isTeacher) {
  const identity = toIdentity(user.id);
  const base = { room_name: lesson.room_name, identity };
  if (!isConfigured()) return { ...base, token: null, url: null };

  // attributes.role はこの授業での立場（クライアントが先生の映像・音声を見分けるのに使う）
  const role = isTeacher ? ROLES.TEACHER : ROLES.STUDENT;

  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity,
    name: user.name,
    ttl: TOKEN_TTL,
    attributes: { role, user_id: String(user.id) },
  });
  at.addGrant(buildGrant(lesson.room_name, isTeacher));
  const token = await at.toJwt();
  return { ...base, token, url: config.livekit.url };
}

/**
 * 指定ユーザーがクラスの生徒（class_members）か
 * @param {number} classId
 * @param {number} userId
 */
async function isStudentMember(classId, userId) {
  const rows = await query(
    'SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ? LIMIT 1',
    [classId, userId]
  );
  return rows.length > 0;
}

/**
 * スポットライトを更新して全員に spotlight:update を送る
 * @param {number} lessonId
 * @param {number|null} userId  null で解除
 */
async function setSpotlight(lessonId, userId) {
  await query('UPDATE lessons SET spotlight_user_id = ? WHERE id = ?', [userId, lessonId]);
  emitToLesson(lessonId, SERVER_EVENTS.SPOTLIGHT_UPDATE, { user_id: userId });
  return { user_id: userId };
}

module.exports = { toIdentity, isConfigured, buildGrant, issueToken, isStudentMember, setSpotlight };
