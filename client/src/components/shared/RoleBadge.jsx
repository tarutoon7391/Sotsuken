// ロールバッジ（先生／生徒）— 担当：W5
// props: { role: 'teacher' | 'student' }
export default function RoleBadge({ role }) {
  return <span className="role-badge" data-role={role}>{role === 'teacher' ? '先生' : '生徒'}</span>;
}
