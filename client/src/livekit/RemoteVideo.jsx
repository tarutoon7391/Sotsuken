// 特定参加者の映像を <video> に表示する（担当：W3）
// props は docs/requests/w3-components.md。購読が許可されていない映像（他の生徒のカメラ等）は
// SFU から届かないので、ここでは placeholder が出るだけになる。
import { useEffect, useRef } from 'react';
import { Track } from 'livekit-client';
import { useRoomVersion } from './useLiveKitRoom';
import { toIdentity } from './identity';
import './livekit.css';

/**
 * 参加者の表示中の映像トラックを探す
 * @param {import('livekit-client').Participant|undefined} participant
 * @param {'auto'|'camera'|'screen'} source  auto は画面共有を優先し、無ければカメラ
 */
export function findVideoTrack(participant, source = 'auto') {
  if (!participant) return null;
  const sources =
    source === 'camera'
      ? [Track.Source.Camera]
      : source === 'screen'
        ? [Track.Source.ScreenShare]
        : [Track.Source.ScreenShare, Track.Source.Camera];
  for (const s of sources) {
    const pub = participant.getTrackPublication(s);
    if (pub && pub.track && !pub.isMuted) return pub.track;
  }
  return null;
}

/** トラックを <video> に貼るだけの最小部品（ローカルプレビューにも使う） */
export function VideoTrackView({ track, mirror = false, fit = 'cover', className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!track || !el) return undefined;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  const classes = ['lk-video', `lk-video--${fit}`, mirror ? 'lk-video--mirror' : '', className]
    .filter(Boolean)
    .join(' ');
  return <video ref={ref} className={classes} autoPlay playsInline muted />;
}

/**
 * @param {{
 *   room: import('livekit-client').Room|null,
 *   userId: number|null,
 *   source?: 'auto'|'camera'|'screen',
 *   fit?: 'cover'|'contain',
 *   className?: string,
 *   placeholder?: import('react').ReactNode,
 * }} props
 */
export default function RemoteVideo({
  room,
  userId,
  source = 'auto',
  fit = 'cover',
  className = '',
  placeholder = null,
}) {
  useRoomVersion(room); // 参加・購読・ミュートの変化で再描画
  const participant = room && userId ? room.getParticipantByIdentity(toIdentity(userId)) : undefined;
  const track = findVideoTrack(participant, source);

  if (!track) {
    return (
      <div className={`lk-video-placeholder ${className}`}>
        {placeholder ?? <span className="lk-muted-text">映像なし</span>}
      </div>
    );
  }
  return <VideoTrackView track={track} fit={fit} className={className} />;
}
