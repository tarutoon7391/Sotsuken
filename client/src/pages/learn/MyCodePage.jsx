// 生徒：自分のコード（授業後・/lessons/:id/code/mine）— 担当：W4（F-10・docs/07 §15.4）
// 課題ごとに自分のコードを読み取り専用で表示し、コピーできる。他人のコードは見えない（GET /lessons/:id/code/mine）。
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROLES } from '@sotsuken/shared/constants';
import { get } from '../../api/client.js';
import RequireLogin, { useCurrentUser } from '../../components/shared/RequireLogin.jsx';
import AppHeader from '../../components/shared/AppHeader.jsx';
import useToast from '../../components/shared/useToast.jsx';
import { formatTime } from '../../components/shared/format.js';
import CodeEditor from '../../components/learn/code/CodeEditor.jsx';
import '../common/common.css';
import '../../components/learn/code/code.css';

export default function MyCodePage() {
  return (
    <RequireLogin role={ROLES.STUDENT}>
      <MyCodeBody />
    </RequireLogin>
  );
}

function MyCodeBody() {
  const { id } = useParams();
  const lessonId = Number(id);
  const { user } = useCurrentUser();
  const [toast, showToast] = useToast();
  const [lesson, setLesson] = useState(null);
  const [cls, setCls] = useState(null);
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    get(`/lessons/${lessonId}`)
      .then((l) => {
        if (!alive) return;
        setLesson(l);
        get(`/classes/${l.class_id}`).then((c) => alive && setCls(c)).catch(() => {});
      })
      .catch((err) => alive && setError(err.message));
    get(`/lessons/${lessonId}/code/mine`)
      .then((rows) => alive && setDocs(rows || []))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [lessonId]);

  async function copy(source) {
    try {
      await navigator.clipboard.writeText(source);
      showToast('コードをコピーしました');
    } catch {
      showToast('コピーできませんでした');
    }
  }

  return (
    <div className="app">
      <AppHeader kicker={cls ? cls.name : ''} title={lesson ? `${lesson.title} — 自分のコード` : '自分のコード'} user={user}>
        {lesson && <Link className="btn btn-ghost btn-sm" to={`/classes/${lesson.class_id}`}>← クラスへ</Link>}
      </AppHeader>

      <main className="page" style={{ padding: 'var(--space-4) var(--space-6)', maxWidth: 960, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {error && <div className="form-alert" role="alert">{error}</div>}
        {!error && docs === null && <p className="page-loading">読み込み中…</p>}
        {docs && docs.length === 0 && <p className="muted">この授業ではコードを書いていません</p>}
        {docs && docs.length > 0 && (
          <div className="mycode-list">
            {docs.map((d) => (
              <section key={d.task.id} className="mycode-item">
                <div className="mycode-head">
                  <h3>{d.task.title}</h3>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(d.source)}>コピー</button>
                  <span className="tiny muted">{d.last_saved_at ? `最終保存 ${formatTime(d.last_saved_at)}` : '未保存（テンプレートのまま）'}</span>
                </div>
                <CodeEditor value={d.source} readOnly />
              </section>
            ))}
          </div>
        )}
      </main>
      {toast}
    </div>
  );
}
