// 先生用：全生徒の映像を小さくグリッド表示する（担当：W3）
// - students（クラスの生徒一覧）を渡すと未入室の生徒もセルを出す。渡さなければ接続中の生徒だけ
// - onSpotlight を渡すと各セルに「スポットライト」／「解除」ボタンを出す（PUT は画面側。putSpotlight を使ってよい）
// - 生徒映像は送信側で 300kbps に絞ってある（StudentCamera）。受信側は adaptiveStream がセルの大きさに合わせる
import { ROLES } from '@sotsuken/shared/constants';
import Avatar from '../components/shared/Avatar';
import RemoteVideo from './RemoteVideo';
import { useRoomVersion } from './useLiveKitRoom';
import { fromIdentity, roleOf } from './identity';
import './livekit.css';

/** 接続中の生徒（role=student の participant）を { id, name } で返す */
function connectedStudents(room) {
  if (!room) return [];
  const list = [];
  room.remoteParticipants.forEach((p) => {
    const id = fromIdentity(p.identity);
    if (id && roleOf(p) === ROLES.STUDENT) list.push({ id, name: p.name || '', icon_url: null });
  });
  return list;
}

/**
 * @param {{
 *   room: import('livekit-client').Room|null,
 *   students?: { id: number, name: string, icon_url?: string|null }[],
 *   spotlightUserId?: number|null,
 *   onSpotlight?: (userId: number|null) => void,
 *   highlightUserIds?: number[],
 *   renderCellFooter?: (student: { id: number, name: string }) => import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export default function StudentGrid({
  room,
  students,
  spotlightUserId = null,
  onSpotlight,
  highlightUserIds = [],
  renderCellFooter,
  className = '',
}) {
  useRoomVersion(room);
  const online = connectedStudents(room);
  const onlineIds = new Set(online.map((s) => s.id));

  // students があればそれを基準に、名簿に無い接続者（途中参加など）を後ろに足す
  const cells = students ? [...students] : [];
  online.forEach((s) => {
    if (!cells.some((c) => c.id === s.id)) cells.push(s);
  });

  if (cells.length === 0) {
    return <p className={`lk-grid-empty ${className}`}>接続中の生徒はいません</p>;
  }

  return (
    <ul className={`lk-grid ${className}`}>
      {cells.map((s) => {
        const isSpot = spotlightUserId === s.id;
        const classes = [
          'lk-grid__cell',
          onlineIds.has(s.id) ? '' : 'lk-grid__cell--offline',
          isSpot ? 'lk-grid__cell--spotlight' : '',
          highlightUserIds.includes(s.id) ? 'lk-grid__cell--highlight' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li key={s.id} className={classes}>
            <RemoteVideo
              room={room}
              userId={s.id}
              source="camera"
              className="lk-grid__video"
              placeholder={<Avatar user={s} size={40} />}
            />
            <div className="lk-grid__footer">
              {/* 名前はテキストとして描画（React がエスケープする） */}
              <span className="lk-grid__name">{s.name}</span>
              {onSpotlight && (
                <button
                  type="button"
                  className="lk-button lk-button--small"
                  onClick={() => onSpotlight(isSpot ? null : s.id)}
                >
                  {isSpot ? '解除' : 'スポットライト'}
                </button>
              )}
              {renderCellFooter && renderCellFooter(s)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
