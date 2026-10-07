# pending — トーンさんの判断待ち（manager が記録）

| # | 発信 | 内容 | 選択肢 | 判断 |
|---|---|---|---|---|
| 1 | w3-livekit | `ended` の授業に対するトークン発行・spotlight 変更を拒否するか未規定。現状は拒否していない | A) 拒否しない（現状）／B) 409 等で拒否（04 に追記） | **A（現状のまま）** トーンさん 15:30 |
| 2 | w3-livekit | 生徒映像の購読制御は publisher 側クライアントの設定。改造クライアントで漏れるのは自分の映像のみ。サーバー強制（LiveKit RoomServiceClient）にするなら API/設計の追加が要る | A) MVP は現状のまま、本番課題として記録／B) 設計追加 | **A（現状のまま・本番課題）** トーンさん 15:30 |
| 3 | w2-live | 確認ボタン自動発動の `interval_min` を保存するカラムが無く、サーバーのメモリに持っている（再起動で消える） | A) MVP はメモリのまま／B) `lessons.attention_interval_min` を足す（マイグレーション＋docs/03 更新） | |
| 4 | w2-live | 先生が absent→present に手動修正しても `away_total_sec` はそのまま。次に退出するとすぐ欠課になる | A) そのまま（累積は事実として残す）／B) 手動で present にしたら累積を 0 にリセット／C) PATCH に `away_total_sec` を含めて先生が指定 | |
