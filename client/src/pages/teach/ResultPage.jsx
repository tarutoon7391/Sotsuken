// 授業結果 — 担当：W5（デザイン：docs/design/08_授業結果）
// API：GET /lessons/:id, /classes/:id, /lessons/:id/attendance, /lessons/:id/understanding（totals）,
//      /lessons/:id/questions, /lessons/:id/files?kind=material, /lessons/:id/attention（応答率）,
//      PATCH /questions/:id（ended でも可・v4.3）
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ATTENDANCE_STATUS, FILE_KINDS, LESSON_STATUS, QUESTION_STATUS, ROLES } from '@sotsuken/shared/constants';
import { get, patch } from '../../api/client.js';
import RequireLogin, { useCurrentUser } from '../../components/shared/RequireLogin.jsx';
import Avatar from '../../components/shared/Avatar.jsx';
import RoleBadge from '../../components/shared/RoleBadge.jsx';
import useToast from '../../components/shared/useToast.jsx';
import { formatBytes, formatDateTime, formatTime } from '../../components/shared/format.js';
import { FileLink, fileKindLabel } from '../classes/ClassDetailPage.jsx';
import './result.css';

export default function ResultPage() {
  return (
    <RequireLogin role={ROLES.TEACHER}>
      <ResultBody />
    </RequireLogin>
  );
}

