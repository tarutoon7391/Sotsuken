# W5 監査結果（2026-10-08）
- 依頼元：manager
- 依頼先：w5-teach
- 対象：`client/src/pages/{teach,auth,classes,common}/*`、`client/src/components/shared/*`、`client/src/styles/app.css`
- 方法：Haiku のサブエージェント5体で照合し、マネージャーが重複をまとめた
  - API/イベントの使い方（先生画面・共通画面の2体）
  - 画面設計（先生画面・共通画面の2体）
  - 規約（1体）
- 依頼：**A-1〜A-8（裏取り済み）は必ず直す。A-9 以降（設計との差・未裏取り）は確認したうえで直す。B は自分で判断できないものを @manager に上げる。そのあとで完了報告し直すこと**
- 総評：呼んでいる API・イベントはすべて契約にあるもの。イベント名・エラーコードの直書きも無い。エスケープ漏れ（dangerouslySetInnerHTML 等）も無い。部品の props は w5-components.md と一致している

---

## A. 直す（裏取り済み）

### A-1. 理解度リセットで、人数（total）だけ古い値が残る
- 場所：`client/src/pages/teach/TeachPage.jsx:168-171` `({ ...EMPTY_UNDERSTANDING, total: u.total })`
- 契約：docs/04 §5「理解度リセット後、understanding:update が 0 に戻る」
- 現状：次の update が来るまで「0/N人」と表示され、割合の計算も古い total を基準にする。なお、サーバーはリセット直後に 0 件の update を送っている

### A-2. 出席の閾値の上限が 60 になっている（仕様は 180）
- 場所：`client/src/pages/teach/AttendancePage.jsx:122-123, 199`
- 契約：docs/04 §6「away_timeout_min 1〜180」（モックは max=60 だが、仕様を優先する）

### A-3. 会員登録でパスワードの長さを検査していない
- 場所：`client/src/pages/auth/RegisterPage.jsx:25`（空チェックだけ）
- 契約：docs/04 §6「パスワード 8文字以上・72バイト以内」。モックの文言は「8文字以上にしてください」
- ついでに：確認欄が空のときに「パスワードが一致しません」と出る（:26）。モックは「確認用のパスワードを入力してください」

### A-4. タグを 10 個までに制限していない
- 場所：`client/src/pages/classes/ClassDetailPage.jsx:387-394`（`addTag`）
- 契約：docs/04 §6「タグ 30文字以内・10個まで」

### A-5. 授業結果画面に開発者向けのメモが表示されている
- 場所：`client/src/pages/teach/ResultPage.jsx:121-122`「確認ボタンの応答率（集計 API 未定）」
- 対応案：利用者向けの表示（「—」など）にする。API が無い件は B-1

### A-6. スマホ幅のプロフィール画面で戻るボタンからはみ出す・名前が消えない
- 場所：`client/src/pages/auth/ProfilePage.jsx:88`（文字が `.back-text` の span で囲まれていない）、`auth.css:143`（存在しない `.user-name` を指定している。AppHeader は `.person-name`）

### A-7. app.css に直書きの色がある
- 場所：`client/src/styles/app.css:77` `rgba(0,0,0,.45)`
- 規約：CLAUDE.md「色は broadsheet.css の変数から取る」

### A-8. エラーを握りつぶしている／未処理の Promise がある
- `TeachPage.jsx:117-130`：初回読み込みに catch が無い。401/403/404 以外のエラーだと「読み込み中…」のまま止まる
- `ResultPage.jsx:36-43, 73-76`：`markAnswered` が失敗しても何も表示されない
- `ClassDetailPage.jsx:42-51, 327, 331-337`：一覧の読み込みと資料削除に catch が無い

## A（続き）. 設計との差（Haiku の報告・未裏取り。モックを見て確認してから直す）
- **先生画面（06）**：
  - ~~生徒グリッドの凡例に「わからない」が無い~~（2026-10-08 裁定で取り下げ。個人別の理解度表示はストレッチ）
  - 一時退出中のセルに残り時間が出ず、減光もしていない（モックは opacity .45）
  - 「生徒 N人」の N が入室数ではなく全メンバー数になっている
  - ヘッダーに「再接続中」の状態が無い
  - 配信前の文言がモックと違う
  - 理解度・接続状態の文言がモックと違う
  - 資料削除の取り消し条件が、モックの「3 秒で戻る」ではなく blur になっている
