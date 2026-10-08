# LiveKit 基盤メモ（担当：W3）

## 構成

| 場所 | 役割 |
|---|---|
| `server/src/services/livekit.js` | トークン発行（`livekit-server-sdk` の `AccessToken`）、スポットライト更新＋`spotlight:update` 送信 |
| `server/src/routes/token.js` | `POST /api/lessons/:id/token`、`PUT /api/lessons/:id/spotlight` |
| `client/src/livekit/` | 接続 hook と表示部品。props は `docs/requests/w3-components.md` |

- APIキー・シークレットは `.env`（`LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`）だけに置く。フロントに渡すのは JWT と URL のみ
- 未設定のときは token API が `{ token:null, url:null, room_name, identity }`（200）を返し、クライアントは `status='unconfigured'`（「配信サーバーが未設定です」）で止まる
- トークンの有効期限は 6時間
- identity は `LIVEKIT_IDENTITY_PREFIX + id`（`"user:{id}"`。shared/constants）、表示名は `users.name`、属性 `attributes.role`（`teacher`/`student`）と `attributes.user_id` をサーバーが入れる。**role はその授業のクラスの先生（`classes.teacher_id`）かどうかで決める**（`users.role` では決めない）。`canUpdateOwnMetadata=false` なので本人は書き換えられない
- ルーム名は `lessons.room_name`（授業と1対1）

## 生徒映像の購読制御（「生徒の映像は先生にだけ届く」）

LiveKit は2段で制御できる。

1. **トークン（サーバー発行）**：その人が「何を publish できるか／subscribe できるか」
2. **トラック購読許可（publisher 側の `setTrackSubscriptionPermissions`）**：自分のトラックを「誰が購読してよいか」。**SFU が判定**し、許可されていない participant にはトラックそのものを配らない

| | 先生 | 生徒 |
|---|---|---|
| トークン | publish 可（カメラ・マイク・画面共有）、subscribe 可 | publish はカメラ・マイクのみ（`canPublishSources`）、subscribe 可 |
| 自分のトラックの購読許可 | 既定（全員可）＝全生徒が先生を見られる | 接続直後：誰にも許可しない（`useLiveKitRoom` が `denyAll`）→ `StudentCamera`：先生の identity だけ許可 → スポットライト中の本人：全員に許可 |

- 生徒 A のトークンで生徒 B の映像を購読しようとしても、B 側の許可に A が無いので SFU が配らない（フロントの表示制御ではない）。04 §5「生徒のトークンで他生徒の映像が購読できないこと／スポットライト指定後は購読できること」はこれで満たす
- スポットライトの流れ：先生が `PUT /spotlight` → サーバーが `lessons.spotlight_user_id` 更新＋`spotlight:update` を全員に → 指定された生徒の `StudentCamera` が `spotlightUserId === myUserId` を検知して全員に許可 → 他の生徒は自動購読（autoSubscribe）され `RemoteVideo` に映る。解除で先生のみに戻り、他の生徒の購読は SFU が外す
- 再接続（`RoomEvent.Reconnected`）後は許可を設定し直す
- LiveKit 自身の再接続で戻れず切断されたら、`useLiveKitRoom` がトークンを取り直して新しい Room で入り直す（最大3回、1秒・2秒・4秒待つ）。自分で抜けた・同じ人が別タブで入った・追い出された・ルームが消えた場合は入り直さない。新しい Room では `StudentCamera` がカメラを取り直して publish し、購読許可も最初から設定する

## 音声

- 生徒もマイクを publish できる（トークンで許可）。ただし `RoomAudio` が鳴らすのは**先生とスポットライト中の生徒の音声だけ**（先生画面でも同じ）
- 生徒のマイクのトラックもカメラと同じ購読許可がかかるので、他の生徒には SFU から届かない

### この方式の限界（発表で聞かれたら）

- 許可を設定するのは**その生徒自身のクライアント**。改造したクライアントで自分の許可を「全員」にすることはできるが、それで漏れるのは**自分の映像だけ**。他人の映像を見る手段にはならない（他人の許可は他人のクライアントが持つ）
- さらに固くするなら、サーバーから `RoomServiceClient.updateSubscriptions` / `updateParticipant` で購読を強制する方法がある（API 追加が要るので MVP では採用しない）

## 帯域

- 生徒カメラ：320×240・15fps・最大 300kbps、simulcast 無し（`StudentCamera`）。30人で先生側受信 約 9Mbps（docs/02 の想定）
- 受信側は `adaptiveStream`（表示サイズに合わせて受信画質を下げる）、送信側は `dynacast`（誰も見ていない画質を止める）

## 本番 VPS（LiveKit OSS）への移行

- コードの変更は無し。`.env` の `LIVEKIT_URL`（`wss://<VPSのドメイン>`）・`LIVEKIT_API_KEY`・`LIVEKIT_API_SECRET` を VPS の `livekit.yaml` の `keys` に合わせて差し替えるだけ
- VPS 側で必要なもの：TLS（wss）、UDP ポート（既定 50000-60000）と 7881/TCP の開放、TURN（学校ネットワーク向け）。LiveKit Cloud と同じ SDK・同じトークン形式

## 動作確認（キー取得後）

1. `.env` に LiveKit Cloud のキーを設定して `npm run dev` ／ `npm run dev:client`
2. 先生・生徒A・生徒B の3ブラウザ（別プロファイル）でログインして同じ授業に入る
3. 先生のカメラ／画面共有が A・B に映る。A・B のカメラは先生のグリッドにだけ映り、A の画面に B は映らない
4. 先生が A をスポットライト → B の画面に A が映る。解除で消える
