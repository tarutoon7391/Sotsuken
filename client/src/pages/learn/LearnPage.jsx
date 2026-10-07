// 生徒画面（授業中）— 担当：W4（デザイン：docs/design/10_生徒画面_授業中）
// status が preparing の間は WaitingPage（9）を表示し、lesson:started で授業画面（10）に切り替える。
// 確認ポップアップ（11）は AttentionModal をこの上に重ねる。
import Placeholder from '../../components/shared/Placeholder.jsx';

export default function LearnPage() {
  return <Placeholder title="生徒画面（授業中）" owner="W4" designDir="10_生徒画面_授業中" />;
}
