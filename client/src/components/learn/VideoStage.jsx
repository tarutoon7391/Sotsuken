// 映像エリア（先生の映像。スポットライト中は発表者を大きく、先生を小窓に）— 担当：W4
// props:
//   room:            LiveKit の Room|null（useLiveKitRoom）
//   videoStatus:     useLiveKitRoom の status
//   teacher:         { id, name } | null       LessonDetail.teacher
//   spotlightUserId: number|null               spotlight:update / LessonDetail.spotlight_user_id
//   meId:            number                    自分の user id
//   reconnecting:    boolean                   Socket 切断中（再接続中の表示）
//   toast:           { text, kind: 'ok'|'miss' } | null
//   mobile?:         boolean
// 生徒映像の購読制限は W3 の StudentCamera（publisher 側の購読許可）で強制される。ここは表示だけ。
import { useEffect, useState } from 'react';
import { RemoteVideo, StudentCamera } from './parts.js';
import { initialOf } from './format.js';

function Face({ initial, caption }) {
  return (
    <div className="lr-video-who">
      <div className="lr-video-face">{initial}</div>
      {caption}
    </div>
  );
}

export default function VideoStage({
  room,
  videoStatus,
  teacher,
  spotlightUserId,
  meId,
  reconnecting,
  toast,
  mobile = false,
}) {
  const [swap, setSwap] = useState(false);
  // 発表者が変わったら入れ替えを元に戻す
  useEffect(() => setSwap(false), [spotlightUserId]);

  const teacherId = teacher ? teacher.id : null;
  const spotOn = spotlightUserId != null;
  const spotIsMe = spotOn && spotlightUserId === meId;
  const showPresenter = spotOn && !spotIsMe; // 自分が発表者のときは先生の映像のまま

  // source：先生は画面共有優先（auto）、発表中の生徒はカメラ
  const teacherView = {
    key: `t-${teacherId}`,
    userId: teacherId,
    source: 'auto',
    initial: teacher ? initialOf(teacher.name) : '先',
    caption: teacher ? `${teacher.name}（先生）` : '先生',
  };
  const presenterView = {
    key: `s-${spotlightUserId}`,
    userId: spotlightUserId,
    source: 'camera',
    initial: '発',
    caption: '発表中の生徒',
  };
  const main = showPresenter && !swap ? presenterView : teacherView;
  const pip = showPresenter ? (swap ? presenterView : teacherView) : null;

  let label = '先生の画面';
  if (spotIsMe) label = 'あなたが発表中（全員に表示されています）';
  else if (showPresenter) label = '生徒が発表中';

  return (
    <div className={`lr-video${mobile ? ' is-mobile' : ''}`}>
      <div className="lr-video-bg" />
      <RemoteVideo
        key={main.key}
        room={room}
        userId={main.userId}
        source={main.source}
        fit="contain"
        className="lr-video-main"
        placeholder={<Face initial={main.initial} caption={main.caption} />}
      />

      {reconnecting && (
        <div className="lr-video-reconnect">
          <div>
            <div className="lr-spinner-dark" />
            再接続中…映像は自動で復帰します
          </div>
        </div>
      )}

      <div className="lr-video-labels">
        <span className={`lr-video-label${spotOn ? ' is-spot' : ''}`}>{label}</span>
        {videoStatus === 'unconfigured' && <span className="lr-video-label">配信サーバー未設定</span>}
        {videoStatus === 'reconnecting' && <span className="lr-video-label">映像を再接続中</span>}
        {videoStatus === 'error' && <span className="lr-video-label">映像に接続できません</span>}
      </div>

      {toast && <div className={`lr-video-toast${toast.kind === 'miss' ? ' is-miss' : ''}`}>{toast.text}</div>}

      {pip && (
        <button type="button" className="lr-video-pip" aria-label="映像を入れ替える" onClick={() => setSwap((v) => !v)}>
          <RemoteVideo
            key={pip.key}
            room={room}
            userId={pip.userId}
            source={pip.source}
            fit="cover"
            className="lr-video-main"
            placeholder={<div className="lr-pip-face">{pip.initial}</div>}
          />
          <span className="lr-pip-label">{pip.caption}</span>
        </button>
      )}

      <div className="lr-video-foot">
        {/* teacherUserId と spotlightUserId で「誰に映像が届くか」が決まる（必ず渡す） */}
        <StudentCamera
          room={room}
          myUserId={meId}
          teacherUserId={teacherId}
          spotlightUserId={spotlightUserId}
          showPreview={false}
          className="lr-cam-ctl"
        />
        {!mobile && <span className="lr-video-note">ONにしても映像は先生にだけ届きます</span>}
      </div>
    </div>
  );
}
