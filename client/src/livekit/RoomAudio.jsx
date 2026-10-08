// 先生とスポットライト中の生徒の音声を再生する（担当：W3）
// それ以外の生徒のマイクは鳴らさない（先生画面でも同じ。監査 B-1 の裁定）。
// ブラウザの自動再生制限で再生できないときは「音声を再生」ボタンを出す（押すと room.startAudio()）。
// 授業画面に1つだけ置く。購読が許可されていない音声は SFU から届かないので、そもそも鳴らない。
import { useEffect, useRef } from 'react';
import { Track } from 'livekit-client';
import { ROLES } from '@sotsuken/shared/constants';
import { useRoomVersion } from './useLiveKitRoom';
import { fromIdentity, roleOf } from './identity';
import './livekit.css';

function AudioTrackView({ track }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return <audio ref={ref} autoPlay />;
}

/**
 * @param {{
 *   room: import('livekit-client').Room|null,
 *   spotlightUserId?: number|null,
 * }} props
 */
export default function RoomAudio({ room, spotlightUserId = null }) {
  useRoomVersion(room);
  if (!room) return null;

  const tracks = [];
  room.remoteParticipants.forEach((p) => {
    const audible =
      roleOf(p) === ROLES.TEACHER || (spotlightUserId != null && fromIdentity(p.identity) === spotlightUserId);
    if (!audible) return;
    p.audioTrackPublications.forEach((pub) => {
      if (pub.track && pub.kind === Track.Kind.Audio) tracks.push(pub.track);
    });
  });

  return (
    <>
      {tracks.map((t) => (
        <AudioTrackView key={t.sid} track={t} />
      ))}
      {!room.canPlaybackAudio && (
        <button type="button" className="lk-button lk-audio-start" onClick={() => room.startAudio()}>
          音声を再生
        </button>
      )}
    </>
  );
}
