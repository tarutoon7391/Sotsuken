// LiveKit ルームへの接続 hook（担当：W3）
// トークン取得（POST /api/lessons/:id/token）→ 接続 → アンマウントで切断。
// token API の url が null（サーバーに LIVEKIT_* 未設定）のときは status='unconfigured' で止まる（例外にしない）。
// 切断されたらトークンを取り直して再接続する（最大3回）。その間 room は null になり、部品は「再接続中」を表示する。
import { useEffect, useMemo, useState } from 'react';
import { Room, RoomEvent, ConnectionState, DisconnectReason } from 'livekit-client';
import { ROLES } from '@sotsuken/shared/constants';
import { post } from '../api/client';
import { roleOf } from './identity';
import { denyAll } from './permissions';

/**
 * @typedef {'idle'|'connecting'|'connected'|'reconnecting'|'disconnected'|'unconfigured'|'error'} LiveKitStatus
 */

/** 表示用の状態ラベル */
export const STATUS_LABELS = Object.freeze({
  idle: '未接続',
  connecting: '接続中…',
  connected: '接続済み',
  reconnecting: '再接続中…',
  disconnected: '切断されました',
  unconfigured: '配信サーバーが未設定です',
  error: '配信に接続できませんでした',
});

/** 画面の再描画が必要になるルームのイベント */
const RENDER_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.ParticipantAttributesChanged,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.TrackSubscriptionStatusChanged,
  RoomEvent.TrackSubscriptionPermissionChanged,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.AudioPlaybackStatusChanged,
  RoomEvent.ConnectionStateChanged,
];

/**
 * ルームの参加者・トラックが変わるたびに増える数値を返す（部品の再描画用）
 * @param {Room|null} room
 */
export function useRoomVersion(room) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!room) return undefined;
    const bump = () => setVersion((v) => v + 1);
    RENDER_EVENTS.forEach((ev) => room.on(ev, bump));
    return () => RENDER_EVENTS.forEach((ev) => room.off(ev, bump));
  }, [room]);
  return version;
}

/** 切断後にトークンを取り直して入り直す回数と、待ち時間（1秒・2秒・4秒） */
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

/** 入り直しても意味が無い切断理由（自分で抜けた・別タブで同じ人が入った・追い出された・ルームが消えた） */
const NO_RETRY_REASONS = new Set([
  DisconnectReason.CLIENT_INITIATED,
  DisconnectReason.DUPLICATE_IDENTITY,
  DisconnectReason.PARTICIPANT_REMOVED,
  DisconnectReason.ROOM_DELETED,
  DisconnectReason.ROOM_CLOSED,
]);

function toStatus(connectionState) {
  switch (connectionState) {
    case ConnectionState.Connected:
      return 'connected';
    case ConnectionState.Connecting:
      return 'connecting';
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      return 'reconnecting';
    default:
      return 'disconnected';
  }
}

/**
 * 授業の LiveKit ルームに接続する
 * @param {number|string|null} lessonId
 * @param {{ enabled?: boolean }} [options]  enabled=false の間は接続しない（待機画面など）
 * @returns {{
 *   room: Room|null,            接続済みのときだけ Room（それ以外は null）
 *   status: LiveKitStatus,
 *   error: Error|null,
 *   identity: string|null,      自分の identity（"user:{id}"）
 *   remoteParticipants: import('livekit-client').RemoteParticipant[],
 * }}
 */
export function useLiveKitRoom(lessonId, { enabled = true } = {}) {
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [identity, setIdentity] = useState(null);

  useEffect(() => {
    if (!enabled || !lessonId) {
      setStatus('idle');
      return undefined;
    }
    let cancelled = false;
    let current = null; // いま使っている Room
    let retries = 0; // 連続して再接続を試みた回数（接続できたら 0 に戻す）
    let retryTimer = null;

    // LiveKit 自身の再接続（数秒の瞬断）で戻れず切断されたとき：トークンを取り直して新しい Room で入り直す
    const onDisconnected = (r) => (reason) => {
      if (cancelled || r !== current) return;
      current = null;
      setRoom(null); // 部品は新しい Room で作り直す（生徒カメラも publish し直す）
      if (NO_RETRY_REASONS.has(reason) || retries >= MAX_RETRIES) {
        setStatus('disconnected');
        return;
      }
      retries += 1;
      setStatus('reconnecting');
      retryTimer = setTimeout(connect, RETRY_BASE_MS * 2 ** (retries - 1));
    };

    async function connect() {
      retryTimer = null;
      if (cancelled) return;
      // adaptiveStream：表示サイズに合わせて受信画質を下げる／dynacast：誰も見ていない画質は送らない
      const r = new Room({ adaptiveStream: true, dynacast: true });
      current = r;
      r.on(RoomEvent.ConnectionStateChanged, (cs) => {
        if (!cancelled && r === current) setStatus(toStatus(cs));
      });
      r.on(RoomEvent.Disconnected, onDisconnected(r));
      if (retries === 0) setStatus('connecting');
      setError(null);
      try {
        const res = await post(`/lessons/${lessonId}/token`);
        if (cancelled || r !== current) return;
        setIdentity(res.identity || null);
        if (!res.url || !res.token) {
          setStatus('unconfigured');
          return;
        }
        await r.connect(res.url, res.token);
        if (cancelled || r !== current) return;
        // 生徒は接続直後に「誰にも購読させない」にしておく（カメラを publish する部品が先生だけに開く）
        if (roleOf(r.localParticipant) !== ROLES.TEACHER) denyAll(r.localParticipant);
        retries = 0;
        setRoom(r);
        setStatus('connected');
      } catch (err) {
        if (cancelled || r !== current) return;
        current = null;
        r.disconnect();
        if (retries < MAX_RETRIES) {
          retries += 1;
          setStatus('reconnecting');
          retryTimer = setTimeout(connect, RETRY_BASE_MS * 2 ** (retries - 1));
          return;
        }
        setError(err);
        setStatus('error');
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (current) current.disconnect();
      current = null;
      setRoom(null);
    };
  }, [lessonId, enabled]);

  const version = useRoomVersion(room);
  const remoteParticipants = useMemo(
    () => (room ? Array.from(room.remoteParticipants.values()) : []),
    // version が変わるたびに参加者一覧を取り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, version]
  );

  return { room, status, error, identity, remoteParticipants };
}
