// 環境変数の読み込み。秘密情報はここ（.env）からだけ取る。コードに直書きしない。
require('dotenv').config();

const path = require('path');

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
  publicDir: path.resolve(__dirname, '../../public'),
};
