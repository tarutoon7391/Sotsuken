// エラー／権限なし（401 / 403 / 404）— 担当：W5（デザイン：docs/design/14_エラー）
// /error/:status で開くほか、未定義パスのときは status=404 で表示される。
import { useParams } from 'react-router-dom';
import Placeholder from '../../components/shared/Placeholder.jsx';

export default function ErrorPage({ status }) {
  const params = useParams();
  const code = status || Number(params.status) || 404;
  return <Placeholder title={`エラー（${code}）`} owner="W5" designDir="14_エラー" />;
}
