// フェーズ0の仮ページ。各画面の空コンポーネントが「どの画面か」を表示するためだけのもの。
// 画面を実装したら使わなくなる（削除は結合時に行う）。
export default function Placeholder({ title, owner, designDir }) {
  return (
    <main className="placeholder-page">
      <h1>{title}</h1>
      <p>未実装（担当：{owner}）</p>
      {designDir && <p>デザイン：docs/design/{designDir}/index.html</p>}
    </main>
  );
}