- **出席（07）**：
  - 強調の閾値が違う（残り 5 分・累積 2/3）
  - 状態の並び順が違う（一時退出→欠課→出席）
  - 「手動修正」の印が、note が空だと付かない
- **授業結果（08）**：
  - 未回答が 0 のときの表記が「未回答なし」になっていない
  - 資料の種別が「IMG」になっている（モックは「画像」）
- **ログイン・登録**：
  - ログイン：入力を直してもエラー表示が消えない（LoginPage :57）
  - 登録：ロールを選んだあとの補足文言が違う
- **クラス一覧・詳細**：
  - クラス一覧：サブタイトルがロールで変わらない
  - ダイアログが Esc で閉じない（CreatedDialog は背景クリックでも閉じない）
  - 参加・削除・保存のトーストに名前が入っていない
  - 授業 0 件のときに見出しとボタンが二重に出る（ClassDetailPage :119-124）
  - メンバータブに人数が出ない
- **エラー画面**：404 の見出しがモックと違う（「授業が見つかりませんでした」）
- **共通部品**：QuestionBox で、自分の匿名投稿が「匿名（自分）」と表示されない

---

## B. 要確認（@manager 判断）

| # | 場所 | 内容 |
|---|---|---|
| B-1 | `ResultPage.jsx:121`、`AttendancePage` | 確認ボタンの応答率と、生徒ごとの応答状態を取る API が仕様に無い |
| B-2 | `TeachPanels.jsx:49-58, 91-112` | 自動で発動した確認は、先生に `attention:update` しか届かない（check_id が無い）ので、応答状況が画面に出ない。仕様側で対応するか |
| B-3 | `TeachPage.jsx:85` | 自動発動の間隔の現在値を取る API が無い。再読込すると表示が 0 に戻る |
| B-4 | `TeachPage.jsx:267` | attention の pending の初期値を「present の生徒」で作っている。サーバーの算出方法と合っているか |
| B-5 | `TeachPage.jsx:293-299, 462` | スポットライトを UI で live 中に限定している（§6 pending #1 では ended でも拒否しない） |
| B-6 | `AttendancePage.jsx:75-76` | Socket の購読が live のときだけ。開始前にこの画面を開くと、`lesson:started` を受け取れない |
| B-7 | `AttendancePage.jsx:151-152` | 手動修正で away を選べる。その場合の away_since の扱いが仕様に無い |
| B-8 | `ResultPage.jsx:73-76` | 終了後に質問を回答済みにする操作（W2 の B-2 と同じ論点） |
| B-9 | 各所 | GET /lessons/:id の `class_id`・`away_timeout_min`、出席の `note` が §2 に無い（W1 の B-1 と同じ論点） |
| B-10 | `ClassDetailPage.jsx:279-283` | 予定授業の「▶ 開始する」は先生画面を開くだけで、開始は先生画面で行う（意図的な実装）。モックとの差として許容するか |
| B-11 | 先生画面（06）の配信 | カメラと画面共有を同時に送れる（モックは切替式）。「配信停止」の操作が無い。授業終了後に結果画面へ直接行かず、/ended を経由する |
| B-12 | 先生・出席・結果画面 | スマホ幅に対応していない（teach.css `min-width:1180px`）。docs/07 §0 は PC とスマホの両方、モックの README は「PC のみ」で食い違っている |
| B-13 | `api/client.js:17-20, 68-70` | 401 で /login へ直接遷移するので、/error/401 の画面には通常届かない。コメントの「SPA 内遷移」と実装が食い違っている |
| B-14 | `ProfilePage.jsx:15, 44, 51` | アイコンは PNG/JPEG のみ・10MB（モックは 2MB の仮置き）。画像を選んだ時点でアップロードされる（モックは保存ボタン押下時） |
| B-15 | `RegisterPage.jsx:23` | ログインID の許可文字がサーバー・モック・クライアントでそれぞれ違う（W1 の B-5 と合わせて決める） |
| B-16 | `LoginPage.jsx:28` | 400 も「IDまたはパスワードが違います」と表示している |
| B-17 | `QuestionBox.jsx:32-36` | 送信が失敗しても入力欄の本文が消える |
| B-18 | `PasswordInput.jsx:90` ほか | `APP_NAME = '（アプリ名）'` のまま |
| B-19 | 規約 | `.jsx` が PascalCase（規約は kebab-case.js）。`'connect'`/`'disconnect'` の直書き、`Avatar`・`ChatPanel` で URL を検査せずに src/href に入れている（W4 の safeUrl と揃えるか） |
| B-20 | CSS | 余白の px 直書きが多い（6px・12px・14px など、トークンに無い値がある）。トークンを足すか、直書きを許容するか |
| B-21 | モックの参加コード | モックは「K7Q-4MP」（7 文字）、仕様は 8 桁。モック側を直すか |

