// アイコン（画像が無ければ名前の頭文字）— 担当：W5
// props: { user: { name, icon_url? }, size?: number }
export default function Avatar({ user, size = 32 }) {
  const style = { width: size, height: size };
  if (user && user.icon_url) {
    return <img className="avatar" src={user.icon_url} alt={user.name} style={style} />;
  }
  return (
    <span className="avatar avatar--initial" style={style}>
      {user && user.name ? user.name.slice(0, 1) : '?'}
    </span>
  );
}
