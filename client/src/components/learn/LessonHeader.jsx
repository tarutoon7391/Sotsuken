// 生徒画面のヘッダー（授業待機・授業中・一時退出中で共通）— 担当：W4
// props:
//   className:   string               クラス名
//   title:       string               授業タイトル
//   status:      { label: string, tone: 'on'|'off'|'absent' }  自分の状態（ドット＋文字）
//   me:          { id, name, role, icon_url? } | null           名前セット（アイコン＋名前＋ロールバッジ）
//   action?:     ReactNode            右端のボタン（一時退出／退出）
//   mobile?:     boolean              スマホ表示（ドット・タイトル・ボタンだけに詰める）
import { Avatar, RoleBadge } from './parts.js';

export default function LessonHeader({ className, title, status, me, action, mobile = false }) {
  if (mobile) {
    return (
      <header className="lr-header is-mobile">
        <span className={`lr-dot is-${status.tone}`} title={status.label} />
        <div className="lr-header-title">{title}</div>
        {action}
      </header>
    );
  }
  return (
    <header className="lr-header">
      <div className="lr-header-left">
        <div className="lr-header-class">{className}</div>
        <div className="lr-header-title">{title}</div>
      </div>
      <div className="lr-status">
        <span className={`lr-dot is-${status.tone}`} />
        {status.label}
      </div>
      {me && (
        <div className="lr-person">
          <Avatar user={me} size={32} />
          <span className="lr-person-name">{me.name}</span>
          <RoleBadge role={me.role} />
        </div>
      )}
      {action}
    </header>
  );
}
