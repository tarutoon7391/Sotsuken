# sockets/handlers — Socket.IO イベントハンドラ（出席・確認・理解度・質問・チャット担当）

このフォルダの `.js` は `sockets/index.js` が起動時に自動で読み込む。
各ファイルは **`function (io, socket)` を export** し、その中で `socket.on(...)` を登録する。

```js
// 例：sockets/handlers/understanding.js
const { CLIENT_EVENTS, SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { ROLES } = require('@sotsuken/shared/constants');
const { emitToTeachers } = require('../io');

module.exports = function register(io, socket) {
  const { user, role, lessonId } = socket.data;
  socket.on(CLIENT_EVENTS.UNDERSTANDING_SEND, async ({ type }) => {
    if (role !== ROLES.STUDENT) return;
    // …保存して集計…
    emitToTeachers(lessonId, SERVER_EVENTS.UNDERSTANDING_UPDATE, { understood: 0, confused: 0, again: 0, total: 0 });
  });
};
```

接続時に揃っている情報（`sockets/index.js` が入れる）：

| キー | 内容 |
|---|---|
| `socket.data.user` | `{ id, name, role }`（セッションのユーザー） |
| `socket.data.role` | `'teacher'` / `'student'`（**この授業に対する**役割） |
| `socket.data.lessonId` | 接続時に渡された `lesson_id`（所属検証済み） |
| `socket.data.lesson` | 接続時点の lessons 行（`status` など。古くなるので判定は都度 DB を見る） |

ルーム（宛先の振り分け）：`roomNames.lesson(id)` 全員／`roomNames.teachers(id)` 先生／`roomNames.students(id)` 生徒。
REST 側から送るときは `sockets/io.js` の `emitToLesson / emitToTeachers / emitToStudents` を使う。

イベント名は必ず `@sotsuken/shared/socket-events` から取る（文字列直書き禁止）。
`connection` 時の出席 present と `disconnect` 時の away は、出席担当が `attendance.js` に書く（授業が `live` のときだけ記録）。
