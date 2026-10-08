// 先生の配信操作とプレビュー（担当：W3）
// カメラ／画面キャプチャ／マイクをそれぞれ ON/OFF して publish する。「配信停止」で3つともまとめて止める。
// 生徒側は RemoteVideo source="auto" で「画面共有があれば画面共有、無ければカメラ」を表示する。
import { useState } from 'react';
import { Track } from 'livekit-client';
import { useRoomVersion, STATUS_LABELS } from './useLiveKitRoom';
import { VideoTrackView, findVideoTrack } from './RemoteVideo';
import './livekit.css';

function isOn(localParticipant, source) {
  const pub = localParticipant.getTrackPublication(source);
  return Boolean(pub && pub.track && !pub.isMuted);
}

function mediaErrorMessage(err, label) {
  if (err && err.name === 'NotAllowedError') return `${label}の使用が許可されていません`;
  if (err && err.name === 'NotFoundError') return `${label}が見つかりません`;
  return `${label}を開始できませんでした`;
}

/**
 * @param {{
 *   room: import('livekit-client').Room|null,
 *   status?: import('./useLiveKitRoom').LiveKitStatus,
 *   showPreview?: boolean,
 *   className?: string,
 * }} props
 */
export default function TeacherPublisher({ room, status, showPreview = true, className = '' }) {
  useRoomVersion(room);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!room) {
    return (
      <div className={`lk-teacher-publisher ${className}`}>
        <div className="lk-preview lk-preview--wide">
          <div className="lk-video-placeholder">
            <span className="lk-muted-text">{STATUS_LABELS[status || 'idle']}</span>
          </div>
        </div>
      </div>
    );
  }

  const lp = room.localParticipant;
  const cameraOn = isOn(lp, Track.Source.Camera);
  const screenOn = isOn(lp, Track.Source.ScreenShare);
  const micOn = isOn(lp, Track.Source.Microphone);
  const previewTrack = findVideoTrack(lp, 'auto');
  const anyOn = cameraOn || screenOn || micOn;

  const run = async (fn, label) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      // 画面共有のダイアログをキャンセルしたときも NotAllowedError になるので表示だけにとどめる
      setError(mediaErrorMessage(err, label));
    } finally {
      setBusy(false);
    }
  };

  const stopAll = () =>
    run(async () => {
      await lp.setScreenShareEnabled(false);
      await lp.setCameraEnabled(false);
      await lp.setMicrophoneEnabled(false);
    }, '配信停止');

  return (
    <div className={`lk-teacher-publisher ${className}`}>
      {showPreview && (
        <div className="lk-preview lk-preview--wide">
          {previewTrack ? (
            <VideoTrackView track={previewTrack} fit="contain" mirror={!screenOn} />
          ) : (
            <div className="lk-video-placeholder">
              <span className="lk-muted-text">配信していません</span>
            </div>
          )}
        </div>
      )}
      <div className="lk-controls">
        <button
          type="button"
          className={`lk-button ${cameraOn ? 'lk-button--on' : ''}`}
          aria-pressed={cameraOn}
          disabled={busy}
          onClick={() => run(() => lp.setCameraEnabled(!cameraOn), 'カメラ')}
        >
          カメラ
        </button>
        <button
          type="button"
          className={`lk-button ${screenOn ? 'lk-button--on' : ''}`}
          aria-pressed={screenOn}
          disabled={busy}
          onClick={() => run(() => lp.setScreenShareEnabled(!screenOn), '画面キャプチャ')}
        >
          画面キャプチャ
        </button>
        <button
          type="button"
          className={`lk-button ${micOn ? 'lk-button--on' : ''}`}
          aria-pressed={micOn}
          disabled={busy}
          onClick={() => run(() => lp.setMicrophoneEnabled(!micOn), 'マイク')}
        >
          マイク
        </button>
        <button type="button" className="lk-button" disabled={busy || !anyOn} onClick={stopAll}>
          配信停止
        </button>
        {status && status !== 'connected' && <span className="lk-note">{STATUS_LABELS[status]}</span>}
      </div>
      {error && <p className="lk-error">{error}</p>}
    </div>
  );
}
