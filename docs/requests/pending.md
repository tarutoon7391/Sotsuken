# pending — トーンさんの判断待ち（manager が記録）

| # | 発信 | 内容 | 選択肢 | 判断 |
|---|---|---|---|---|
| 1 | w3-livekit | `ended` の授業に対するトークン発行・spotlight 変更を拒否するか未規定。現状は拒否していない | A) 拒否しない（現状）／B) 409 等で拒否（04 に追記） | **A（現状のまま）** トーンさん 15:30 |
| 2 | w3-livekit | 生徒映像の購読制御は publisher 側クライアントの設定。改造クライアントで漏れるのは自分の映像のみ。サーバー強制（LiveKit RoomServiceClient）にするなら API/設計の追加が要る | A) MVP は現状のまま、本番課題として記録／B) 設計追加 | **A（現状のまま・本番課題）** トーンさん 15:30 |
| 3 | w2-live | 確認ボタン自動発動の `interval_min` を保存するカラムが無く、サーバーのメモリに持っている（再起動で消える） | A) MVP はメモリのまま／B) `lessons.attention_interval_min` を足す（マイグレーション＋docs/03 更新） | **A（メモリのまま）** トーンさん 15:50 |
| 4 | w2-live | 先生が absent→present に手動修正しても `away_total_sec` はそのまま。次に退出するとすぐ欠課になる | A) そのまま（累積は事実として残す）／B) 手動で present にしたら累積を 0 にリセット／C) PATCH に `away_total_sec` を含めて先生が指定 | **B（手動で present にしたら累積を 0 に）** トーンさん 15:50 → W2 に修正依頼 |
| 5 | w4-learn | 挙手の取り下げイベントが無い（生徒は自分の表示を戻すだけで先生の一覧には残る） | A) MVP は無し（先生が回答済みにする）／B) `question:lower` を追加 | **A（MVP は無し）** トーンさん 16:00 |
| 6 | w4-learn | 資料の追加・削除を知らせるイベントが無い（資料パネルに「更新」ボタンで対応） | A) MVP は更新ボタンのまま／B) `material:update` 等を追加 | **A（更新ボタンのまま）** トーンさん 16:00 |
| 7 | w5-teach | 授業内の確認ボタン一覧 API が無く、授業結果の応答率を出せない（「—」表示） | A) MVP は「—」のまま／B) `GET /lessons/:id/attention` を追加（checks と応答数） | |
| 8 | w5-teach | 自動確認間隔の現在値を取る API が無い（PATCH のみ） | A) MVP は画面側の値だけ／B) `GET /lessons/:id` に `attention_interval_min` を含める（メモリ値） | |
| 9 | w5-teach | `understanding_reset_at` が `GET /lessons/:id` に無い（再読込時にリセット時刻が分からない） | A) 不要／B) LessonDetail に追加（W1 1行） | |
| 10 | w5-teach | `GET /classes/:id/members` が先生専用なので、生徒向けクラス詳細でメンバー一覧を出せない | A) 生徒は非表示のまま／B) members を全員に開放（04 のロール変更） | |
