// W3 の LiveKit 部品の仮実装（docs/requests/w3-components.md と同じ props）。結合時に削除する。
// 結合時の差し替え：pages/teach/TeachPage.jsx の
//   import { ... } from '../../components/shared/_stubs/livekit.jsx';
// を
//   import { ... } from '../../livekit';
// に変えるだけで動く想定。
import { put } from '../../../api/client.js';
import Avatar from '../Avatar.jsx';

export const STATUS_LABELS = {
  idle: '未接続',
  connecting: '接続中…',
  connected: '接続良好',
  reconnecting: '再接続中…',
  disconnected: '切断',
  unconfigured: '配信サーバー未設定',
  error: 'エラー',
};

/** 仮：常に未設定として返す */
export function useLiveKitRoom() {
  return { room: null, status: 'unconfigured', error: null, identity: null, remoteParticipants: [] };
}

export function putSpotlight(lessonId, userId) {
  return put(`/lessons/${lessonId}/spotlight`, { user_id: userId });
}

export function TeacherPublisher({ status, className = '' }) {
  return (
    <div className={`video-panel ${className}`} style={{ aspectRatio: '16 / 9' }}>
      <div className="video-center">配信プレビュー（仮・W3 部品待ち）<br />{STATUS_LABELS[status] || status}</div>
    </div>
  );
}

export function StudentGrid({ students = [], spotlightUserId, onSpotlight, highlightUserIds = [], renderCellFooter, className = '' }) {
  return (
    <div className={`stub-grid ${className}`}>
      {students.map((s) => {
        const spot = spotlightUserId === s.id;
        const hand = highlightUserIds.includes(s.id);
        return (
          <div key={s.id} className={`stub-tile${spot ? ' is-spot' : ''}${hand ? ' is-hand' : ''}`}>
            <Avatar user={s} size={40} />
            <span className="stub-name">{s.name}</span>
            {renderCellFooter && <div className="stub-footer">{renderCellFooter(s)}</div>}
            {onSpotlight && (
              <button type="button" className="stub-spot" onClick={() => onSpotlight(spot ? null : s.id)}>
                {spot ? '解除' : '★ スポットライト'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RoomAudio() {
  return null;
}
