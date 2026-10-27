// ユーザー管理（運用者向け）— /admin/users
// GET /api/me の is_admin が true のユーザーだけ開ける（サーバー側は .env の ADMIN_LOGIN_IDS で判定）。
// できること：ユーザー一覧（検索）・パスワードの照合／再設定・ユーザー削除
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { LIMITS, ROLES } from '@sotsuken/shared/constants';
import { del, get, post, put } from '../../api/client.js';
import RequireLogin, { useCurrentUser } from '../../components/shared/RequireLogin.jsx';
import AppHeader from '../../components/shared/AppHeader.jsx';
import Avatar from '../../components/shared/Avatar.jsx';
import RoleBadge from '../../components/shared/RoleBadge.jsx';
import ConfirmDialog from '../../components/learn/ConfirmDialog.jsx';
import useToast from '../../components/shared/useToast.jsx';
import useEscape from '../../components/shared/useEscape.js';
import PasswordInput, { APP_NAME } from '../auth/PasswordInput.jsx';
import './admin.css';

/** ISO 文字列 → "2026/10/27"（日本時間） */
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric' });
}

export default function AdminUsersPage() {
  return (
    <RequireLogin>
      <AdminGate />
    </RequireLogin>
  );
}

/** 管理者でなければ 403 画面へ */
function AdminGate() {
  const { user } = useCurrentUser();
  if (!user.is_admin) return <Navigate to="/error/403" replace />;
  return <AdminUsersBody />;
}

function AdminUsersBody() {
  const { user: me } = useCurrentUser();
  const [users, setUsers] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [dialog, setDialog] = useState(null); // { type: 'password' | 'delete', user }
  const [toast, showToast] = useToast();

  function load() {
    get('/admin/users')
      .then((rows) => setUsers(rows || []))
      .catch((err) => setLoadError(err.message));
  }
  useEffect(load, []);

  const shown = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (users || []).filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.login_id.toLowerCase().includes(q);
    });
  }, [users, keyword, roleFilter]);

  const teacherCount = (users || []).filter((u) => u.role === ROLES.TEACHER).length;
  const studentCount = (users || []).length - teacherCount;

  return (
    <div className="app admin-page">
      <AppHeader kicker={APP_NAME} title="ユーザー管理" user={me}>
        <Link className="btn btn-secondary back-link" to="/classes" title="クラス一覧へ戻る">←<span className="back-text"> クラス一覧へ戻る</span></Link>
      </AppHeader>

      <main className="app-main">
        <div className="list-wrap">
          <div className="list-head">
            <div>
              <h3>ユーザー一覧</h3>
              <p className="sub">
                {users ? `先生 ${teacherCount} 人・生徒 ${studentCount} 人` : '　'}
                　パスワードは暗号化されているため中身は表示できません。「照合」で一致するかだけ確認できます
              </p>
            </div>
          </div>

          <div className="admin-filters">
            <input
              className="input"
              type="search"
              placeholder="名前・ログインIDで検索"
              aria-label="名前・ログインIDで検索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <div className="admin-role-filter" role="group" aria-label="ロールで絞り込み">
              <button type="button" className={`chip ${roleFilter === '' ? 'is-on' : ''}`} onClick={() => setRoleFilter('')}>すべて</button>
              <button type="button" className={`chip ${roleFilter === ROLES.TEACHER ? 'is-on' : ''}`} onClick={() => setRoleFilter(ROLES.TEACHER)}>先生</button>
              <button type="button" className={`chip ${roleFilter === ROLES.STUDENT ? 'is-on' : ''}`} onClick={() => setRoleFilter(ROLES.STUDENT)}>生徒</button>
            </div>
          </div>

          {loadError && <div className="form-alert" role="alert">{loadError}</div>}
          {!users && !loadError && <p className="muted">読み込み中…</p>}

          {users && (
            <div className="admin-table-wrap">
              <table className="table admin-table">
                <thead>
                  <tr>
                    <th>ユーザー</th>
                    <th>ログインID</th>
                    <th>ロール</th>
                    <th className="num">クラス</th>
                    <th>登録日</th>
                    <th className="actions">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((u) => (
                    <tr key={u.id} className={u.id === me.id ? 'is-me' : ''}>
                      <td>
                        <span className="person">
                          <Avatar user={u} size={28} />
                          <span className="person-name">{u.name}</span>
                          {u.id === me.id && <span className="me-mark">（自分）</span>}
                        </span>
                      </td>
                      <td className="login-id">{u.login_id}</td>
                      <td><RoleBadge role={u.role} /></td>
                      <td className="num">{u.class_count}</td>
                      <td className="date">{formatDate(u.created_at)}</td>
                      <td className="actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ type: 'password', user: u })}>
                          パスワード
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-delete"
                          disabled={u.id === me.id}
                          title={u.id === me.id ? '自分自身は削除できません' : undefined}
                          onClick={() => setDialog({ type: 'delete', user: u })}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted empty-row">該当するユーザーがいません</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {dialog && dialog.type === 'password' && (
        <PasswordDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
          onReset={() => {
            setDialog(null);
            showToast(`${dialog.user.name} のパスワードを再設定しました`);
          }}
        />
      )}
      {dialog && dialog.type === 'delete' && (
        <DeleteDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            setDialog(null);
            setUsers((rows) => rows.filter((r) => r.id !== dialog.user.id));
            showToast(`${dialog.user.name} を削除しました`);
          }}
        />
      )}
      {toast}
    </div>
  );
}

