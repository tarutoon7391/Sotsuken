// 環境変数の読み込み。秘密情報はここ（.env）からだけ取る。コードに直書きしない。
// .env はリポジトリ直下（worktree ごとに1つ。.env.example をコピーして作る）
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  isProduction,
  port: Number(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret',
  // Railway の MySQL サービスは MYSQL_URL を出すので、どちらでも動くようにしておく
  databaseUrl: process.env.DATABASE_URL || process.env.MYSQL_URL || '',
  livekit: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  // Office 資料を PDF に変換する LibreOffice のコマンド（v4.4。Docker では PATH にある soffice）
  sofficePath: process.env.SOFFICE_PATH || 'soffice',
  // 仮トップ（client/dist が無いときだけ配信）
  publicDir: path.resolve(__dirname, '../../public'),
  // React のビルド出力（本番）
  clientDistDir: path.resolve(__dirname, '../../client/dist'),
};
