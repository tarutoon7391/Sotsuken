// 会員登録（ロール選択） — 担当：W5（デザイン：docs/design/02_会員登録）
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ERROR_CODES, LIMITS, ROLES } from '@sotsuken/shared/constants';
import { post } from '../../api/client.js';
import PasswordInput, { APP_NAME } from './PasswordInput.jsx';
import './auth.css';

// 上限は LIMITS（docs/04 §6）から読む
const LOGIN_ID_RE = new RegExp(LIMITS.LOGIN_ID_PATTERN);

const ROLE_CARDS = [
  { role: ROLES.TEACHER, title: '先生', desc: ['クラスを作って', '授業を配信する'], icon: '🧑‍🏫' },
  { role: ROLES.STUDENT, title: '生徒', desc: ['参加コードでクラスに入って', '授業を受ける'], icon: '🎓' },
];

/** UTF-8 のバイト数（bcrypt の上限 72 バイトの確認用） */
function byteLength(s) {
  return new TextEncoder().encode(s).length;
}

function validate({ name, loginId, password, passwordConfirm }) {
  const errors = {};
  const id = loginId.trim();
  if (!name.trim()) errors.name = '表示名を入力してください';
  else if (name.trim().length > LIMITS.NAME_MAX) errors.name = `表示名は${LIMITS.NAME_MAX}文字以内にしてください`;
  if (!id) errors.loginId = 'ログインIDを入力してください';
  else if (!LOGIN_ID_RE.test(id)) errors.loginId = 'ログインIDは半角英数字と _ . - で入力してください';
  else if (id.length < LIMITS.LOGIN_ID_MIN || id.length > LIMITS.LOGIN_ID_MAX)
    errors.loginId = `ログインIDは${LIMITS.LOGIN_ID_MIN}〜${LIMITS.LOGIN_ID_MAX}文字にしてください`;
  if (!password) errors.password = 'パスワードを入力してください';
  else if (password.length < LIMITS.PASSWORD_MIN) errors.password = `パスワードは${LIMITS.PASSWORD_MIN}文字以上にしてください`;
  else if (byteLength(password) > LIMITS.PASSWORD_MAX_BYTES) errors.password = 'パスワードが長すぎます';
  if (!passwordConfirm) errors.passwordConfirm = '確認用のパスワードを入力してください';
  else if (passwordConfirm !== password) errors.passwordConfirm = 'パスワードが一致しません';
  return errors;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!role) return;
    const found = validate({ name, loginId, password, passwordConfirm });
    setErrors(found);
    setAlert('');
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await post(
        '/register',
        { name: name.trim(), login_id: loginId.trim(), password, role },
        { redirect: false }
      );
      navigate('/classes', { replace: true });
    } catch (err) {
      if (err.code === ERROR_CODES.CONFLICT) {
        setErrors({ loginId: 'このログインIDは既に使われています' });
      } else {
        setAlert(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app auth-app">
      <main className="auth">
        <div className="auth-panel auth-panel-wide">
          <div className="brand">
            <h1 className="brand-name">{APP_NAME}</h1>
            <p className="brand-tagline">会員登録</p>
          </div>

          <form className="form" onSubmit={handleSubmit} noValidate>
            {alert && <div className="form-alert" role="alert">{alert}</div>}

            <div>
              <h6 className="section-label">あなたは</h6>
              <div className="role-grid" role="group" aria-label="ロールを選ぶ">
                {ROLE_CARDS.map((c) => (
                  <button
                    key={c.role}
                    className="role-card"
                    type="button"
                    aria-pressed={role === c.role}
                    onClick={() => setRole(c.role)}
                  >
                    <span className="role-icon" aria-hidden="true" style={{ fontSize: 36 }}>{c.icon}</span>
                    <span className="role-title">{c.title}</span>
                    <span className="role-desc">
                      {c.desc[0]}
                      <br />
                      {c.desc[1]}
                    </span>
                  </button>
                ))}
              </div>
              <p className="role-help">
                {role ? 'ロールは登録後に変更できません' : '先生か生徒を選んでください'}
              </p>
            </div>

            <div className="field">
              <label htmlFor="name">
                表示名<span className="text-sub">（授業中に表示される名前）</span>
              </label>
              <input
                className="input"
                id="name"
                type="text"
                autoComplete="nickname"
                placeholder="例：田中 ひなた"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={errors.name ? 'true' : undefined}
              />
              <div className="field-error">{errors.name}</div>
            </div>

            <div className="field">
              <label htmlFor="loginId">ログインID</label>
              <input
                className="input"
                id="loginId"
                type="text"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck="false"
                placeholder="半角英数字"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                aria-invalid={errors.loginId ? 'true' : undefined}
              />
              <div className="field-error">{errors.loginId}</div>
            </div>

            <div className="field">
              <label htmlFor="password">パスワード</label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                invalid={!!errors.password}
              />
              <div className="field-error">{errors.password}</div>
            </div>

            <div className="field">
              <label htmlFor="passwordConfirm">パスワード（確認）</label>
              <PasswordInput
                id="passwordConfirm"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={setPasswordConfirm}
                invalid={!!errors.passwordConfirm}
              />
              <div className="field-error">{errors.passwordConfirm}</div>
            </div>

            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={!role || busy}>
              {busy ? '登録中…' : '登録してはじめる'}
            </button>
          </form>

          <p className="auth-switch">
            アカウントをお持ちの方は <Link to="/login">ログイン</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
