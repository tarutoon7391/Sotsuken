// 【仮部品】W3 の LiveKit 部品（client/src/livekit/index.js）が本ブランチに入るまでの代わり — 担当：W4
// props・戻り値は W3 の確定版（feat/w3-livekit 0ba6f6b・docs/requests/w3-components.md）と同じ。
// 配信には繋がず、LIVEKIT 未設定の環境と同じ見た目（status='unconfigured'・placeholder）になる。
// 結合時は components/learn/parts.js の import 元を '../../livekit' に変え、このファイルを削除する。
import { useState } from 'react';

/** useLiveKitRoom(lessonId, { enabled }) → { room, status, error, identity, remoteParticipants } */
export function useLiveKitRoom(lessonId, { enabled = true } = {}) {
  return { room: null, status: enabled ? 'unconfigured' : 'idle', error: null, identity: null, remoteParticipants: [] };
}

/** { room, userId, source?, fit?, className?, placeholder? } */
export function RemoteVideo({ className = '', placeholder = null }) {
  return <div className={className}>{placeholder}</div>;
}

/** { room, myUserId, teacherUserId, spotlightUserId?, defaultEnabled?, onEnabledChange?, showPreview?, className? } */
export function StudentCamera({ defaultEnabled = false, onEnabledChange, showPreview = true, className = '' }) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  return (
    <div className={className}>
      {showPreview && <div className="lr-video-who">（仮）カメラのプレビュー</div>}
      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => {
          setEnabled(!enabled);
          if (onEnabledChange) onEnabledChange(!enabled);
        }}
      >
        {enabled ? 'カメラを OFF' : 'カメラを ON'}
      </button>
    </div>
  );
}

/** { room } 先生の音声。仮部品は何も出さない */
export function RoomAudio() {
  return null;
}