---

## 【裁定】（2026-10-08 manager）
- 前提：`shared/`（`LIMITS` ほか）、`broadsheet.css`、`client/src/lib/safe-url.js`、CLAUDE.md、docs/04・07・08 を更新した。**再読込してから着手すること**
- **直す**：A-1〜A-8
- **設計との差は、次のものを先にやる**（裁定の文面は「6つ」だが、列挙されているのは7項目。7つともやる）：
  1. ~~生徒グリッドの凡例に「わからない」を足す~~（追加裁定で取り下げ）
  2. 一時退出中のセル（残り時間を出し、減光する）
  3. 「N人」を入室数にする
  4. ダイアログを Esc で閉じられるようにする
  5. 授業 0 件のときに見出しとボタンが二重に出るのを直す
  6. ログインのエラー表示を、入力を直したら消す
  7. QuestionBox で自分の匿名投稿を「匿名（自分）」と表示する
- 残りの設計差は、上の7つのあとで余力があればやる
- **B の裁定**：
  - B-11：授業を終了したら、先生は授業結果画面へ直行する（/ended を経由しない）。配信停止の操作は W3 が `TeacherPublisher` に足す
  - B-6：Socket は ended 以外なら購読する（開始前に開いても `lesson:started` を受けられるようにする）
  - B-21：参加コードは `XXXX-XXXX` で表示する（入力のハイフンはサーバーが取り除く）
  - B-15・B-14・B-20：上限は `LIMITS` から import する（アイコンは 2MB、PNG・JPEG）
  - B-16：400 は「入力内容を確認してください」と表示する
  - B-19：`Avatar` と `ChatPanel` は `client/src/lib/safe-url.js` を通す。`.jsx` の PascalCase と `'connect'` の直書きは、CLAUDE.md で例外にした
  - B-12：先生画面（6・7・8）は MVP では PC のみ（docs/07 §0）
- **契約の追加（受け側を実装する）**：
  1. `material:added`：資料パネルを更新する
  2. `attention:check`（全員宛。`{check_id, issued_at, deadline_at, auto}`）：自動発動の分も応答状況パネルに出す
  3. 発動直後の `attention:update`：応答状況の初期値に使う（B-4 の pending の自前計算をやめる）
  4. `GET /api/lessons/:id/attention`：授業結果画面の応答率を出す（B-1）
  5. `GET /api/lessons/:id/attention/auto`：先生画面の再読込時に自動発動の間隔を復元する（B-3）
- **仕様側で解決したもの**：
  - B-8：回答済み操作は ended でも可
  - B-9：`note` を docs/04 §2 に追記した
- **未裁定**（@manager の判断待ち。着手しない）：B-2（契約の追加 2 で解決見込み）、B-5、B-7、B-10、B-13、B-17、B-18

## 【追加裁定】（2026-10-08 manager）
- 凡例「わからない」は取り下げた。個人別の理解度表示はストレッチ（docs/08、S-01 の隣）に移した
- 404 の見出し「ページが見つかりませんでした」と「匿名（自分）」の挙動は、報告のとおりでよい
- `--color-overlay` は broadsheet.css から削除した（main）。`app.css:77` を `color-mix(in srgb, var(--color-xxx) N%, transparent)` に置き換えること（ベース色は必ず変数）
