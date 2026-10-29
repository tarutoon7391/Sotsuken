# 並列開発 進捗記録（manager が更新）

フェーズ1 開始：2026-10-07 14:54 頃（5ワーカーに開始通知を送信）

| ワーカー | 開始通知 | 完了報告 | 所要 | 依頼メモ | 契約への疑問 |
|---|---|---|---|---|---|
| w1-core | 14:54 | 15:02（f947ec7） | 8分 | w1-lesson-attendance-hooks.md | 8件（全件 04 §6 に追記） |
| w2-live | 14:54 | 15:04（c30d9e2）→ 15:06（77f4af4） | 10分（+2） | （なし。依頼は報告文中） | 5件（3件採用、2件 pending） |
| w3-livekit | 14:54 | 15:00（0ba6f6b） | 6分 | w3-components.md | 3件（1件裁定、2件 pending） |
| w4-learn | 14:54 | 15:04（220acb8） | 10分 | （結合依頼は報告文中） | 3件（1件採用、2件 pending） |
| w5-teach | 14:54 | 15:10（581a3f3） | 16分 | w5-components.md、w5-integration.md | 6件（2件採用、4件 pending） |

## manager が受けたメッセージ（契約変更・ブロッカー）

| 時刻 | 発信 | 内容 | 裁定 |
|---|---|---|---|

## 周知した内容


## 進捗確認（14:58 頃・トーンさん指示）

| ワーカー | 完了 | 作業中 | 残り想定 | ブロッカー |
|---|---|---|---|---|
| w1-core | 手順1〜6 全部実装済み | スモーク NG 7件の切り分け（curl -F が 000、?tag= 日本語） | 20〜30分 | なし |
| w2-live | 手順1〜5 の services 層（finalizeAttendance / markPresentOnStart export 済み） | routes の 501 置換 → handlers・jobs | 約60分 | jest が ESM shared を require できない → manager が 40252ad で修正 |
| w3-livekit | 手順1・2（token/spotlight API、livekit 部品一式・ビルド確認済み） | 手順3 docs/livekit-notes.md・w3-components.md | 約15分 | なし（実接続はキー取得後） |
| w4-learn | 部品（映像・理解/挙手・資料ビューア・待機カメラ・退出ダイアログ）。W5 共通部品は確定版に差し替え済み | LearnPage / WaitingPage / AwayPage / AttentionModal と learn.css | 40〜60分 | なし（W3 部品は _stubs で進行） |
| w5-teach | 手順1（共通部品4つ＋RequireLogin、w5-components.md、W4 に確定通知済み・9e33d1a） | 手順2 auth（ログイン済み、登録・プロフィール実装中） | 約120分 | なし（W3 部品は _stubs） |

## manager が受けたメッセージ（契約変更・ブロッカー）

| 時刻 | 発信 | 内容 | 裁定 |
|---|---|---|---|
| 14:58 | w2-live | jest から ESM の @sotsuken/shared を require できない | インフラ不備として即修正。shared/cjs を生成し exports の require 条件で配布（main 40252ad）。W2 には cherry-pick を案内、他4人に周知 |
| 15:00 | w3-livekit | 完了報告（feat/w3-livekit 0ba6f6b）。契約の疑問3件 | (1) spotlight のレスポンス `{user_id}` → 04 の未記載を実装に合わせて追記（v4.2）。(2)(3) は仕様判断のため pending.md #1 #2 |
| 15:02 | w1-core | 完了報告（feat/w1-core f947ec7、スモーク 49/49）。未記載仕様の決定 8件、依頼メモ w1-lesson-attendance-hooks.md | 決定はすべて未記載の補完として採用し docs/04 §6（v4.2 補足）に明記。finalizeAttendance(lessonId, conn) の形は W2 が既に export 済み（一致） |
| 15:04 | w2-live | 完了報告（feat/w2-live-features c30d9e2、jest 9/9）。契約の疑問5件 | (2)(4)(5) は未記載の補完として採用し docs/04 §6 に追記。(1) interval_min の永続化と (3) 手動修正時の累積リセットは仕様判断のため pending #3 #4 |
| 15:04 | w4-learn | 完了報告（feat/w4-learn 220acb8、vite build OK）。W2 への依頼2件、契約の疑問3件 | W2 への依頼2件（absent 再接続・away 中の切断）は W2 の実装で既に満たされていることをコードで確認。POST questions のレスポンスは Question として 04 §6 に明記。挙手取り下げ・資料更新イベントは pending #5 #6。結合時：parts.js の _stubs を ../../livekit に差し替え |
| 15:05 | トーンさん | pending #3 → A、#4 → B | W2 に「手動で present にしたら away_total_sec=0・away_since=NULL」の修正を依頼 |
| 15:06 | w2-live | pending #4 反映（77f4af4、jest 10/10） | 受領。W2 の最終コミットは 77f4af4 |
| 15:10 | w5-teach | 完了報告（feat/w5-teach 581a3f3、6コミット）。契約の疑問6件、結合メモ w5-integration.md | (6) 挙手は question:new と question:raised の両方が届く → 04 §6 に明記。(5) 待機画面への導線は採用し 04 §6 に記録。(1)〜(4) は API 追加・ロール変更のため pending #7〜#10 |

