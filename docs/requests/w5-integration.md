# W5 結合時の作業と契約への疑問

- 依頼元：w5-teach
- 依頼先：manager

## 結合時に繋ぐ箇所

1. **LiveKit 部品の差し替え**：`client/src/pages/teach/TeachPage.jsx` の
   `import { ... } from '../../components/shared/_stubs/livekit.jsx';` を `import { ... } from '../../livekit';` に変える（props は docs/requests/w3-components.md と同じ）。
   その後 `client/src/components/shared/_stubs/` を削除し、`pages/teach/teach.css` の「仮の生徒グリッド（_stubs）」の節も消してよい
2. `components/shared/Placeholder.jsx` と app.css の `.placeholder-page` は W5 の画面では使わなくなった。W4 側も使っていなければ削除してよい

## 契約への疑問（仮対応済み・判断待ち）

| # | 内容 | 仮対応 |
|---|---|---|
| 1 | 授業結果の「確認ボタンの応答率」：授業内の確認（check_id）一覧を取る API が docs/04 に無い。GET /attention/:check_id は id が分からないと呼べない | 結果画面では「—（集計 API 未定）」と表示 |
| 2 | 自動確認の間隔（PATCH attention/auto）の現在値を取る手段が無い（GET /lessons/:id に無い） | 先生画面は毎回「オフ」から表示 |
| 3 | 理解度の「最終リセットから m:ss」：`understanding_reset_at` が GET /lessons/:id に無い | 画面を開いてからリセットした場合だけ表示 |
| 4 | クラス詳細のメンバー一覧：デザインは生徒にも一覧を見せるが、GET /classes/:id/members は先生専用 | 生徒には先生と自分だけ表示 |
| 5 | 生徒が開始前（preparing）の授業の待機画面（09）に入る導線がデザインに無い | クラス詳細の「予定」の行に、生徒向け「入室して待つ」（/lessons/:id/learn）リンクを追加 |
| 6 | `question:raised` と `question:new`（body null）の関係：挙手で両方届くのか片方なのか | 先生画面は question:raised でトースト＋質問一覧を取り直す（どちらでも動く） |
