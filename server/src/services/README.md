# services — ビジネスロジック（routes から呼ぶ）

routes/ は「入力チェック → services の関数を呼ぶ → 結果を返す」だけにし、SQL や判定はここに書く。
Socket ハンドラやジョブからも同じ関数を再利用できるようにするため。

| ファイル | 担当 | 内容 |
|---|---|---|
| `access.js` | フェーズ0（共通） | クラス／授業へのアクセス権判定。**各担当はこれを使う。自前の所属チェックを書かない** |
| `auth.js` `classes.js` `lessons.js` `files.js` | W1 | アカウント・クラス・授業・資料 |
| `attendance.js` `attention.js` `questions.js` `understanding.js` `chat.js` | W2 | 出席・確認ボタン・理解度・質問・チャット |
| `livekit.js` | W3 | LiveKit トークン発行・スポットライト |

結合時に繋ぐ約束（docs/10 を参照）：
- `lessons.js`（W1）の end から `attendance.js`（W2）の「出席確定」関数を呼ぶ
- `livekit.js`（W3）のスポットライト更新から `sockets/io.js` の `emitToLesson` で `spotlight:update` を送る
