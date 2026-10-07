// ロールバッジ（先生／生徒）— 担当：W5
// props: { role: 'teacher' | 'student' }
import { ROLES } from '@sotsuken/shared/constants';

export default function RoleBadge({ role }) {
  const isTeacher = role === ROLES.TEACHER;
  return (
    <span className={`tag role-badge ${isTeacher ? 'tag-accent' : 'tag-neutral'}`} data-role={role}>
      {isTeacher ? '先生' : '生徒'}
    </span>
  );
}
