# livekit — LiveKit のクライアント部品（担当：W3）

| ファイル | 内容 |
|---|---|
| `useLiveKitRoom.js` | トークン取得（POST /api/lessons/:id/token）→ 接続 → 切断の hook |
| `TeacherPublisher.jsx` | 先生：画面キャプチャ／カメラ切替して publish |
| `StudentCamera.jsx` | 生徒：カメラ ON/OFF。publish 時に購読許可を先生のみに設定、`spotlight:update` で全員に広げる |
| `RemoteVideo.jsx` | 特定参加者のトラックを `<video>` に表示 |
| `StudentGrid.jsx` | 先生用：全生徒の映像を低画質でグリッド表示 |

- pages/ は触らない。部品を export するだけで、組み込みは W4（生徒）／W5（先生）が行う
- props の定義は `docs/requests/w3-components.md` に書き、確定したら @w4-learn と @w5-teach に送る
- `LIVEKIT_URL` が未設定の環境（token API の `url` が空）では「未設定」表示にしてクラッシュしない
- 購読制御の仕組みは `docs/livekit-notes.md` に書く
