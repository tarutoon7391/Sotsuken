// LiveKit ルームへの接続 hook（担当：W3）
// トークン取得（POST /api/lessons/:id/token）→ 接続 → アンマウントで切断。
// token API の url が空（サーバーに LIVEKIT_* 未設定）のときは status='unconfigured' で止まる（例外にしない）。
import { useEffect, useMemo, useState } from 'react';
import { Room, RoomEvent, ConnectionState } from 'livekit-client';
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
    // adaptiveStream：表示サイズに合わせて受信画質を下げる／dynacast：誰も見ていない画質は送らない
    const r = new Room({ adaptiveStream: true, dynacast: true });
    const onState = (cs) => {
      if (!cancelled) setStatus(toStatus(cs));
    };
    r.on(RoomEvent.ConnectionStateChanged, onState);

    (async () => {
      setStatus('connecting');
      setError(null);
      try {
        const res = await post(`/lessons/${lessonId}/token`);
        if (cancelled) return;
        setIdentity(res.identity || null);
        if (!res.url || !res.token) {
          setStatus('unconfigured');
          return;
        }
        await r.connect(res.url, res.token);
        if (cancelled) return;
        // 生徒は接続直後に「誰にも購読させない」にしておく（カメラを publish する部品が先生だけに開く）
        if (roleOf(r.localParticipant) !== ROLES.TEACHER) denyAll(r.localParticipant);
        setRoom(r);
        setStatus('connected');
      } catch (err) {
        if (cancelled) return;
        setError(err);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      r.off(RoomEvent.ConnectionStateChanged, onState);
      r.disconnect();
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