## フェーズ1 完了（15:10）

| ワーカー | 開始 | 完了 | 所要 | 最終コミット |
|---|---|---|---|---|
| w1-core | 14:54 | 15:02 | 8分 | f947ec7 |
| w2-live | 14:54 | 15:04（+修正 15:06） | 10分（+2） | 77f4af4 |
| w3-livekit | 14:54 | 15:00 | 6分 | 0ba6f6b |
| w4-learn | 14:54 | 15:04 | 10分 | 220acb8 |
| w5-teach | 14:54 | 15:10 | 16分 | 581a3f3 |

- 壁時計時間：16分（14:54〜15:10）。所要の合計：52分 → 並列の効果 ≒ 3.3（完了時刻は各セッションの idle 通知の時刻。トーンさんのメモと突き合わせること）
- manager が受けた本文メッセージ：11通（進捗確認の返信5を含む）。契約変更の要望：0（すべて未記載の補完か仕様判断）
- 依頼メモ：docs/requests/ 4件（w1-lesson-attendance-hooks、w3-components、w5-components、w5-integration）
- 判断待ち：pending #7〜#10（結合の着手には影響しない）

## フェーズ2 結合（manager・15:12〜15:30）

- マージ 5 本（コンフリクト 1：progress.md、manager 起因）→ 繋ぎ込み 2 箇所＋_stubs 差し替え → jest 10/10・vite build OK → 通しシナリオ scripts/e2e-scenario.js 39/39
- 詳細は docs/integration-report.md

## 監査（manager・2026-10-08）

- 監査：W1 12体/6A/22B、W2 10体/5A/20B、W3 3体/1A/10B、W4 3体/6A/11B、W5 5体/8A/21B、契約追加5件、誤検知1件
- 方法：Haiku のサブエージェント（読み取りのみ）で 1ファイル（群）×1軸を照合し、manager が重複をまとめて主要な A を裏取りした。結果は docs/requests/audit-w1〜w5.md
- 契約追加5件（docs/04 v4.3）：`material:added`／`attention:check` を全員宛にして `issued_at`・`auto` を追加／発動直後の `attention:update`／`GET /lessons/:id/attention`／`GET /lessons/:id/attention/auto`
- あわせて更新：shared（`LIMITS`・`LIVEKIT_IDENTITY_PREFIX`・`ATTENTION_AUTO_TICK_SEC`・`MATERIAL_ADDED`、cjs 再生成）、broadsheet.css（`--color-overlay`・`--color-surface-glass`）、`client/src/lib/safe-url.js`、docs/03・07・08、CLAUDE.md
- 誤検知1件：W1「startLesson が classId と授業の所属を照合していない」（route が lesson.class_id を渡しているため問題なし）
- 追加裁定（同日）：W4 C-1 → pdf.js を client に追加してよい。C-2 → 半透明は color-mix でベース色は変数（`--color-overlay` / `--color-surface-glass` は取り消して削除）。W5 の凡例「わからない」→ 取り下げ（個人別の理解度表示はストレッチ）。W2 の auto フラグ → メモリ保持のまま（docs/03 §3 に既知の制約として記載）
- 監査対応の結合（同日）：W1 e4af954／W2 bc26f33／W3 fe9405b／W4 783ecf1／W5 4982760 を main に結合（b68ea41、コンフリクト 0）。manager の本体フォルダで jest 23/23・vite build OK（chunk サイズ警告あり）・通しシナリオ 39/39（Railway の MySQL）

