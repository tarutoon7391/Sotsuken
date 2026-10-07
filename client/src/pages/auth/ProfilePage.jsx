// プロフィール設定 — 担当：W5（デザイン：docs/design/03_プロフィール設定）
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEFAULTS } from '@sotsuken/shared/constants';
import { post, put, upload } from '../../api/client.js';
import RequireLogin, { useCurrentUser } from '../../components/shared/RequireLogin.jsx';
import AppHeader from '../../components/shared/AppHeader.jsx';
import Avatar from '../../components/shared/Avatar.jsx';
import RoleBadge from '../../components/shared/RoleBadge.jsx';
import { formatBytes } from '../../components/shared/format.js';
import { APP_NAME } from './PasswordInput.jsx';
import './auth.css';

const NAME_MAX = 30;
const ICON_MIMES = ['image/png', 'image/jpeg'];

export default function ProfilePage() {
  return (
    <RequireLogin>
      <ProfileBody />
    </RequireLogin>
  );
}

function ProfileBody() {
  const navigate = useNavigate();
  const { user, setUser } = useCurrentUser();
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState('');
  const [iconError, setIconError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function handleIcon(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setIconError('');
    if (!ICON_MIMES.includes(file.type)) {
      setIconError('JPG か PNG の画像を選んでください');
      return;
    }
    if (file.size > DEFAULTS.FILE_MAX_BYTES) {
      setIconError(`画像が大きすぎます（${formatBytes(DEFAULTS.FILE_MAX_BYTES)}まで）`);
      return;
    }
    const fd = new FormData();
    fd.append('icon', file);
    try {
      const { icon_url } = await upload('/me/icon', fd);
      setUser({ ...user, icon_url });
      setMessage('アイコンを変更しました');
    } catch (err) {
      setIconError(err.message);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setNameError('表示名を入力してください');
    if (trimmed.length > NAME_MAX) return setNameError(`表示名は${NAME_MAX}文字以内にしてください`);
    setNameError('');
    setBusy(true);
    try {
      const me = await put('/me', { name: trimmed });
      setUser({ ...user, ...(me || { name: trimmed }) });
      setMessage('保存しました');
    } catch (err) {
      setNameError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await post('/logout', undefined, { redirect: false });
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="app auth-app">
      <AppHeader kicker={APP_NAME} title="プロフィール設定" user={user}>
        <Link className="btn btn-secondary back-link" to="/classes">← クラス一覧へ戻る</Link>
      </AppHeader>

      <main className="me-main">
        <form className="me-panel" onSubmit={handleSave} noValidate>
          {message && <div className="form-ok" role="status">{message}</div>}

          <section className="me-section">
            <h6 className="section-label">アイコン</h6>
            <div className="icon-row">
              <Avatar user={user} size={120} />
              <div className="icon-actions">
                <input ref={fileRef} type="file" accept={ICON_MIMES.join(',')} hidden onChange={handleIcon} />
                <button className="btn btn-secondary" type="button" onClick={() => fileRef.current.click()}>
                  画像を選ぶ
                </button>
                <div className="field-hint">JPG・PNG。{formatBytes(DEFAULTS.FILE_MAX_BYTES)}までです</div>
                {iconError && <div className="field-error" role="alert">{iconError}</div>}
              </div>
            </div>
          </section>

          <section className="me-section">
            <h6 className="section-label">表示名</h6>
            <div className="field">
              <input
                className="input"
                aria-label="表示名"
                type="text"
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={nameError ? 'true' : undefined}
              />
              <div className="field-error">{nameError}</div>
            </div>
          </section>

          <section className="me-section">
            <h6 className="section-label">ロール</h6>
            <div className="role-row">
              <RoleBadge role={user.role} />
              <span className="role-note">🔒 ロールは登録後に変更できません</span>
            </div>
          </section>

          <div className="me-actions">
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
              {busy ? '保存中…' : '保存'}
            </button>
            <button className="btn btn-ghost btn-logout" type="button" onClick={handleLogout}>
              ログアウト
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
