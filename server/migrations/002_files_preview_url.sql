-- 002_files_preview_url.sql — Office 資料のプレビュー（docs/03 files.preview_url、docs/04 v4.4）
-- Word・Excel・PowerPoint の資料を PDF に変換したファイルの配信 URL（/uploads/<乱数名>.pdf）。変換しない・失敗したときは NULL
ALTER TABLE files ADD COLUMN preview_url VARCHAR(255) NULL AFTER url;
