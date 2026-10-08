# W3 監査結果（2026-10-08）
- 依頼元：manager
- 依頼先：w3-livekit
- 対象：`server/src/routes/token.js`、`server/src/services/livekit.js`、`client/src/livekit/*`
- 方法：Haiku のサブエージェント3体で照合し、マネージャーがまとめた
  - server × docs/04 §2・§3
  - client × docs/01・04・livekit-notes・w3-components.md
  - 規約照合
- 依頼：**A を直し、B は自分で判断できないものを @manager に上げてから完了報告し直すこと**
- 総評：APIシークレットはフロントに出ていない。部品の props は w3-components.md と一致。契約外の API・イベントも無い。全体として良好

---

## A. 直す（裏取り済み）

### A-1. 挙手中のセルの枠色に、画面で使ってはいけない色を使っている
- 場所：`client/src/livekit/livekit.css:81` `.lk-grid__cell--highlight { border-color: var(--color-process-yellow); }`
- 規約：`client/src/styles/broadsheet.css:44-50` のコメントに「process-yellow は印刷用の色。本文やクロムには使わない」とある。先生画面のモック（docs/design/06 の teach.css:101）は `--color-accent`
- 対応案：`var(--color-accent)` にする（先生画面の凡例 swatch も accent になっている）
- ついでに：スポットライト枠（:82）はモックだと `accent-600`、実装は `accent-2`。合わせられるなら合わせる

---

## B. 要確認（@manager 判断）

| # | 場所 | 内容 |
|---|---|---|
| B-1 | `services/livekit.js:45` | 生徒の `canPublishSources` に MICROPHONE が入っている。docs/04 §2 は「自分のカメラ」、livekit-notes は「カメラ・マイク」で、文書同士が食い違っている。マイクを許可するなら、`RoomAudio.jsx:25-32`（先生以外の音声もすべて再生する）と合わせて見直す |
| B-2 | `services/livekit.js:39` | 生徒のトークンが `canSubscribe: true`。購読制御は publisher 側のクライアント（`permissions.js`）だけでやっている。§6 の pending #2 で既知の本番課題だが、§2 の文言「subscribe は先生とスポットライトのみ」と食い違うので、§2 を直すか発表で説明するか |
| B-3 | `services/livekit.js:64-66` | JWT の attributes（role, user_id）が livekit-notes にしか書かれていない |
| B-4 | `services/livekit.js:16,60` | TTL 6h、LiveKit 未設定時は 200 で空の token を返す。どちらも仕様に無い |
| B-5 | `services/livekit.js:44` | 先生用の権限をロール（role）で決めている。「その授業の先生か」（teacher_id）では決めていないので、ずれる場合の扱い |
| B-6 | `useLiveKitRoom.js:99-134` | LiveKit が再接続を諦めると status が disconnected になるだけで、再トークン取得・再接続の経路が無い。映像だけ戻らなくなる |
| B-7 | `StudentCamera.jsx:94-99` | live かどうかを見ずに publish する（W4 側が live のときだけ enabled にする前提）。W4 側の組み込みを確認する |
| B-8 | `useLiveKitRoom.js` | ファイル名が kebab-case ではない（規約は「ファイル名は kebab-case.js」）。`components/learn/useIsMobile.js` も同じなので、フックは例外にするかを決める |
| B-9 | `identity.js:6` | `'user:'` という接頭辞をサーバーとクライアントで別々に持っている（shared に定数が無い） |
| B-10 | `livekit.css` | フォントサイズ・寸法が直書き。色と余白は変数を使っている |

---

## 【裁定】（2026-10-08 manager）
- 前提：`shared/`（`LIVEKIT_IDENTITY_PREFIX`）と docs/04（v4.3）を更新した。**再読込してから着手すること**
- **直す**：A-1（挙手中の枠色を `--color-accent` に）
- **B で直すもの**：
  - B-5：先生用の権限は「その授業のクラスの先生（`classes.teacher_id`）」かどうかで決める。ロールでは決めない
  - B-6：切断されたら、トークンを取り直して再接続する（3回まで）
  - B-1：生徒のマイクの publish は許可のまま。ただし `RoomAudio` は**先生とスポットライト中の生徒の音声だけ**を再生するように直す
  - B-9：identity の接頭辞は shared の `LIVEKIT_IDENTITY_PREFIX` を使う（サーバー・クライアントとも）
  - `TeacherPublisher` に「配信停止」の操作を足す（W5 の画面設計の指摘から）
  - LiveKit が未設定のときは `{token:null, url:null, room_name, identity}` を返す（docs/04 §6 v4.3）
- **仕様側で解決したもの**：
  - B-2：§2 の文言を「publisher 側のトラック購読許可（SFU が強制）＋サーバー発行トークン」に直した
  - B-3・B-4：TTL 6h と未設定時の挙動を §6 に記載した
  - B-8：フックの `useXxx.js` は CLAUDE.md で例外にした
  - B-10：余白は変数に無い値だけ px で書いてよい（色は必ず変数）