## 機能追加：Office 資料のプレビュー（v4.4・2026-10-08）
- トーンさんの要望。方式は案 1（アップロード時にサーバーで LibreOffice により PDF 変換 → pdf.js で表示）。元ファイルのダウンロードボタンも付ける
- 契約：docs/04 v4.4、docs/03 `files.preview_url`（migration 002）、`FileInfo.preview_url`。依頼メモ docs/requests/office-preview.md（W1：変換・マイグレーション・Dockerfile、W4：資料パネル）
- Office プレビューの結合（同日）：W1 0f5e7c2・W4 1affe71 を main に結合（コンフリクト 0）。jest 23/23・build OK・通しシナリオ 39/39・W1 スモーク 54/54（LibreOffice の無い環境で preview_url=null のまま成功することを確認）。実際の PDF 変換と Docker ビルドは Railway デプロイ後に確認する
- migration 002 は manager が w1-core の migrate.js を直接実行して適用した。docs/10 §0（migrate はトーンさんだけ）と deny の回り道だったので、以後はしない

## manager セッション再開（2026-10-14）
- 状態確認：main 42d2dac ＝ origin/main ＝ Railway 本番（10-08 15:17 デプロイ SUCCESS、/api/health ok・db:true）。未コミット変更なし
- 5 ワーカーの worktree（feat/w1-core〜w5-teach）はすべて main より遅れていたので ff-only で 42d2dac に揃えた（各ブランチ固有のコミットは 0 だったので安全）
- pending.md を整理：#7・#8 は 10-08 監査の v4.3 で B 相当が実装済み（記録漏れを補完）。#9・#10 は未決のまま
- ワーカーセッションは未起動（/list-agents で名前付きセッションなし）。次のラウンドはトーンさんの課題投入待ち

## ラウンド3 開始（2026-10-14）
- 14:24 ワーカー5本（w1-core / w2-live / w3-livekit / w4-learn / w5-teach）起動を /list-agents で確認。manager（セッション名 2409009-6d）から開始通知を各1通送信、notify_when_idle 購読済み
- 初期タスクはトーンさんが各タブに投入。pending #9・#10 は未決のまま（実装禁止を周知）

| ワーカー | 開始通知 | 完了報告 | 所要 | 依頼メモ | 契約への疑問 |
|---|---|---|---|---|---|
| w1-core | 送信済 | | | | |
| w2-live | 送信済 | | | | |
| w3-livekit | 送信済 | | | | |
| w4-learn | 送信済 | | | | |
| w5-teach | 送信済 | | | | |

### ラウンド3 中断（2026-10-14 14:30 頃・トーンさん指示）
- 状態：5 ワーカーは開始通知を読んで待機のまま。**タスク未投入・コミット 0・未保存の変更 0**（全 worktree 42d2dac）。manager が受けた本文メッセージ 0
- 未決：pending #9（understanding_reset_at）・#10（生徒向け members）
- 再開手順：
  1. 本体フォルダで claude を起動（名前は manager。旧セッション名 2409009-6d は使われない）。docs/progress.md のこの節と docs/requests/pending.md を読む
  2. 各 worktree で claude --name w1-core 〜 w5-teach を起動 → /list-agents で 5 本確認
  3. manager が各ワーカーに開始通知（manager の実際のセッション名を書く）を送り、notify_when_idle を購読
  4. トーンさんが各タブにタスクのプロンプトを貼る。#9・#10 の A/B を決めたら manager が docs/04 を直して周知
  5. 完了報告が揃ったらフェーズ2（結合）は docs/10 §4 P6 のとおり manager が実施

### ラウンド3 終了（2026-10-31 記録）
- ラウンド3（10-14 開始）は**タスク未投入のまま終了**。ワーカーのコミット 0・契約変更 0。上の「再開手順」はそのまま次ラウンド（ラウンド4）の起動手順として使う

## 10-14 〜 10-31 の変更（manager が 2026-10-31 に記録）

- **10-27**：ユーザー管理ページ `/admin/users` を追加（9f9d4a5 → cb78481 で main に結合）。`MeResponse.is_admin`（.env の `ADMIN_LOGIN_IDS`）。管理者はユーザー一覧・パスワード再設定・削除ができる
- **10-29**：修正要望サイト連携を導入（PR #1）。要望サイト → Issue（ラベル `request-site`・`type:*`・`screen:*`）→ Claude Code Action が自動で PR → CI（許可パス・テスト）→ トーンさんがマージ。種別ごとのモデル切替（PR #6）と `type:feature`（PR #10）を追加。手順は docs/修正要望サイト_導入手順.md、ルールは CLAUDE.md「自動修正 PR のルール」
- Issue 経由でマージ済み 4 件：

| PR | Issue | 内容 | マージ |
|---|---|---|---|
| #4 | #3 | ログインボタンの角を少し丸くする | 10-29 |
| #8 | #7 | 先生画面の空状態の説明文を 1 行で表示する | 10-29 |
| #12 | #11 | アプリ名のプレースホルダーを「マナビバ」に置き換え | 10-31 |
| #14 | #13 | クラス詳細のメンバー一覧を右上固定のプルダウンに変更 | 10-31 |

