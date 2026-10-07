# LiveKit 部品の props（W3 → W4 / W5）

- 依頼元：w3-livekit
- 依頼先：w4-learn（生徒画面）、w5-teach（先生画面）
- 何を：`client/src/livekit/` の部品を pages に組み込んでほしい。import は `import { ... } from '../../livekit'`
- 現状：部品は実装済み。サーバーに `LIVEKIT_*` が未設定の環境では `status='unconfigured'` になり、部品は「配信サーバーが未設定です」等を表示する（クラッシュしない）

## useLiveKitRoom(lessonId, { enabled = true })

```js
const { room, status, error, identity, remoteParticipants } = useLiveKitRoom(lessonId, { enabled });
```

| 戻り値 | 型 | 説明 |
|---|---|---|
| `room` | `Room \| null` | 接続済みのときだけ入る。下の部品にそのまま渡す |
| `status` | `'idle'\|'connecting'\|'connected'\|'reconnecting'\|'disconnected'\|'unconfigured'\|'error'` | 表示文言は `STATUS_LABELS[status]` |
| `error` | `Error \| null` | |
| `identity` | `string \| null` | 自分の `"user:{id}"` |
| `remoteParticipants` | `RemoteParticipant[]` | 参加者の変化で更新される |

- `enabled=false` の間は接続しない。**生徒は授業が `live` のときだけ `enabled=true`**（待機画面では接続しない）。先生は `preparing` でも接続してプレビューしてよい
- アンマウントで切断する。画面の上位で1回だけ呼ぶ

## 生徒画面（W4）

```jsx
<RemoteVideo room={room} userId={lesson.teacher.id} source="auto" fit="contain" />   {/* 先生の映像（画面共有優先） */}
<RemoteVideo room={room} userId={spotlightUserId} source="camera" />                {/* スポットライト中の生徒（null なら placeholder） */}
<StudentCamera room={room} myUserId={me.id} teacherUserId={lesson.teacher.id} spotlightUserId={spotlightUserId} />
<RoomAudio room={room} />                                                           {/* 先生の音声。画面に1つ */}
```

- 待機画面（09）のカメラ確認は `<StudentCamera room={null} myUserId={me.id} teacherUserId={null} />`（どこにも送らないローカルプレビュー）
- `spotlightUserId` は `GET /api/lessons/:id` の `spotlight_user_id` を初期値にして、Socket の `SERVER_EVENTS.SPOTLIGHT_UPDATE`（`{ user_id }`）で更新する
- **`teacherUserId` と `spotlightUserId` は必ず渡す**（購読許可＝誰に映像が届くか、をここで決めている）

## 先生画面（W5）

```jsx
<TeacherPublisher room={room} status={status} />
<StudentGrid
  room={room}
  students={members}                       // GET /classes/:id/members（省略時は接続中の生徒だけ）
  spotlightUserId={spotlightUserId}
  onSpotlight={(userId) => putSpotlight(lessonId, userId)}   // null で解除。成功後は spotlight:update で状態更新
  highlightUserIds={raisedUserIds}         // 挙手中など目立たせたい生徒（任意）
  renderCellFooter={(s) => <AttendanceBadge userId={s.id} />} // セル下部に足したいもの（任意）
/>
<RoomAudio room={room} />
```

## 部品一覧

| 部品 | props |
|---|---|
| `TeacherPublisher` | `room`, `status?`, `showPreview?=true`, `className?` |
| `StudentCamera` | `room`（null 可）, `myUserId`, `teacherUserId`, `spotlightUserId?=null`, `defaultEnabled?=false`, `onEnabledChange?(bool)`, `showPreview?=true`, `className?` |
| `RemoteVideo` | `room`, `userId`, `source?='auto'\|'camera'\|'screen'`, `fit?='cover'\|'contain'`, `className?`, `placeholder?`（映像が無いとき） |
| `StudentGrid` | `room`, `students?`, `spotlightUserId?`, `onSpotlight?(userId\|null)`, `highlightUserIds?`, `renderCellFooter?(student)`, `className?` |
| `RoomAudio` | `room`（自動再生がブロックされたら「音声を再生」ボタンを出す） |
| `VideoTrackView` | `track`, `mirror?`, `fit?`, `className?`（ローカルトラックを貼るだけ） |
| `putSpotlight(lessonId, userId\|null)` | `PUT /api/lessons/:id/spotlight` |

- スタイルは `client/src/livekit/livekit.css`（`lk-` 接頭辞、broadsheet.css の変数を使用）。大きさ・配置は `className` で上書きしてよい
- 名前は React のテキストとして描画している（エスケープ済み）
