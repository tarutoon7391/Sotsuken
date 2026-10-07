// クラス一覧 — 担当：W5（デザイン：docs/design/04_クラス一覧）
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEFAULTS, ROLES } from '@sotsuken/shared/constants';
import { get, post } from '../../api/client.js';
import RequireLogin, { useCurrentUser } from '../../components/shared/RequireLogin.jsx';
import Avatar from '../../components/shared/Avatar.jsx';
import RoleBadge from '../../components/shared/RoleBadge.jsx';
import useToast from '../../components/shared/useToast.jsx';
import { APP_NAME } from '../auth/PasswordInput.jsx';
import './classes.css';

const CLASS_NAME_MAX = 50; // classes.name VARCHAR(50)

/** 授業画面のパス（先生は teach、生徒は learn） */
export function lessonPath(lessonId, role) {
  return `/lessons/${lessonId}/${role === ROLES.TEACHER ? 'teach' : 'learn'}`;
}

export default function ClassListPage() {
  return (
    <RequireLogin>
      <ClassListBody />
    </RequireLogin>
  );
}

function ClassListBody() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const isTeacher = user.role === ROLES.TEACHER;
  const [classes, setClasses] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState(null); // 'create' | 'join' | { created }
  const [toast, showToast] = useToast();

  function load() {
    get('/classes')
      .then((rows) => setClasses(rows || []))
      .catch((err) => setLoadError(err.message));
  }
  useEffect(load, []);

  const live = (classes || []).filter((c) => c.live_lesson_id);

  return (
    <div className="app classes-page">
      <header className="app-header">
        <Link className="hdr-brand" to="/classes">{APP_NAME}</Link>
        <span className="hdr-spacer" />
        <Link className="person" to="/me" title="プロフィール設定">
          <Avatar user={user} />
          <span className="person-name">{user.name}</span>
          <RoleBadge role={user.role} />
        </Link>
      </header>

      <main className="app-main">
        <div className="list-wrap">
          <div className="list-head">
            <div>
              <h3>クラス一覧</h3>
              <p className="sub">授業中のクラスがあれば、ここからすぐ入れます</p>
            </div>
            {isTeacher ? (
              <button className="btn btn-primary" onClick={() => setDialog('create')}>＋ クラスを作成</button>
            ) : (
              <button className="btn btn-primary" onClick={() => setDialog('join')}>参加コードで参加</button>
            )}
          </div>

          {loadError && <div className="form-alert" role="alert">{loadError}</div>}
          {!classes && !loadError && <p className="muted">読み込み中…</p>}

          {live.length > 0 && (
            <section className="live-section">
              <h6 className="section-label"><span className="dot dot-live" />いま授業中</h6>
              <div className="live-grid">
                {live.map((c) => (
                  <div key={c.id} className="card live-card">
                    <div className="card-top">
                      <div className="card-title">{c.name}</div>
                      <span className="live-tag"><span className="dot dot-live" />授業中</span>
                    </div>
                    <div className="card-meta">
                      <Avatar user={{ ...c.teacher, role: ROLES.TEACHER }} size={22} />
                      <span className="person-name">{c.teacher.name}</span>
                    </div>
                    <div className="live-actions">
                      <Link className="btn btn-primary" to={lessonPath(c.live_lesson_id, user.role)}>入室する</Link>
                      <Link className="btn btn-ghost btn-sm" to={`/classes/${c.id}`}>クラス詳細</Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {classes && classes.length > 0 && (
            <section>
              <h6 className="section-label">すべてのクラス <span className="count">{classes.length}</span></h6>
              <div className="class-grid">
                {classes.map((c) => (
                  <button key={c.id} type="button" className="card class-card" onClick={() => navigate(`/classes/${c.id}`)}>
                    <div className="card-top">
                      <div className="card-title">{c.name}</div>
                      {c.live_lesson_id && <span className="live-tag"><span className="dot dot-live" />授業中</span>}
                    </div>
                    <div className="card-meta">
                      <span className="person">
                        <Avatar user={{ ...c.teacher, role: ROLES.TEACHER }} size={22} />
                        <span className="person-name">{c.teacher.name}</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {classes && classes.length === 0 && (
            isTeacher ? (
              <div className="empty">
                <h4>最初のクラスを作成しましょう</h4>
                <p>クラスを作ると参加コードが発行されます。生徒にコードを伝えると、そのクラスに参加できます。</p>
                <button className="btn btn-primary btn-lg" onClick={() => setDialog('create')}>＋ クラスを作成</button>
              </div>
            ) : (
              <div className="empty">
                <h4>先生から参加コードをもらって参加しましょう</h4>
                <p>参加コードは {DEFAULTS.JOIN_CODE_LENGTH} 桁の英数字です。先生に聞いてみてください。</p>
                <button className="btn btn-primary btn-lg" onClick={() => setDialog('join')}>参加コードで参加</button>
              </div>
            )
          )}
        </div>
      </main>

      {dialog === 'create' && (
        <CreateClassDialog
          onClose={() => setDialog(null)}
          onCreated={(created) => {
            setDialog({ created });
            load();
          }}
        />
      )}
      {dialog && dialog.created && (
        <CreatedDialog created={dialog.created} onClose={() => setDialog(null)} onCopied={() => showToast('コピーしました')} />
      )}
      {dialog === 'join' && (
        <JoinDialog
          onClose={() => setDialog(null)}
          onJoined={() => {
            setDialog(null);
            showToast('クラスに参加しました');
            load();
          }}
        />
      )}
      {toast}
    </div>
  );
}

function CreateClassDialog({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('クラス名を入力してください');
    if (trimmed.length > CLASS_NAME_MAX) return setError(`クラス名は${CLASS_NAME_MAX}文字以内にしてください`);
    setBusy(true);
    try {
      const res = await post('/classes', { name: trimmed });
      onCreated({ ...res, name: trimmed });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" role="dialog" aria-labelledby="dlgCreateTitle" onSubmit={submit} noValidate>
        <div className="dialog-title" id="dlgCreateTitle">クラスを作成</div>
        <div className="field">
          <label htmlFor="className">クラス名</label>
          <input
            className={`input${error ? ' is-error' : ''}`}
            id="className"
            placeholder="例：2年A組・数学"
            autoComplete="off"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>キャンセル</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>作成</button>
        </div>
      </form>
    </div>
  );
}

function CreatedDialog({ created, onClose, onCopied }) {
  function copy() {
    if (navigator.clipboard) navigator.clipboard.writeText(created.join_code).catch(() => {});
    onCopied();
  }
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-labelledby="dlgCreatedTitle">
        <h6 className="section-label" style={{ margin: 0 }}>✓ クラスを作成しました</h6>
        <div className="dialog-title" id="dlgCreatedTitle">{created.name}</div>
        <div className="dialog-body">生徒にこの参加コードを伝えてください。クラス詳細からいつでも確認できます。</div>
        <div className="join-code">
          <span className="join-code-value">{created.join_code}</span>
          <button type="button" className="btn btn-secondary" onClick={copy}>コピー</button>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

function JoinDialog({ onClose, onJoined }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const value = code.trim(); // 大文字小文字はサーバーの判定に任せる（変換しない）
    if (!value) return setError('参加コードを入力してください');
    setBusy(true);
    try {
      // 404/400 はこの場でメッセージを出す（エラー画面へ飛ばさない）
      await post('/classes/join', { join_code: value }, { redirect: false });
      onJoined();
    } catch (err) {
      setError(
        err.status === 404 || err.status === 400 ? '参加コードが違います。先生に確認してください' : err.message
      );
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" role="dialog" aria-labelledby="dlgJoinTitle" onSubmit={submit} noValidate>
        <div className="dialog-title" id="dlgJoinTitle">参加コードで参加</div>
        <div className="dialog-body">先生からもらった参加コードを入力してください。</div>
        <div className="field">
          <label htmlFor="joinCode">参加コード</label>
          <input
            className={`input input-code${error ? ' is-error' : ''}`}
            id="joinCode"
            maxLength={DEFAULTS.JOIN_CODE_LENGTH}
            autoComplete="off"
            spellCheck="false"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
          />
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>キャンセル</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>参加する</button>
        </div>
      </form>
    </div>
  );
}
