# components/learn — 生徒画面専用の部品（担当：W4）

生徒画面（LearnPage / AwayPage / AttentionModal / WaitingPage）だけで使う部品を置く。
先生画面と共通の部品（ChatPanel / QuestionBox / RoleBadge / Avatar）は `components/shared/`（W5 が実装）。

他ワーカーの部品は `parts.js` 経由で import する（結合済み）。
