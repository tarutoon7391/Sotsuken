// ログイン必須ページのラッパー — 担当：W5
// GET /api/me を呼び、未ログイン（401）なら api/client.js が /login へ飛ばす。
// role を渡すとロール不一致のとき /error/403 へ。中では useCurrentUser() で自分の情報を取れる。
//
// 使い方（App.jsx は変えないので、各ページの中で包む）：
//   export default function TeachPage() {
//     return <RequireLogin role="teacher"><TeachPageBody /></RequireLogin>;
//   }
//   function TeachPageBody() { const { user } = useCurrentUser(); ... }
import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { get } from '../../api/client.js';

const CurrentUserContext = createContext({ user: null, setUser: () => {} });

/** @returns {{ user: import('@sotsuken/shared/api-types').MeResponse, setUser: Function }} */
export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

export default function RequireLogin({ role, children }) {
  const [user, setUser] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    get('/me')
      .then((me) => alive && setUser(me))
      .catch(() => alive && setFailed(true)); // 401 は client.js が /login へ遷移させる
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return <p className="page-loading">ログイン情報を確認できませんでした</p>;
  if (!user) return <p className="page-loading">読み込み中…</p>;
  if (role && user.role !== role) return <Navigate to="/error/403" replace />;

  return <CurrentUserContext.Provider value={{ user, setUser }}>{children}</CurrentUserContext.Provider>;
}