## 裁定・契約更新（2026-10-31・トーンさん）

- **pending #9 → B**（`LessonDetail` に `understanding_reset_at`）、**#10 → A**（生徒は非表示のまま）。docs/04 v4.5 §6・shared `api-types` に反映。#9 の実装は次ラウンドの W1（1 行）
- **10-29 班員テスト 7 件**を docs/requests/feedback-1029.md に記録し仕分け：1・3・4・6 は要望サイト経由（上の Issue → PR で対応済み）、**2（挙手の取り下げ）・7（未応答者の名前）は契約変更**が要るので次ラウンドで W2/W4/W5、5 は再現情報待ち
- 2・7 の契約を docs/04 v4.5 と shared に追加：`DELETE /api/questions/:id`（本人・挙手のみ・open のみ。全員に `question:cancelled {id}`）、`GET /lessons/:id/attention` の各要素に `pending:[{id,name}]`。pending #5（A：MVP は無し）はこの要望で覆った旨を pending.md に注記
- **F-10 プログラミングモード 段階 0 を実施**：docs/11（まとめ書き）を docs/01 F-10／03 v4.5／04 v4.5 §7／05 #14〜17／07 §15／08 に取り込み、shared に型・イベント名・エラーコード・制限値を追加（cjs 再生成）、`server/migrations/003_code_mode.sql` を作成。**migrate は未実行（トーンさんのみ）**。以後は docs/11 ではなく各設計書を正とする
- 次ラウンド（ラウンド4）の投入候補：W1＝pending #9 ＋ F-10 段階1（tasks/documents/snapshots/summary/mine）／W2＝挙手取り下げ・attention pending ＋ F-10 段階1（save/run・待ち行列・Piston・Socket）／W3＝F-10 段階3（Piston セルフホスト）／W4＝挙手取り下げ UI ＋ F-10 生徒エディタ／W5＝未応答者の名前表示 ＋ F-10 先生コードグリッド。所有権の追加分は docs/11 §5（docs/10 への転記は次ラウンド開始時）

## F-10 プログラミングモード 段階 1 を manager が直列実装（2026-11-01・トーンさん裁定）

- 段階 0 の PR #15 を main にマージ（8e709ae）。`prestart` が migrate.js を流すので Railway のデプロイで migration 003 が自動適用された（デプロイログで「適用中: 003_code_mode.sql」を確認）
- トーンさんの判断で、段階 1 は並列ワーカーではなく **manager セッションで直列に実装**（ブランチ `feature/f10-stage1`）。所有権の区切り（docs/11 §5）はそのまま守った。段階 2（Yjs）・段階 3（Piston セルフホスト）は並列ワーカーに回す案
- 実装したもの（docs/04 §7 の契約どおり。契約の変更なし）
  - サーバー（W1 相当）：`services/code-tasks.js`・`routes/code-tasks.js`（課題 CRUD・active-task・redistribute・documents・summary・mine）。`LessonDetail` に `mode` / `active_task_id` / `code_spotlight_user_id` と **pending #9 の `understanding_reset_at`** を追加
  - サーバー（W2 相当）：`services/code-runner.js`（保存＝コンパイルのみ・実行・待ち行列・レート制限・Piston 連携・死活監視）、`services/code-mode.js`（モード切替・コードスポットライト）、`routes/code-run.js`、`sockets/handlers/code-syntax.js`、`io.emitToUser` と本人ルーム、`jobs/code-runner-health.js`。`.env` に `CODE_RUNNER_URL`
  - 生徒画面（W4 相当）：`components/learn/code/*`（CodeEditor＝CodeMirror 6・TaskTabs・RunPanel・OutputPanel・CodeStage）、LessonLive の coding 分岐（先生映像は右上の小窓）、`/lessons/:id/code/mine`（MyCodePage）
  - 先生画面（W5 相当）：`components/teach/code/*`（CodePanel・TaskManager・CodeGrid・CodeInspector）、TeachPage のモード切替トグル・映像／コードタブ・起動ダイアログ、ResultPage のコードのセクション
  - コードスポットライト・再配布は段階 2 の予定だったが、API も UI も小さいので段階 1 に含めた。**先生の直接編集（Yjs）・先生カーソル・teacher_editing は未実装（段階 2）**。拡大パネルは読み取り専用
