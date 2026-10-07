// ログイン — 担当：W5（デザイン：docs/design/01_ログイン）
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../../api/client.js';
import PasswordInput, { APP_NAME } from './PasswordInput.jsx';
import './auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!loginId.trim() || !password) {
      setError('ログインIDとパスワードを入力してください');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // 401 はこの画面でメッセージを出すので自動遷移しない
      await post('/login', { login_id: loginId.trim(), password }, { redirect: false });
      navigate('/classes', { replace: true });
    } catch (err) {
      setError(err.status === 401 || err.status === 400 ? 'ログインIDまたはパスワードが違います' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app auth-app">
      <main className="auth">
        <div className="auth-panel">
          <div className="brand">
            <h1 className="brand-name">{APP_NAME}</h1>
            <p className="brand-tagline">授業のための、ライブ授業アプリ</p>
          </div>

          <form className="form" onSubmit={handleSubmit} noValidate>
            {error && <div className="form-alert" role="alert">{error}</div>}

            <div className="field">
              <label htmlFor="loginId">ログインID</label>
              <input
                className="input"
                id="loginId"
                type="text"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck="false"
                placeholder="例：hinata"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                aria-invalid={error ? 'true' : undefined}
              />
            </div>

            <div className="field">
              <label htmlFor="password">パスワード</label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                invalid={!!error}
              />
            </div>

            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
              {busy ? 'ログイン中…' : 'ログイン'}
            </button>
          </form>

          <p className="auth-switch">
            はじめての方は <Link to="/register">会員登録</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
