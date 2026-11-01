# 実行サーバー（Piston）のセットアップと運用メモ — F-10 プログラミングモード

> 担当：W3（docs/11 §5 の所有権：`infra/vps/piston/*`・この文書）。manager が 2026-11-01 に初版を書いた。
> **次に読む人へ**：まず「1. 現状」を読む。手順は「3.」から。アプリ側の仕様は docs/04 §7.4。

## 1. 現状（2026-11-01）

- アプリ側（`server/src/services/code-runner.js`）は実装済み・本番デプロイ済み。`/api/health` の `code_runner` で設定有無と死活状態が見える
- **emkc.org の公開 Piston API は 2026-02-15 からホワイトリスト制**になり、使えない（HTTP 401「Public Piston API is now whitelist only」）。docs/11 §6 の「開発は公開 API」の前提は無効
- 2026-10 中旬から Linux カーネルの脆弱性 **CVE-2026-99999（PwnEscape）** 対応で国内 VPS が軒並み新規受付を停止。11/1 時点で新規に借りられるのは **さくらのVPS 石狩リージョン**（ConoHa は停止中・再開未定、さくらの東京は停止中、大阪は Windows と大容量ストレージ付きのみ）
- **決定（トーンさん・2026-11-01）**：さくらのVPS **石狩・1G プラン（仮想 2Core / 1GB / SSD 50GB・月 935 円）・Ubuntu 24.04** を借りて Piston をセルフホストする。足りなくなったらスケールアップ（さくらは後からプラン変更できる。数十分の停止を伴うので授業直前にはしない）
- LiveKit は Railway の攻撃対応で API キーを止めてあり、本番の映像は 401 で止まっている（想定どおり）。復旧は LiveKit Cloud で新キー発行 → Railway の `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` 差し替え。VPS への LiveKit 同居は **2G 以上にしてから**（下の「6.」）

### 1G で動く範囲
| 使い方 | 1G | 2G |
|---|---|---|
| Piston だけ（同時実行 2 本・30 人クラス・発表デモ） | ○ | ○ |
| Piston（同時実行 4 本） | △（スワップ頼み） | ○ |
| Piston ＋ LiveKit 同居・生徒カメラ 10 人程度 | △（javac 実行時に映像が止まりうる） | ○ |
| Piston ＋ LiveKit 同居・30 人クラス本番 | ✕ | ○ |

## 2. アプリ側の設定（Railway の環境変数）

| 変数 | 値 | 備考 |
|---|---|---|
| `CODE_RUNNER_URL` | `http://<VPS の IP>:2000/api/v2` | 末尾に `/execute` は付けない。変更後は Railway を再デプロイ（起動時にしか読まない） |
| `CODE_RUNNER_CONCURRENCY` | `2`（1G のとき）／ 未設定＝4（2G 以上） | 授業ごとの同時実行本数。`CODE_LIMITS.CONCURRENT_RUNS` の上書き |

- アプリは `GET <URL>/runtimes` で死活確認（起動時＋1 分おき）、`POST <URL>/execute` で実行する
- 保存（コンパイルのみ）は `Compile.java`（何もしない main）を先頭、`Main.java` を 2 番目で送る。セルフホストなら docs/04 §7.4 の値（CPU 10 秒・256MB）がそのまま通る。400 が返ると控えめな値（run 3 秒・メモリ指定なし）で 1 回だけ再送する
- 確認は `https://manabiba.up.railway.app/api/health` → `code_runner: { configured: true, available: true }`

## 3. VPS の初期設定（Ubuntu 24.04・root でログイン後）

```bash
# 作業ユーザー（任意）と基本パッケージ
apt update && apt upgrade -y
apt install -y ufw curl git

# スワップ 2GB（1G プランの保険。2G 以上なら 1GB でよい）
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Docker（公式スクリプト）
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

## 4. Piston の起動と Java の導入

```bash
# Piston 本体（--privileged は隔離（isolate / cgroup）に必須）
docker run -d --name piston --restart unless-stopped --privileged \
  -p 2000:2000 \
  -v piston_packages:/piston/packages \
  --cpus=1.5 --memory=900m \
  -e PISTON_RUN_TIMEOUT=10000 \
  -e PISTON_COMPILE_TIMEOUT=10000 \
  -e PISTON_RUN_MEMORY_LIMIT=268435456 \
  -e PISTON_COMPILE_MEMORY_LIMIT=268435456 \
  -e PISTON_OUTPUT_MAX_SIZE=65536 \
  -e PISTON_MAX_PROCESS_COUNT=64 \
  -e PISTON_MAX_CONCURRENT_JOBS=2 \
  -e PISTON_DISABLE_NETWORKING=true \
  ghcr.io/engineer-man/piston

