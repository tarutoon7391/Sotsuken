# docs/requests — 他領域への依頼メモ

ワーカーが**自分の担当範囲の外**に手を入れたくなったとき、コードを触る代わりにここへメモを書いて止まる。
結合（フェーズ2）でマネージャーが全部読み、繋ぎ込みを行う。

## 書き方

ファイル名：`<自分の名前>-<内容>.md`（例：`w1-end-calls-attendance.md`、`w3-components.md`）

```md
# <タイトル>
- 依頼元：w1-core
- 依頼先：w2-live（または manager）
- 何を：lessons end の中で services/attendance.js の finalizeAttendance(lessonId) を呼びたい
- なぜ：授業終了時に出席を2値に確定する（docs/04「授業」end）
- 影響範囲：server/src/services/lessons.js の end のみ
- 現状の仮対応：TODO コメントを置いて呼び出しは未接続
```

## 種類

| 種類 | 送り先 | 備考 |
|---|---|---|
| 結合時に繋ぐ箇所（関数呼び出し・Socket 送信） | ここにメモ | マネージャーがフェーズ2で繋ぐ |
| 部品の props 確定（W3 → W4/W5、W5 → W4） | `w3-components.md` / `w5-components.md` に書き、相手に @名前 で1通 | 2者で完結 |
| 契約（shared/・docs/04・DB）の変更要望 | @manager にメッセージ（何を・なぜ・影響範囲） | マネージャーが `pending.md` に記録 |

依頼メモの数は「契約の穴の数」として効率測定に使うので、消さずに残す。
