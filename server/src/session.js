// ログインセッション。Express と Socket.IO の両方で同じものを使う。
// 保存先は MySQL（sessions テーブルは自動作成）。DB 未設定のときだけメモリ保存（開発用）。
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const config = require('./config');
const { getPool } = require('./db/pool');

function createStore() {
  const pool = getPool();
  if (!pool) {
    console.warn('DATABASE_URL 未設定のため、セッションはメモリに保存します（再起動で消えます）');
    return undefined;
  }
  return new MySQLStore({ clearExpired: true, createDatabaseTable: true }, pool);
}

const sessionMiddleware = session({
  name: 'sid',
  secret: config.sessionSecret,
  store: createStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,          // 本番（HTTPS）では secure クッキーにする
    maxAge: 1000 * 60 * 60 * 24 * 7,      // 7日
  },
});

module.exports = { sessionMiddleware };
