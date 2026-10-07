// 生徒のカメラ ON/OFF と自分のプレビュー（担当：W3）
// - room がある（授業中）：publish する。購読許可は「先生だけ」、自分がスポットライト中なら「全員」
// - room が無い（待機画面・配信未設定）：ローカルのプレビューだけ（どこにも送らない）
// 許可の切替は permissions.js。spotlightUserId は画面側が GET /lessons/:id と spotlight:update で持つ。
import { useEffect, useState } from 'react';
import { RoomEvent, Track, createLocalVideoTrack } from 'livekit-client';
import { applyStudentPermissions } from './permissions';
import { VideoTrackView } from './RemoteVideo';
import './livekit.css';

/** 生徒映像は低画質（〜300kbps）。30人分を先生が受けても 10Mbps 前後に収める（docs/02） */
const CAMERA_CAPTURE = { resolution: { width: 320, height: 240, frameRate: 15 } };
const CAMERA_PUBLISH = {
  source: Track.Source.Camera,
  simulcast: false,
  videoEncoding: { maxBitrate: 300_000, maxFramerate: 15 },
};

function cameraErrorMessage(err) {
  if (err && err.name === 'NotAllowedError') return 'カメラの使用が許可されていません';
  if (err && err.name === 'NotFoundError') return 'カメラが見つかりません';
  return 'カメラを開始できませんでした';
}

/**
 * @param {{
 *   room: import('livekit-client').Room|null,
 *   myUserId: number,
 *   teacherUserId: number|null,
 *   spotlightUserId?: number|null,
 *   defaultEnabled?: boolean,
 *   onEnabledChange?: (enabled: boolean) => void,
 *   showPreview?: boolean,
 *   className?: string,
 * }} props
 */
export default function StudentCamera({
  room,
  myUserId,
  teacherUserId,
  spotlightUserId = null,
  defaultEnabled = false,
  onEnabledChange,
  showPreview = true,
  className = '',
}) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [track, setTrack] = useState(null);
  const [error, setError] = useState(null);
  const spotlighted = Boolean(myUserId) && spotlightUserId === myUserId;

  // 購読許可（publish より先に設定。再接続後にも設定し直す）
  useEffect(() => {
    if (!room) return undefined;
    const apply = () => applyStudentPermissions(room.localParticipant, { teacherUserId, spotlighted });
    apply();
    room.on(RoomEvent.Reconnected, apply);
    return () => {
      room.off(RoomEvent.Reconnected, apply);
    };
  }, [room, teacherUserId, spotlighted]);

  // カメラの取得・停止
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let created = null;
    createLocalVideoTrack(CAMERA_CAPTURE)
      .then((t) => {
        if (cancelled) {
          t.stop();
          return;
        }
        created = t;
        setTrack(t);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(cameraErrorMessage(err));
        setEnabled(false);
        if (onEnabledChange) onEnabledChange(false);
      });
    return () => {
      cancelled = true;
      if (created) created.stop();
      setTrack(null);
    };
    // onEnabledChange は親の再描画で変わっても取り直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // 授業中なら publish（カメラ OFF・退室で unpublish）
  useEffect(() => {
    if (!room || !track) return undefined;
    const lp = room.localParticipant;
    let cancelled = false;
    let published = false;
    lp.publishTrack(track, CAMERA_PUBLISH)
      .then(() => {
        if (cancelled) lp.unpublishTrack(track, false);
        else published = true;
      })
      .catch(() => {
        if (!cancelled) setError('映像を送信できませんでした');
      });
    return () => {
      cancelled = true;
      if (published) lp.unpublishTrack(track, false);
    };
  }, [room, track]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (onEnabledChange) onEnabledChange(next);
  };

  return (
    <div className={`lk-student-camera ${className}`}>
      {showPreview && (
        <div className="lk-preview">
          {track ? (
            <VideoTrackView track={track} mirror />
          ) : (
            <div className="lk-video-placeholder">
              <span className="lk-muted-text">カメラ OFF</span>
            </div>
          )}
        </div>
      )}
      <div className="lk-controls">
        <button
          type="button"
          className={`lk-button ${enabled ? 'lk-button--on' : ''}`}
          aria-pressed={enabled}
          onClick={toggle}
        >
          {enabled ? 'カメラを OFF' : 'カメラを ON'}
        </button>
        {room && enabled && (
          <span className="lk-note">{spotlighted ? '全員に表示中（スポットライト）' : '先生にだけ届きます'}</span>
        )}
      </div>
      {error && <p className="lk-error">{error}</p>}
    </div>
  );
}
