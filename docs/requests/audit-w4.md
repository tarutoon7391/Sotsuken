# W4 監査結果（2026-10-08）
- 依頼元：manager
- 依頼先：w4-learn
- 対象：`client/src/pages/learn/*`、`client/src/components/learn/*`
- 方法：Haiku のサブエージェント3体（API/イベントの使い方・画面設計・規約）で照合し、マネージャーがまとめた。A-1〜A-3 はコードで裏取り済み
- 依頼：**A を直し、B は自分で判断できないものを @manager に上げてから完了報告し直すこと**
- 総評：REST・Socket の名前と形は仕様どおり。イベント名の直書きも無い。エスケープ漏れ（dangerouslySetInnerHTML 等）も無い

---

## A. 直す

### A-1. 確認ボタンが、サーバーの結果を見ずに「確認しました」と出す
- 場所：`client/src/pages/learn/LessonLive.jsx:225-229`（`respondCheck`）
- 契約：docs/04 §2「deadline 超過は 409 CHECK_EXPIRED」、§6「失敗時の ack は `{error:{code,message}}`」
- 現状：emit の直後に成功のトーストを出している。締切を過ぎていても、生徒には成功と表示される
- 対応案：emit の ack を受け取り、`error.code === ERROR_CODES.CHECK_EXPIRED` なら「締切を過ぎました」と出す

### A-2. learn.css に直書きの色がある
- 場所：`client/src/pages/learn/learn.css`。`#fff`（:70,73,139,146,168）、`#3a3838`（:83。変数に無い色）、`rgba(...)`（:69,77,85,89,138,152,158,205,218）
- 規約：CLAUDE.md「色・余白は `client/src/styles/broadsheet.css` の変数から取る」
- 対応案：`#fff` は `var(--color-surface)` 等に置き換える。半透明が必要な箇所は、broadsheet.css に該当する変数があれば使う。無ければ B に回して @manager に相談
- 余白の px 直書きも多い。直せる範囲で `--space-*` に置き換える（変数に無い値は無理に合わせなくてよい）

### A-3. 初回の読み込みでエラーを握りつぶしている
- 場所：`LessonLive.jsx:42-47`（出席状態）、`:111-122`（質問）、`:124-130`（チャット）。どれも `.catch(() => {})`
- 規約：docs/07 §0「状態がある画面は全状態（読込中・空・エラー）を作る」
- 現状：失敗しても何も表示されない。出席状態は「出席中」のままになる

### A-4. 一時退出画面の読み込み失敗時に、戻る導線が無い
- 場所：`client/src/pages/learn/AwayPage.jsx:318-320, 364-370`
- 設計：docs/07 §2-14「戻る導線（クラス一覧／ログイン）」。LearnPage（:112-118）にはある

### A-5. 待機画面にカメラ拒否時の案内が無い
- 場所：`client/src/pages/learn/WaitingPage.jsx:225`
- 設計：docs/design/09 の「カメラの許可がないとき」ブロック（案内文、「もう一度試す」ボタン）
- ※ カメラ部品の文言（「カメラを ON」など）は W3 の StudentCamera 側にある。文言を変えたいなら w3-livekit に頼むこと

### A-6. PDF の拡大表示とスマホでのスワイプ送りが無い
- 場所：`client/src/components/learn/MaterialPanel.jsx:183`（拡大は画像のみ）、`:147-160, 210-231`（スワイプが無い）
- 設計：docs/design/10 の student.js（zoom、data-swipe）

---

## B. 要確認（@manager 判断）

| # | 場所 | 内容 |
|---|---|---|
| B-1 | `LessonLive.jsx:186-198, 310` | 挙手の取り下げ。08 #18 は「取り下げ可」だが、docs/04 に取り下げの API・イベントが無い。今の作りでは表示だけ戻すので、先生の一覧には残る。再読込すると挙手中に戻り、もう一度押すと挙手が二重に作られる。仕様に入れるか、UI を外すか |
| B-2 | `AwayPage.jsx:93-95, 198-200` | 残り 0 になるとサーバーの確定を待たずに「欠課」と表示し、`/return` を呼ばずに授業画面へ戻る。戻った先の Socket 接続でサーバー側が present に戻る可能性がある |
| B-3 | `AttentionModal.jsx:13,25,155` | 締切を端末の時計で判定している（時計がずれると早く閉じる／締切後も押せる） |
| B-4 | `LearnPage.jsx:51`、`LessonLive.jsx:335`、`AwayPage.jsx:60,90` | GET /lessons/:id の `class_id`・`away_timeout_min` を使っている。§2 の形には無い（W1 の B-1 と同じ論点） |
| B-5 | `LessonLive.jsx:240-248` | away の失敗で CONFLICT を「欠課」の意味に使っている（W2 の B-8 と同じ論点） |
| B-6 | `LearnPage.jsx:82,86`、`WaitingPage.jsx:67,270` | `'connect'` / `'disconnect'` / `'teacher'` を直書きしている（ロールには `ROLES.TEACHER` がある） |
| B-7 | `components/learn/format.js:59` | `safeUrl` が `/\evil.example` を通す（外部に飛ぶ）。javascript: はきちんと弾いている |
| B-8 | `LessonLive.jsx:412-415` | PC だけに、設計に無い「更新」ボタンがある。スマホには資料の再読込手段が無い |
| B-9 | `useIsMobile.js:4`、`learn.css:44` | 700〜887px の幅で横スクロールが出る |
| B-10 | 設計との差 | 再接続中の表示場所、映像ラベルの文言（VideoStage :369-427）、資料の総ページ数と 1/2/4 ページ同時表示、生徒が資料を削除する導線（08 #22） |
| B-11 | `/ended`・`/away` ルート | docs/04 §4 の画面一覧に無い |

---

## 【裁定】（2026-10-08 manager）
- 前提：`shared/`、`broadsheet.css`（`--color-overlay`・`--color-surface-glass`）、`client/src/lib/safe-url.js`、docs/04・07・08 を更新した。**再読込してから着手すること**
- **直す**：A-1〜A-5。A-6 はスマホのスワイプ送りを先にやる（PDF の拡大は後回しでよい）
- **B の裁定**：
  - B-8：「更新」ボタンを削除する。資料は `material:added` を受けて更新する
  - B-1：挙手の取り下げ UI を削除する（ストレッチに移動した）。「挙手中」の表示は `GET /lessons/:id/questions` に自分の open の挙手があるかで判断する
  - B-2：残り 0 になったら `GET /attendance/me` を取り直して判定する。欠課でも視聴は続けられるようにし、欠課のバナーを出す
  - B-3：カウントダウンは `attention:check` の `issued_at` を基準にする（v4.3 で追加）
  - B-7：`components/learn/format.js` の `safeUrl` をやめて、`client/src/lib/safe-url.js` に移る
  - B-6：`'teacher'` は `ROLES.TEACHER` にする。`'connect'` / `'disconnect'` は直書きしてよい（CLAUDE.md で例外にした）
  - B-9：700〜887px で横スクロールが出ないようにする
  - B-5：`/away` の 409 は ALREADY_ABSENT に揃えた（docs/04 v4.3）。エラーコードで判定する
  - A-2：半透明は `--color-overlay` / `--color-surface-glass` を使う。変数に無い色が必要なら @manager へ
- **仕様側で解決したもの**：B-11（docs/04 §4 に `/away` と `/ended` を追記した）
- **未裁定**（@manager の判断待ち。着手しない）：B-4、B-10