/** パスワードの照合（一致するか）と再設定 */
function PasswordDialog({ user, onClose, onReset }) {
  const [checkPw, setCheckPw] = useState('');
  const [checkResult, setCheckResult] = useState(null); // null | true | false
  const [checkError, setCheckError] = useState('');
  const [checking, setChecking] = useState(false);

  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  useEscape(onClose);

  async function handleCheck(e) {
    e.preventDefault();
    if (!checkPw) return setCheckError('パスワードを入力してください');
    setCheckError('');
    setChecking(true);
    try {
      const { match } = await post(`/admin/users/${user.id}/password/verify`, { password: checkPw }, { redirect: false });
      setCheckResult(Boolean(match));
    } catch (err) {
      setCheckError(err.message);
    } finally {
      setChecking(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (newPw.length < LIMITS.PASSWORD_MIN) return setResetError(`パスワードは${LIMITS.PASSWORD_MIN}文字以上にしてください`);
    if (new TextEncoder().encode(newPw).length > LIMITS.PASSWORD_MAX_BYTES) return setResetError(`パスワードは${LIMITS.PASSWORD_MAX_BYTES}バイト以内にしてください`);
    if (newPw !== newPw2) return setResetError('確認用のパスワードが一致しません');
    setResetError('');
    setResetting(true);
    try {
      await put(`/admin/users/${user.id}/password`, { password: newPw }, { redirect: false });
      onReset();
    } catch (err) {
      setResetError(err.message);
      setResetting(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog admin-dialog" role="dialog" aria-labelledby="dlgPwTitle">
        <div className="dialog-title" id="dlgPwTitle">パスワード</div>
        <div className="dialog-body">
          <span className="person">
            <Avatar user={user} size={24} />
            <span className="person-name">{user.name}</span>
            <span className="login-id">@{user.login_id}</span>
          </span>
        </div>

        <form className="admin-form" onSubmit={handleCheck} noValidate>
          <h6 className="section-label">照合</h6>
          <p className="field-hint">入力したパスワードが登録されているものと一致するか確認します（中身は表示できません）</p>
          <div className="admin-form-row">
            <PasswordInput id="pwCheck" value={checkPw} onChange={(v) => { setCheckPw(v); setCheckResult(null); }} autoComplete="off" invalid={Boolean(checkError)} />
            <button className="btn btn-secondary" type="submit" disabled={checking}>{checking ? '確認中…' : '照合'}</button>
          </div>
          {checkError && <div className="field-error" role="alert">{checkError}</div>}
          {checkResult === true && <div className="form-ok" role="status">✓ 一致しました</div>}
          {checkResult === false && <div className="form-alert" role="status">✕ 一致しません</div>}
        </form>

        <form className="admin-form" onSubmit={handleReset} noValidate>
          <h6 className="section-label">再設定</h6>
          <p className="field-hint">新しいパスワードに置き換えます。{user.name} は全端末でログアウトされます</p>
          <div className="field">
            <label htmlFor="pwNew">新しいパスワード（{LIMITS.PASSWORD_MIN}文字以上）</label>
            <PasswordInput id="pwNew" value={newPw} onChange={setNewPw} autoComplete="new-password" invalid={Boolean(resetError)} />
          </div>
          <div className="field">
            <label htmlFor="pwNew2">新しいパスワード（確認）</label>
            <PasswordInput id="pwNew2" value={newPw2} onChange={setNewPw2} autoComplete="new-password" invalid={Boolean(resetError)} />
          </div>
          {resetError && <div className="field-error" role="alert">{resetError}</div>}
          <div className="dialog-actions">
            <button className="btn btn-secondary" type="button" onClick={onClose}>閉じる</button>
            <button className="btn btn-primary" type="submit" disabled={resetting}>{resetting ? '保存中…' : '再設定する'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** ユーザー削除の確認 */
function DeleteDialog({ user, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isTeacher = user.role === ROLES.TEACHER;

  async function handleConfirm() {
    setBusy(true);
    setError('');
    try {
      await del(`/admin/users/${user.id}`, { redirect: false });
      onDeleted();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const body = isTeacher
    ? `${user.name}（@${user.login_id}）を削除します。担当しているクラス ${user.class_count} 件と、その授業・出席・資料・チャットもすべて消えます。元に戻せません。`
    : `${user.name}（@${user.login_id}）を削除します。参加しているクラスの出席・質問・チャットなどの記録も消えます。元に戻せません。`;

  return (
    <ConfirmDialog
      title="ユーザーを削除"
      body={body}
      confirmLabel="削除する"
      busy={busy}
      error={error}
      onCancel={onClose}
      onConfirm={handleConfirm}
    />
  );
}
