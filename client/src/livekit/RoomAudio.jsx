// ルーム内の音声（先生のマイクなど）を再生する（担当：W3）
// ブラウザの自動再生制限で再生できないときは「音声を再生」ボタンを出す（押すと room.startAudio()）。
// 授業画面に1つだけ置く。購読が許可されていない音声は SFU から届かないので鳴らない。
import { useEffect, useRef } from 'react';
import { Track } from 'livekit-client';
import { useRoomVersion } from './useLiveKitRoom';
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

/** @param {{ room: import('livekit-client').Room|null }} props */
export default function RoomAudio({ room }) {
  useRoomVersion(room);
  if (!room) return null;

  const tracks = [];
  room.remoteParticipants.forEach((p) => {
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
