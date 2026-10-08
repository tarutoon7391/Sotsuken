// Office 資料（Word・Excel・PowerPoint）を PDF に変換する（docs/04 §2「資料・添付」v4.4）— 担当：W1
// LibreOffice（headless）を execFile で直接起動する。シェルは経由せず、引数にユーザー入力（元のファイル名）を入れない
// LibreOffice は同時起動に弱いので、変換は1本ずつ直列に実行する（キュー）
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const config = require('../config');

/** 変換の対象にする MIME（ALLOWED_UPLOAD_MIMES のうち Office 系の6種） */
const OFFICE_MIMES = Object.freeze([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const CONVERT_TIMEOUT_MS = 60 * 1000;

// 直前の変換が終わってから次を始めるための鎖（失敗しても鎖は切らない）
let queue = Promise.resolve();

function isOfficeMime(mime) {
  return OFFICE_MIMES.includes(mime);
}

/** execFile を Promise にしたもの（タイムアウト付き） */
function runSoffice(args) {
  return new Promise((resolve, reject) => {
    execFile(
      config.sofficePath,
      args,
      { timeout: CONVERT_TIMEOUT_MS, killSignal: 'SIGKILL', windowsHide: true },
      (err) => (err ? reject(err) : resolve())
    );
  });
}

/**
 * 1ファイルを変換して uploadDir/<乱数>.pdf に置く
 * @param {string} srcPath  multer が保存したファイルのパス（ファイル名はサーバーが付けた乱数）
 * @returns {Promise<string>} 保存した PDF のファイル名
 */
async function convertOne(srcPath) {
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'office-convert-'));
  try {
    await runSoffice([
      // 変換専用のプロファイルを作業ディレクトリに作る（他の LibreOffice と設定ファイルを取り合わない）
      `-env:UserInstallation=${pathToFileURL(path.join(workDir, 'profile')).href}`,
      '--headless',
      '--norestore',
      '--nolockcheck',
      '--convert-to',
      'pdf',
      '--outdir',
      workDir,
      srcPath,
    ]);
    const outPath = path.join(workDir, `${path.parse(srcPath).name}.pdf`);
    await fs.promises.access(outPath); // 終了コード 0 でも出力が無いことがある
    const pdfName = `${crypto.randomBytes(16).toString('hex')}.pdf`;
    // 一時ディレクトリと uploadDir（Volume）は別のディスクのことがあるので rename ではなくコピー
    await fs.promises.copyFile(outPath, path.join(config.uploadDir, pdfName));
    return pdfName;
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
}

/**
 * Office 資料を PDF に変換する。失敗・タイムアウト・soffice が無いときは null（理由はログに残す）
 * @param {string} srcPath
 * @returns {Promise<string|null>} 保存した PDF のファイル名
 */
function convertToPdf(srcPath) {
  const job = queue.then(() => convertOne(srcPath)).catch((err) => {
    const reason = err.code === 'ENOENT' ? `soffice が見つかりません（SOFFICE_PATH=${config.sofficePath}）`
      : err.killed ? `${CONVERT_TIMEOUT_MS / 1000} 秒でタイムアウトしました`
        : err.message;
    console.error(`Office 資料の PDF 変換に失敗しました：${reason}`);
    return null;
  });
  queue = job;
  return job;
}

module.exports = { OFFICE_MIMES, isOfficeMime, convertToPdf };
