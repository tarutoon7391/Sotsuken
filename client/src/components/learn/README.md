# components/learn — 生徒画面専用の部品（担当：W4）

生徒画面（LearnPage / AwayPage / AttentionModal / WaitingPage）だけで使う部品を置く。
先生画面と共通の部品（ChatPanel / QuestionBox / RoleBadge / Avatar）は `components/shared/`（W5 が実装）。

W5 / W3 の部品がまだ無いときは、同じ props の仮コンポーネントを `_stubs/` に置いて進め、
「部品確定」のメッセージが届いたら本物に差し替える。`_stubs/` は結合時に削除する。
