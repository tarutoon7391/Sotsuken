// エラー／権限なし（401 / 403 / 404）— 担当：W5（デザイン：docs/design/14_エラー）
// /error/:status で開くほか、未定義パスのときは status=404 で表示される。
// ログイン不要の画面（401 でも開ける）。403/404 のときだけ GET /me で名前を出す（失敗しても遷移しない）
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../../api/client.js';
import Avatar from '../../components/shared/Avatar.jsx';
import RoleBadge from '../../components/shared/RoleBadge.jsx';
import { APP_NAME } from '../auth/PasswordInput.jsx';
import './common.css';

const MESSAGES = {
  401: {
    icon: '🔒',
    title: 'ログインの有効期限が切れました',
    lead: 'もう一度ログインすると、続きから使えます。',
    to: '/login',
    action: 'ログインする',
  },
  403: {
    icon: '⛔',
    title: 'このクラスのメンバーではないため、表示できません',
    lead: '先生から受け取った参加コードがあれば、クラス一覧から参加できます。',
    to: '/classes',
    action: 'クラス一覧へ',
    hint: '参加コードで参加できます',
  },
  404: {
    icon: '🔍',
    title: 'ページが見つかりませんでした',
    lead: '授業が削除されたか、リンクが間違っている可能性があります。',
    to: '/classes',
    action: 'クラス一覧へ',
  },
};

export default function ErrorPage({ status }) {
  const params = useParams();
  const raw = status || Number(params.status) || 404;
  const code = MESSAGES[raw] ? raw : 404;
  const msg = MESSAGES[code];
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (code === 401) return;
    get('/me', undefined, { redirect: false })
      .then(setMe)
      .catch(() => setMe(null));
  }, [code]);

  return (
    <div className="app center-page">
      <header className="app-header">
        <Link className="hdr-brand" to="/classes">{APP_NAME}</Link>
        <span className="hdr-spacer" />
        {me && (
          <span className="person">
            <Avatar user={me} />
            <span className="person-name">{me.name}</span>
            <RoleBadge role={me.role} />
          </span>
        )}
      </header>

      <main className="center">
        <div className="center-col err">
          <div className="icon is-muted" aria-hidden="true">{msg.icon}</div>
          <h6>{code}</h6>
          <h2>{msg.title}</h2>
          <p className="lead">{msg.lead}</p>
          <div className="actions">
            <Link className="btn btn-primary" to={msg.to}>{msg.action}</Link>
            {msg.hint && <p className="hint">{msg.hint}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