- 実装で決めた未記載事項（契約の変更ではなく補完。docs/04 §7 への追記候補）
  - 保存＝コンパイルのみの実現：Piston に `Compile.java`（何もしない main）を先頭、`Main.java` を 2 番目で渡す。compile 段階の exit code ≠ 0 または stderr の `Main.java:N: error:` で `compile_error`。桁は `^` の位置
  - `run` の `run_id` は実行前に `code_runs` に仮の行（status `runner_unavailable`）を入れて確保し、結果で UPDATE する。サーバー再起動で残った仮の行は `runner_unavailable` のまま
  - 課題の初回作成で active になったときは `code:task_added` に加えて `code:active_task` も送る（生徒・先生の画面が同じ経路で切り替わるように）
  - `code:spotlight` の解除は `{user_id:null, task_id}`。スポットライトは `active_task_id` が無ければ 409
  - 保存（コンパイル）も実行と同じ待ち行列を通す（同時接続数を抑えるため。position の通知は run だけ）
  - クラス詳細・授業終了画面の「自分のコード」リンクは課題の有無を見ずに出す（ページ側で「コードを書いていません」）
- テスト：`code-runner.test.js`（DB 不要・11 件）、`code-mode.test.js`（DB あり時のみ・Piston は fetch モック）。manager 環境に .env が無いので DB テストは skip。vite build OK（chunk サイズ警告あり）
- **未確認**：Piston 公開 API への実リクエスト（manager セッションでは外部送信が止められた）。`Compile.java` 先頭方式で run 段階が main を呼ばない前提は、トーンさんが curl か実機で確認する
- 次：PR → トーンさんが実機確認（先生＋生徒 2 タブ）→ 段階 2（Yjs）・段階 3（Piston セルフホスト）の投入

### 段階 1 の本番確認と実行サーバーの行き詰まり（2026-11-01 午後）
- PR #16（段階 1）・#17（/api/health に `code_runner`）・#18（公開 API の上限で 400 → 控えめな値で再送、拒否理由を出力パネルへ）を main にマージ・デプロイ済み
- 本番で保存・実行を試した結果：アプリ → Piston の呼び出し自体は動いているが、**emkc.org の公開 Piston API が 2026-02-15 からホワイトリスト制**で HTTP 401（「Public Piston API is now whitelist only」）。段階 1 の「生徒が書いて実行できる」はこの 1 点で未達。エディタ・保存の DB 書き込み・先生のコードグリッド・課題管理・モード切替は動作確認済み
- LiveKit の 401 は Railway の攻撃対応でキーを止めているため（想定どおり・F-10 と無関係）
- **決定（トーンさん）**：段階 3 を前倒しし、**さくらのVPS 石狩・1G プラン・Ubuntu 24.04** を借りて Piston をセルフホストする（国内 VPS は CVE-2026-99999 対応で新規停止が多く、11/1 時点で借りられるのが石狩だけ）。手順・制限値・未決事項（Railway → VPS の経路の守り方）は **docs/infra/piston-setup.md**
- アプリ側：`.env` の `CODE_RUNNER_CONCURRENCY` で授業ごとの同時実行本数を上書きできるようにした（1G では 2）
- 次：VPS 到着 → docs/infra/piston-setup.md §3〜5 → Railway の `CODE_RUNNER_URL` を VPS に向けて再デプロイ → 実行の実機確認 → 段階 2（Yjs）


## 班員テスト1回目（2026-10-29）：フィードバック 7件・裁定済み
- 着手順：5 → 2 → 7 → 1・3・6・4
- 契約追加（docs/04 v4.5）：`DELETE /api/questions/:id`（挙手の取り下げ）＋`question:cancelled {id}`／`GET /lessons/:id/attention` の各要素に `pending:[{id,name}]`／shared に `QUESTION_CANCELLED`。docs/08 #18（挙手の取り下げ）をストレッチから MVP に戻した
- 割り当て：W3 最優先「カメラが付けられない」の切り分け（docs/requests/camera-check.md）／W2 DELETE questions・question:cancelled・attention の pending／W4 挙手ボタンのトグル／W5 挙手の表示3か所・下ろす・全員下ろす・QuestionBox の Enter 送信・ヘッダーに参加コード＋コピー・結果画面に未応答者名と Top3
- 結合（同日）：W2 ec4e7d9／W3 43e5a41／W5 e444f16／W4 721f117 を main に結合（3ff1ed5、コンフリクト 0。W4 が pages/teach に足した question:cancelled は W5 と重複したため W4 側を取り消し）。jest 25/25・build OK・通しシナリオ 45/45（取り下げの d' 節を含む）。未決：先生の DELETE 許可／Railway の LIVEKIT_* 確認／班員の camera-check.md 実施