function ResultBody() {
  const { id } = useParams();
  const lessonId = Number(id);
  const { user } = useCurrentUser();
  const [lesson, setLesson] = useState(null);
  const [cls, setCls] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [totals, setTotals] = useState({ understood: 0, confused: 0, again: 0 });
  const [questions, setQuestions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [toast, showToast] = useToast(3000);
  // 補助データの失敗はトーストで知らせる（401/403/404 は client.js が遷移させる）
  const warn = useCallback((err) => showToast(err.message), [showToast]);

  useEffect(() => {
    get(`/lessons/${lessonId}`)
      .then((l) => {
        setLesson(l);
        get(`/classes/${l.class_id}`).then(setCls).catch(warn);
      })
      .catch((err) => setLoadError(err.message));
    get(`/lessons/${lessonId}/attendance`).then((r) => setAttendance(r || [])).catch(warn);
    get(`/lessons/${lessonId}/understanding`).then((u) => u && setTotals(u.totals)).catch(warn);
    get(`/lessons/${lessonId}/questions`).then((r) => setQuestions(r || [])).catch(warn);
    get(`/lessons/${lessonId}/files`, { kind: FILE_KINDS.MATERIAL }).then((r) => setMaterials(r || [])).catch(warn);
    get(`/lessons/${lessonId}/attention`).then((r) => setChecks(r || [])).catch(warn);
  }, [lessonId, warn]);

  // 挙手のみ（body なし）は質問一覧に含めない。未回答を先に
  const posts = useMemo(
    () =>
      questions
        .filter((q) => q.body != null)
        .sort((a, b) => {
          const ua = a.status === QUESTION_STATUS.OPEN ? 0 : 1;
          const ub = b.status === QUESTION_STATUS.OPEN ? 0 : 1;
          return ua - ub || a.id - b.id;
        }),
    [questions]
  );

  if (!lesson) {
    if (loadError) return <div className="page-loading form-alert" role="alert">{loadError}</div>;
    return <p className="page-loading">読み込み中…</p>;
  }

  const isEnded = lesson.status === LESSON_STATUS.ENDED;
  const present = attendance.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length;
  const absent = attendance.filter((r) => r.status === ATTENDANCE_STATUS.ABSENT).length;
  const leftOnce = attendance.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT && r.away_total_sec > 0).length;
  const attendRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
  const unanswered = posts.filter((q) => q.status === QUESTION_STATUS.OPEN).length;
  const reactionSum = totals.understood + totals.confused + totals.again;
  const durationMin =
    lesson.started_at && lesson.ended_at
      ? Math.round((new Date(lesson.ended_at) - new Date(lesson.started_at)) / 60000)
      : null;

  // 確認ボタンの応答率：全確認の応答数の合計 ÷ 対象者数の合計
  const ackResponded = checks.reduce((n, c) => n + c.responded_count, 0);
  const ackTotal = checks.reduce((n, c) => n + c.responded_count + c.pending_count, 0);
  const ackRate = ackTotal ? Math.round((ackResponded / ackTotal) * 100) : null;

  async function markAnswered(qid) {
    try {
      await patch(`/questions/${qid}`, { status: QUESTION_STATUS.ANSWERED });
      setQuestions((list) => list.map((q) => (q.id === qid ? { ...q, status: QUESTION_STATUS.ANSWERED } : q)));
    } catch (err) {
      showToast(err.message);
    }
  }

  const bars = [
    { key: 'got', label: 'わかった', n: totals.understood },
    { key: 'lost', label: 'わからない', n: totals.confused },
    { key: 'again', label: 'もう一度', n: totals.again },
  ];
  const maxBar = Math.max(1, ...bars.map((b) => b.n));

  return (
    <div className="page result-page">
      <header className="app-header">
        <div className="hdr-titles">
          <div className="hdr-kicker">{cls ? `${cls.name} ・ ` : ''}授業結果</div>
          <div className="hdr-title">{lesson.title}</div>
          {lesson.started_at && (
            <div className="hdr-meta">
              {formatDateTime(lesson.started_at)}
              {lesson.ended_at && ` – ${formatTime(lesson.ended_at)}`}
              {durationMin !== null && ` ・ ${durationMin}分`}
            </div>
          )}
        </div>
        <span className="hdr-spacer status">
          <span className="dot dot-neutral" />
          {isEnded ? '終了' : lesson.status === LESSON_STATUS.LIVE ? '授業中' : '開始前'}
        </span>
        <span className="person">
          <Avatar user={user} />
          <span className="person-name">{user.name}</span>
          <RoleBadge role={user.role} />
        </span>
        <Link className="btn btn-secondary" to={`/classes/${lesson.class_id}`}>クラス詳細へ戻る</Link>
      </header>

      <main className="page-main result-grid">
        <div className="col-main">
          <section className="section">
            <h6 className="section-label">サマリー</h6>
            <div className="stats">
              <div className="stat">
                <div className="stat-value">{attendRate}<span className="stat-unit">%</span></div>
                <div className="stat-sub">出席率 ・ {present} / {attendance.length} 人</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {ackRate === null ? '—' : <>{ackRate}<span className="stat-unit">%</span></>}
                </div>
                <div className="stat-sub">
                  確認ボタンの応答率 ・ {ackTotal ? `${ackResponded} / ${ackTotal} 回` : '確認なし'}
                </div>
              </div>
              <div className="stat">
                <div className="stat-value">{posts.length}</div>
                <div className="stat-sub">
                  質問 ・ {unanswered ? <span className="unanswered">未回答 {unanswered}</span> : '未回答なし'}
                </div>
              </div>
              <div className="stat">
                <div className="stat-value">{totals.confused}</div>
                <div className="stat-sub">「わからない」の合計</div>
              </div>
            </div>
          </section>

          <section className="section">
            <h6 className="section-label">理解リアクション</h6>
            {reactionSum === 0 ? (
              <p className="empty">この授業ではリアクションがありませんでした。</p>
            ) : (
              <div className="bars">
                {bars.map((b) => (
                  <div key={b.key} className={`bar-row bar-${b.key}`}>
                    <span>{b.label}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(b.n / maxBar) * 100}%` }} /></div>
                    <span className="bar-num">{b.n}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <div className="q-head">
              <h6 className="section-label">質問</h6>
              <span className="small muted">未回答を先に表示 ・ 匿名の投稿者は先生にだけ見えます</span>
            </div>
            {posts.length === 0 ? (
              <p className="empty">この授業では質問がありませんでした。</p>
            ) : (
              <ol className="q-list">
                {posts.map((q) => {
                  const open = q.status === QUESTION_STATUS.OPEN;
                  return (
                    <li key={q.id} className={`q-item${open ? ' is-unanswered' : ''}`}>
                      <div className="q-meta">
                        <span className="person">
                          <Avatar user={q.is_anonymous ? null : q.user} size={32} />
                          <span className="person-name">{q.is_anonymous ? '匿名' : q.user && q.user.name}</span>
                        </span>
                        {q.is_anonymous && q.user && <span className="q-anon">（{q.user.name}）</span>}
                        {open ? <span className="q-unread">● 未回答</span> : <span className="tag tag-accent">回答済み</span>}
                        <span className="q-time">{formatTime(q.created_at)}</span>
                      </div>
                      <div className="q-body">{q.body}</div>
                      {open && (
                        <div className="q-actions">
                          <button type="button" className="btn btn-ghost" onClick={() => markAnswered(q.id)}>✓ 回答済みにする</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="col-side">
          <section className="section">
            <h6 className="section-label">出席</h6>
            <ul className="att-list">
              <li><span className="status"><span className="dot" />出席</span><strong>{present}</strong></li>
              <li><span className="status"><span className="dot dot-accent-2" />欠課</span><strong>{absent}</strong></li>
            </ul>
            {isEnded && leftOnce > 0 && (
              <p className="small muted att-note">
                うち途中退出あり <strong>{leftOnce}</strong> 人（退出時間の累積が{lesson.away_timeout_min}分未満のため出席）
              </p>
            )}
            <Link className="btn btn-ghost att-link" to={`/lessons/${lessonId}/attendance`}>出席一覧を開く →</Link>
          </section>

          <section className="section">
            <h6 className="section-label">資料</h6>
            {materials.length === 0 ? (
              <p className="empty">資料はありません。</p>
            ) : (
              <ul className="mat-list">
                {materials.map((f) => {
                  const kind = fileKindLabel(f.mime);
                  return (
                    <li key={f.id}>
                      <FileLink className="mat-item" file={f}>
                        <span className={`mat-kind ${kind === '画像' ? 'mat-kind-img' : 'mat-kind-pdf'}`}>{kind}</span>
                        <span className="mat-name">{f.file_name}</span>
                        <span className="mat-pages">{formatBytes(f.size)}</span>
                      </FileLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </main>
      {toast}
    </div>
  );
}
