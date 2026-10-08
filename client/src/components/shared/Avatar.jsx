// アイコン（画像が無ければ名前の頭文字）— 担当：W5
// props: { user: { name, icon_url? }, size?: number }
// - user に role があれば頭文字の背景色を先生／生徒で変える（UserBrief をそのまま渡せばよい）
// - user が無い（匿名質問など）ときは「？」をグレーで出す
import { ROLES } from '@sotsuken/shared/constants';
import { safeUrl } from '../../lib/safe-url.js';

export default function Avatar({ user, size = 32 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  const iconUrl = user ? safeUrl(user.icon_url) : null; // 安全でない URL は使わず頭文字で代用
  if (iconUrl) {
    return <img className="avatar avatar--image" src={iconUrl} alt={user.name || ''} style={style} />;
  }
  const name = user && user.name ? String(user.name).trim() : '';
  let tone = 'avatar-anon';
  if (name) tone = user.role === ROLES.TEACHER ? 'avatar-teacher' : 'avatar-student';
  return (
    <span className={`avatar avatar--initial ${tone}`} style={style} aria-hidden="true">
      {name ? Array.from(name)[0] : '？'}
    </span>
  );
}
