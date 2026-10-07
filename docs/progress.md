# 並列開発 進捗記録（manager が更新）

フェーズ1 開始：2026-10-07 14:54 頃（5ワーカーに開始通知を送信）

| ワーカー | 開始通知 | 完了報告 | 所要 | 依頼メモ | 契約への疑問 |
|---|---|---|---|---|---|
| w1-core | 14:54 | 15:32（f947ec7） | 38分 | w1-lesson-attendance-hooks.md | 8件（全件 04 §6 に追記） |
| w2-live | 14:54 | | | | |
| w3-livekit | 14:54 | 15:20（0ba6f6b） | 26分 | w3-components.md | 3件（1件裁定、2件 pending） |
| w4-learn | 14:54 | | | | |
| w5-teach | 14:54 | | | | |

## manager が受けたメッセージ（契約変更・ブロッカー）

| 時刻 | 発信 | 内容 | 裁定 |
|---|---|---|---|

## 周知した内容


## 進捗確認（15:10 頃・トーンさん指示）

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
| 15:08 | w2-live | jest から ESM の @sotsuken/shared を require できない | インフラ不備として即修正。shared/cjs を生成し exports の require 条件で配布（main 40252ad）。W2 には cherry-pick を案内、他4人に周知 |
| 15:20 | w3-livekit | 完了報告（feat/w3-livekit 0ba6f6b）。契約の疑問3件 | (1) spotlight のレスポンス `{user_id}` → 04 の未記載を実装に合わせて追記（v4.2）。(2)(3) は仕様判断のため pending.md #1 #2 |
| 15:32 | w1-core | 完了報告（feat/w1-core f947ec7、スモーク 49/49）。未記載仕様の決定 8件、依頼メモ w1-lesson-attendance-hooks.md | 決定はすべて未記載の補完として採用し docs/04 §6（v4.2 補足）に明記。finalizeAttendance(lessonId, conn) の形は W2 が既に export 済み（一致） |
