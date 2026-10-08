# Office 資料のプレビュー（v4.4・2026-10-08）
- 依頼元：manager（トーンさんの要望）
- 依頼先：w1-core（サーバー・デプロイ設定）、w4-learn（資料パネル）
- ねらい：「別タブを開かずに資料が見られる」がアプリの売り。Word・Excel・PowerPoint も資料タブの中で見られるようにする
- 契約：docs/04 §2「資料・添付」の v4.4 注記、docs/03 の `files.preview_url`、`shared/api-types.js` の `FileInfo.preview_url`。**まずこれを読むこと**

## 方式（決定済み）
アップロード時に、サーバーが LibreOffice（headless）で PDF に変換する。変換した PDF は W4 の PdfViewer（pdf.js）でそのまま表示する。
- 外部のビューア（Microsoft Office Online など）は使わない。資料を学外に出さないため
- どの資料にも、元ファイルのダウンロードボタンを付ける

---

## @w1-core
1. **マイグレーション** `server/migrations/002_files_preview_url.sql`
   - `ALTER TABLE files ADD COLUMN preview_url VARCHAR(255) NULL AFTER url;`
   - docs/03 は manager が更新済み
2. **変換処理**（`server/src/services/files.js`。必要なら変換だけ `server/src/services/office-convert.js` に分ける）
   - 対象：`kind=material` かつ Office 系の MIME（`ALLOWED_UPLOAD_MIMES` のうち msword・wordprocessingml・ms-excel・spreadsheetml・ms-powerpoint・presentationml の6種）
   - `soffice --headless --convert-to pdf --outdir <作業用の一時ディレクトリ> <保存したファイル>` を `child_process.execFile` で実行する
     - シェルは経由しない（`exec` ではなく `execFile`）。引数にユーザー入力（元のファイル名）を入れない
   - 出力を `uploadDir/<乱数>.pdf` に移し、`preview_url = /uploads/<乱数>.pdf` を INSERT する
   - 上限 60 秒でタイムアウトさせる。同時に動かす変換は 1 本まで（キューで直列にする。LibreOffice は同時起動に弱い）
   - 失敗・タイムアウト・soffice が見つからないときは、`preview_url = null` で登録してアップロードは成功させる。サーバーのログ（console.error）に理由を残す
   - soffice のパスは `config` で環境変数 `SOFFICE_PATH` から読む（既定 `soffice`）。`.env.example` にも追記する
3. **レスポンス・イベント**
   - POST の応答を `{file_id, url, preview_url}` にする
   - `toFileInfo` に `preview_url` を足す。GET 一覧と `material:added` の `file` に入る
4. **削除**：`DELETE /api/files/:id` で、`preview_url` の実体も `removeUploadedFile` で消す
5. **デプロイ設定（Railway）**：リポジトリ直下に `Dockerfile` を作る
   - Node 20 系（`engines` は >=20.19）
   - `libreoffice-writer`・`libreoffice-calc`・`libreoffice-impress`（`--no-install-recommends`）と、日本語フォント `fonts-noto-cjk` を入れる。**フォントが無いと日本語が豆腐（□）になる**
   - `npm ci` → `npm run build` → `npm start`。今の Railway の挙動（prestart で migrate）を変えない
   - `railway.json` の healthcheck はそのまま使う
6. **確認**：ローカルに LibreOffice が無い環境では、`preview_url` が null になってアップロードが成功することを確認する。soffice がある環境では、pptx・docx・xlsx が PDF になることを確認する（日本語の資料で）
7. スモークテストに「Office 資料のアップロードで preview_url が返る（または null で成功する）」を足す

## @w4-learn
1. `components/learn/MaterialPanel.jsx`：
   - `preview_url` があれば、`PdfViewer` に `preview_url` を渡して表示する（総ページ数・1/2/4 ページ同時表示・スワイプ・拡大がそのまま使える）
   - `preview_url` が無い Office 資料は、今のダウンロード案内のままにする。文言は「この資料はプレビューできません」＋ダウンロードボタン
   - **どの資料（PDF・画像・Office）にも、元ファイルのダウンロードボタンを付ける**。資料名の横など、ビューアの外に置く。`download={file_name}` と `safeUrl(url)` を使う
   - `preview_url` も `safeUrl` を通す
2. `material:added` で届いた `file.preview_url` も同じ扱いにする
3. 確認：build が通ること。preview_url があるときに PDF として表示されること、無いときにダウンロード案内が出ること

## @w5-teach（任意・依頼はしない）
- 先生画面・クラス詳細・授業結果の資料一覧は、ダウンロードリンクのままでよい。先生が変換結果を確認したくなったら、別途相談する
