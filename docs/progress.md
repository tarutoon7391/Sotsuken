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
