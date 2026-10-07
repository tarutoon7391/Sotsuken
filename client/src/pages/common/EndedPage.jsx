// 授業終了 — 担当：W5（デザイン：docs/design/13_授業終了）
// lesson:ended を受けたあと（先生・生徒共通）。生徒：クラスに戻る／先生：授業結果へ
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROLES } from '@sotsuken/shared/constants';
import { get } from '../../api/client.js';
import RequireLogin, { useCurrentUser } from '../../components/shared/RequireLogin.jsx';
import AppHeader from '../../components/shared/AppHeader.jsx';
import { formatTime } from '../../components/shared/format.js';
import './common.css';

export default function EndedPage() {
  return (
    <RequireLogin>
      <EndedBody />
    </RequireLogin>
  );
}

function EndedBody() {
  const { id } = useParams();
  const { user } = useCurrentUser();
  const isTeacher = user.role === ROLES.TEACHER;
  const [lesson, setLesson] = useState(null);
  const [cls, setCls] = useState(null);

  useEffect(() => {
    get(`/lessons/${id}`).then((l) => {
      setLesson(l);
      get(`/classes/${l.class_id}`).then(setCls);
    });
  }, [id]);

  const className = cls ? cls.name : '';

  return (
    <div className="app center-page">
      <AppHeader kicker={className} title="授業終了" user={user}>
        <span className="status"><span className="dot dot-neutral" />終了</span>
      </AppHeader>

      <main className="center">
        <div className="center-col end">
          <div className="icon" aria-hidden="true">✓</div>
          {className && <h6>{className}</h6>}
          <h2>授業は終了しました</h2>
          {lesson && <p className="lesson-title">{lesson.title}</p>}
          {lesson && lesson.started_at && (
            <p className="lesson-time">
              🕒 {formatTime(lesson.started_at)}〜{lesson.ended_at ? formatTime(lesson.ended_at) : ''}
            </p>
          )}

          {isTeacher ? (
            <div className="actions is-teacher">
              <Link className="btn btn-primary" to={`/lessons/${id}/result`}>授業結果を見る</Link>
              {lesson && <Link className="btn btn-secondary" to={`/classes/${lesson.class_id}`}>クラスに戻る</Link>}
            </div>
          ) : (
            <div className="actions">
              <Link className="btn btn-primary" to={lesson ? `/classes/${lesson.class_id}` : '/classes'}>クラスに戻る</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
