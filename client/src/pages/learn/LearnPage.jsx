// 生徒画面（授業中）— 担当：W4（デザイン：docs/design/10_生徒画面_授業中）
// status が preparing の間は WaitingPage（9）を表示し、lesson:started で授業画面（10）に切り替える。
// 確認ポップアップ（11）は AttentionModal をこの上に重ねる（LessonLive の中）。
//
// このファイルの役割：自分・授業・クラス名の読み込み、Socket の接続と授業単位のイベント
// （lesson:started / lesson:ended / spotlight:update / 接続状態）の受信、待機⇔授業中の出し分け。
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LESSON_STATUS, ROLES } from '@sotsuken/shared/constants';
import { SERVER_EVENTS } from '@sotsuken/shared/socket-events';
import { get } from '../../api/client.js';
import { connectLesson, disconnectLesson } from '../../socket.js';
import useIsMobile from '../../components/learn/useIsMobile.js';
import WaitingPage from './WaitingPage.jsx';
import LessonLive from './LessonLive.jsx';
import './learn.css';

const STARTED_OVERLAY_MS = 1500; // 「授業が始まりました」を見せる時間

export default function LearnPage() {
  const { id } = useParams();
  const lessonId = Number(id);
  const navigate = useNavigate();
  const mobile = useIsMobile();

  const [me, setMe] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [className, setClassName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(false);

  // ---- 初回読み込み
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [meRes, lessonRes] = await Promise.all([get('/me'), get(`/lessons/${lessonId}`)]);
        if (!alive) return;
        if (meRes.role !== ROLES.STUDENT) {
          navigate(`/lessons/${lessonId}/teach`, { replace: true });
          return;
        }
        if (lessonRes.status === LESSON_STATUS.ENDED) {
          navigate(`/lessons/${lessonId}/ended`, { replace: true });
          return;
        }
        setMe(meRes);
        setLesson(lessonRes);
        get(`/classes/${lessonRes.class_id}`)
          .then((c) => alive && setClassName(c.name))
          .catch(() => {});
      } catch (err) {
        // 401/403/404 は api/client.js が画面遷移する。それ以外だけここで表示する
        if (alive && ![401, 403, 404].includes(err.status)) setLoadError(err.message || '読み込みに失敗しました');
      }
    })();
    return () => {
      alive = false;
    };
  }, [lessonId, navigate]);

  // ---- Socket 接続（待機中から接続しておき、開始・終了を受け取る）
  const ready = Boolean(me && lesson);
  const startedTimer = useRef(null);
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    const s = connectLesson(lessonId);

    // 授業情報を取り直す（再接続の間に開始・スポットライトが変わっているかもしれない）
    const refresh = () =>
      get(`/lessons/${lessonId}`)
        .then((l) => {
          if (!alive) return;
          if (l.status === LESSON_STATUS.ENDED) navigate(`/lessons/${lessonId}/ended`, { replace: true });
          else setLesson(l);
        })
        .catch(() => {});

    s.on('connect', () => {
      setConnected(true);
      refresh();
    });
    s.on('disconnect', () => setConnected(false));
    s.on(SERVER_EVENTS.LESSON_STARTED, () => {
      setStarted(true);
      clearTimeout(startedTimer.current);
      startedTimer.current = setTimeout(() => {
        setLesson((l) => (l ? { ...l, status: LESSON_STATUS.LIVE } : l));
        setStarted(false);
        refresh();
      }, STARTED_OVERLAY_MS);
    });
    s.on(SERVER_EVENTS.LESSON_ENDED, () => navigate(`/lessons/${lessonId}/ended`, { replace: true }));
    s.on(SERVER_EVENTS.SPOTLIGHT_UPDATE, (p) => {
      setLesson((l) => (l ? { ...l, spotlight_user_id: p && p.user_id != null ? p.user_id : null } : l));
    });

    setSocket(s);
    setConnected(s.connected);
    return () => {
      alive = false;
      clearTimeout(startedTimer.current);
      disconnectLesson();
      setSocket(null);
      setConnected(false);
    };
  }, [ready, lessonId, navigate]);

  if (loadError) {
    return (
      <div className="lr-loading">
        <p>{loadError}</p>
        <Link to="/classes">クラス一覧へ戻る</Link>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="lr-loading">
        <span className="lr-spinner" />
      </div>
    );
  }

  if (lesson.status === LESSON_STATUS.PREPARING || started) {
    return <WaitingPage lesson={lesson} className={className} me={me} started={started} mobile={mobile} />;
  }

  return (
    <LessonLive
      lessonId={lessonId}
      lesson={lesson}
      className={className}
      me={me}
      socket={socket}
      connected={connected}
      mobile={mobile}
    />
  );
}
