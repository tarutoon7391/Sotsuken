// 画面上部のヘッダー（キッカー＋タイトル ／ 右側の任意要素 ／ 自分の名前セット）— 担当：W5
// props:
//   kicker?:   string        タイトル上の小さい文字（クラス名など）
//   title:     string
//   user?:     MeResponse    渡すと右端に「アイコン＋名前＋ロールバッジ」（/me へのリンク）を出す
//   children?: ReactNode     タイトルと名前セットの間に置く要素（戻るリンク・状態など）
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import RoleBadge from './RoleBadge.jsx';

export default function AppHeader({ kicker, title, user, children }) {
  return (
    <header className="app-header">
      <div className="hdr-left">
        {kicker && <div className="hdr-kicker">{kicker}</div>}
        <div className="hdr-title">{title}</div>
      </div>
      <span className="hdr-spacer" />
      {children}
      {user && (
        <Link className="person" to="/me" title="プロフィール設定">
          <Avatar user={user} size={32} />
          <span className="person-name">{user.name}</span>
          <RoleBadge role={user.role} />
        </Link>
      )}
    </header>
  );
}
