# 共通部品の使い方（W5 → W4）

- 依頼元：w5-teach
- 依頼先：w4-learn
- 状態：**確定**（props は各ファイル先頭コメントのとおり。フェーズ0から変更なし）
- 置き場所：`client/src/components/shared/`
- 見た目：`client/src/styles/app.css`（main.jsx で読み込み済み。追加の import は不要）

## RoleBadge

```jsx
import RoleBadge from '../../components/shared/RoleBadge.jsx';
<RoleBadge role={user.role} />   // 'teacher' → 「先生」、それ以外 → 「生徒」
```

## Avatar

```jsx
import Avatar from '../../components/shared/Avatar.jsx';
<Avatar user={user} size={32} />
```

- `user`：`{ name, icon_url? }`。UserBrief をそのまま渡せばよい（`role` があれば頭文字の色が先生／生徒で変わる）
- `user` が null / undefined のときは「？」（匿名用）
- 名前表示は「Avatar ＋ 名前 ＋ RoleBadge」のセット。並べるときは `<span className="person">` で包むと間隔がそろう

## ChatPanel

```jsx
import ChatPanel from '../../components/shared/ChatPanel.jsx';
<ChatPanel
  messages={messages}            // ChatMessage[]。並び順は問わない（中で id 昇順に並べる）
  onSend={(body) => socket.emit(CLIENT_EVENTS.CHAT_MESSAGE, { body })}
  onAttach={async (file) => {    // 形式・サイズのチェックは済んだ File が来る
    const fd = new FormData();
    fd.append('kind', FILE_KINDS.ATTACHMENT);
    fd.append('file', file);
    const { file_id } = await upload(`/lessons/${lessonId}/files`, fd);
    socket.emit(CLIENT_EVENTS.CHAT_MESSAGE, { file_id });
  }}
  currentUser={me}
  onLoadMore={loadOlder}         // 任意。GET /lessons/:id/chat?before=<最古の id>
/>
```

- 親要素が高さを決める。`display:flex; flex-direction:column` の親に置けばリスト部分がスクロールする
- 新着は下に追従（ユーザーが上を読んでいる間は動かさない）。過去分を先頭に足したときは表示位置を保つ
- Enter で送信（日本語変換中の Enter は無視）。添付は `ALLOWED_UPLOAD_MIMES` / `FILE_MAX_BYTES` で事前チェックし、NG ならパネル内にエラー表示
- `file.mime` が `image/*` ならサムネイル、それ以外はファイル名のリンク
- 重複排除はしない（Socket の `chat:message` と GET /chat の結果をマージするときは呼び出し側で id 重複を除く）

## QuestionBox

```jsx
import QuestionBox from '../../components/shared/QuestionBox.jsx';
// 生徒
<QuestionBox
  questions={questions}
  onPost={(body, isAnonymous) => post(`/lessons/${lessonId}/questions`, { body, is_anonymous: isAnonymous })}
  isTeacher={false}
/>
```

- 生徒のとき：一覧＋投稿フォーム（本文・「匿名で投稿」スイッチ）。`onMarkAnswered` は渡さなくてよい
- `body` が null の質問（挙手のみ）は生徒の一覧には出さない（先生側だけ「挙手中」に出る）
- 匿名の質問は「匿名」と表示（サーバーが生徒には user を含めない前提。含まれていても生徒には名前を出さない）
- `question:answered { id }` を受けたら、該当 id の `status` を `'answered'` にした配列を渡し直せば「回答済み」タグが付く
- 挙手ボタン（`question:raise`）は QuestionBox には含まない。生徒画面側のボタンで送る

## RequireLogin（W5 の画面用。W4 も使ってよい）

```jsx
import RequireLogin, { useCurrentUser } from '../../components/shared/RequireLogin.jsx';
export default function LearnPage() {
  return <RequireLogin role="student"><LearnPageBody /></RequireLogin>;
}
function LearnPageBody() { const { user } = useCurrentUser(); /* ... */ }
```

- GET /api/me で確認。401 は api/client.js が /login へ、ロール不一致は /error/403 へ

## 日時表示

`components/shared/format.js` に `formatTime(iso)`（日本時間 "14:05"）、`formatDuration(sec)`（"m:ss"）などを置いた。使ってよい。