# 起動確認（空の配列が返れば OK）
curl -s http://localhost:2000/api/v2/runtimes

# Java を入れる（公開パッケージ一覧から java の最新を選ぶ。2026-11 時点は 15.0.2）
curl -s http://localhost:2000/api/v2/packages | tr '{' '\n' | grep -i '"java"'
curl -s -X POST http://localhost:2000/api/v2/packages \
  -H 'Content-Type: application/json' -d '{"language":"java","version":"15.0.2"}'

# runtimes に java が出れば完了
curl -s http://localhost:2000/api/v2/runtimes
```

- 値の対応：`PISTON_RUN_TIMEOUT` / `PISTON_COMPILE_TIMEOUT` ＝ `CODE_LIMITS.CPU_TIMEOUT_MS`（10 秒）、`*_MEMORY_LIMIT` ＝ `CODE_LIMITS.MEMORY_MB`（256MB・バイト指定）、`PISTON_OUTPUT_MAX_SIZE` ＝ `CODE_LIMITS.OUTPUT_MAX_BYTES`（64KB）、`PISTON_MAX_CONCURRENT_JOBS` ＝ アプリの `CODE_RUNNER_CONCURRENCY` と同じ値
- `--cpus=1.5 --memory=900m` は LiveKit を同居させたときに映像を止めないための上限。Piston だけなら外してよい（1G では `--memory=700m` 程度に）
- `PISTON_DISABLE_NETWORKING=true` が**生徒コードからのネットワーク遮断**（docs/01 F-10 の非機能要件）。外さない

### 動作確認（VPS 上で）

```bash
curl -s -X POST http://localhost:2000/api/v2/execute -H 'Content-Type: application/json' -d '{
  "language":"java","version":"*",
  "files":[{"name":"Main.java","content":"public class Main { public static void main(String[] a) { System.out.println(\"Hello\"); } }"}],
  "run_timeout":10000,"compile_timeout":10000
}'
# → "run":{"stdout":"Hello\n","code":0,...}

# 保存＝コンパイルのみ の方式（Compile.java を先頭）。run.stdout が空（Hello が出ない）ならアプリの前提どおり
curl -s -X POST http://localhost:2000/api/v2/execute -H 'Content-Type: application/json' -d '{
  "language":"java","version":"*",
  "files":[{"name":"Compile.java","content":"public class Compile { public static void main(String[] a) { } }"},
           {"name":"Main.java","content":"public class Main { public static void main(String[] a) { System.out.println(\"Hello\"); } }"}]
}'
```

## 5. ファイアウォール（ポート 2000 を Railway からだけ通す）

Piston には認証が無いので、**2000 番を全世界に開けない**。

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
# Railway の送信元 IP は固定でない（Static Outbound IPs は有料プランの機能）。
# 当面は VPS 側で Piston の前に Basic 認証付きの nginx を置くか、Tailscale / WireGuard で繋ぐのが安全。
# 最低限の暫定策：2000 番を開けずに、まず SSH トンネルで Railway 以外から叩けないことを確認してから検討する。
ufw enable
```

**未決（トーンさん判断）**：Railway → VPS の経路の守り方。候補は
1. nginx をリバースプロキシにして Basic 認証（`CODE_RUNNER_URL` に `http://user:pass@<IP>/api/v2` を入れる。アプリ側は fetch が URL の認証情報を扱えないので、`Authorization` ヘッダーを足す小改修が要る）
2. Railway の Static Outbound IPs（Pro プラン）で IP 制限
3. Tailscale で VPS と Railway を同じネットに入れる（Railway 側に tailscale サイドカーが要る）

発表までは **1** が現実的。実装は W2（`code-runner.js` に `CODE_RUNNER_AUTH`（`user:pass`）を読んで `Authorization: Basic` を付ける 5 行）＋ W3（nginx 設定）。

## 6. LiveKit を同居させるとき（2G 以上にしてから）

- 先に `docs/livekit-notes.md` を読む。必要なポート：443（TLS）・7881（TCP）・50000〜60000/UDP、TURN を使うなら 3478/UDP・5349/TCP
- ドメインと TLS 証明書（Let's Encrypt）が要る。IP 直打ちでは WebRTC が動かない
- Piston と CPU を取り合うので、Piston 側に `--cpus` 上限を付けたままにする

## 7. 手順の記録欄（やった日付と結果を追記していく）

| 日付 | やったこと | 結果 |
|---|---|---|
| 2026-11-01 | 公開 Piston API が 401（ホワイトリスト制）と判明。さくら石狩 1G に決定 | VPS 申し込み待ち |
