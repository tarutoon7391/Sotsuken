// 授業待機（開始前） — 担当：W4（デザイン：docs/design/09_授業待機）
// LearnPage が status=preparing の間だけ表示する。Socket 接続と lesson:started の受信は LearnPage が行い、
// 開始されたら started=true で「授業が始まりました」を一瞬出してから授業画面に切り替わる。
// props:
//   lesson:    LessonDetail
//   className: string
//   me:        MeResponse
//   started:   boolean
//   mobile:    boolean
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LessonHeader from '../../components/learn/LessonHeader.jsx';
import ConfirmDialog from '../../components/learn/ConfirmDialog.jsx';
import Icon from '../../components/learn/Icon.jsx';
import { Avatar, RoleBadge, StudentCamera } from '../../components/learn/parts.js';

export default function WaitingPage({ lesson, className, me, started, mobile }) {
  const navigate = useNavigate();
  const [leaveOpen, setLeaveOpen] = useState(false);

  const status = started ? { label: '出席中', tone: 'on' } : { label: '開始前', tone: 'off' };
  const leaveButton = (
    <button type="button" className="btn btn-secondary lr-btn-leave" onClick={() => setLeaveOpen(true)}>
      退出
    </button>
  );

  return (
    <div className={`lr-wait-page${mobile ? ' is-mobile' : ''}`}>
      <LessonHeader
        className={className}
        title={lesson.title}
        status={status}
        me={me}
        action={leaveButton}
        mobile={mobile}
      />

      <main className="lr-wait-grid">
        <section className="lr-wait-msg">
          <div className="lr-wait-loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2 className="lr-wait-title">
            先生が授業を開始するまで
            <br />
            お待ちください
          </h2>
          <p className="lr-wait-sub">開始すると自動で授業画面に切り替わります。このままお待ちください。</p>

          <dl className="lr-wait-info">
            <div>
              <dt>授業</dt>
              <dd>{lesson.title}</dd>
            </div>
            <div>
              <dt>クラス</dt>
              <dd>{className}</dd>
            </div>
            {lesson.teacher && (
              <div>
                <dt>先生</dt>
                <dd>
                  <span className="lr-person">
                    <Avatar user={{ ...lesson.teacher, role: 'teacher' }} size={26} />
                    <span className="lr-person-name">{lesson.teacher.name}</span>
                    <RoleBadge role="teacher" />
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="lr-wait-cam">
          <h6 className="lr-section-label">カメラ確認</h6>
          {/* room=null：どこにも送らないローカルプレビュー（W3 の StudentCamera）。待機中は LiveKit に接続しない */}
          <div className="lr-cam-panel">
            <span className="lr-video-label">自分のカメラ</span>
            <StudentCamera room={null} myUserId={me.id} teacherUserId={null} className="lr-cam-preview" />
          </div>
          <div className="lr-cam-note">ONにしても映像は先生にだけ届きます</div>
        </section>
      </main>

      {started && (
        <div className="lr-started">
          <div className="lr-started-card">
            <div className="lr-started-check">
              <Icon name="check" size={28} />
            </div>
            <div className="lr-started-title">授業が始まりました</div>
            <div className="lr-started-sub">授業画面に移動します…</div>
          </div>
        </div>
      )}

      {leaveOpen && (
        <ConfirmDialog
          title="退出しますか？"
          body="授業はまだ始まっていません。退出しても、開始前ならもう一度入室できます。"
          confirmLabel="退出する"
          onCancel={() => setLeaveOpen(false)}
          onConfirm={() => navigate(`/classes/${lesson.class_id}`)}
        />
      )}
    </div>
  );
}
