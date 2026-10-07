// パスワード入力（表示／非表示の切替つき）— ログイン・会員登録で使う
import { useState } from 'react';

/** アプリ名（未定。決まったらここだけ直す） */
export const APP_NAME = '（アプリ名）';

export default function PasswordInput({ id, value, onChange, autoComplete, invalid }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="pw-wrap">
      <input
        className="input"
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid ? 'true' : undefined}
      />
      <button
        className="pw-toggle"
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'パスワードを隠す' : 'パスワードを表示'}
      >
        {visible ? '隠す' : '表示'}
      </button>
    </div>
  );
}
