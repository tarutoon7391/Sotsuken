// MySQL 接続プール。DB へのアクセスは必ず server/src/db/ のモジュール経由で行う。
const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

/** 接続プールを返す。DATABASE_URL が未設定なら null（DB無しでも画面確認だけはできるように） */
function getPool() {
  if (pool || !config.databaseUrl) return pool;
  pool = mysql.createPool({
    uri: config.databaseUrl,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: 'Z',          // DATETIME は UTC として読み書きする（表示時だけ日本時間に変換）
    charset: 'utf8mb4',
  });
  // CURRENT_TIMESTAMP なども UTC になるよう、接続ごとにタイムゾーンを固定する
  pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));
  return pool;
}

/** SQL を実行して行を返す。値は必ずプレースホルダ（?）で渡す */
async function query(sql, params = []) {
  const p = getPool();
  if (!p) throw new Error('DATABASE_URL が設定されていません');
  const [rows] = await p.execute(sql, params);
  return rows;
}

/** トランザクション。fn に接続を渡し、例外が出たらロールバックする */
async function transaction(fn) {
  const p = getPool();
  if (!p) throw new Error('DATABASE_URL が設定されていません');
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { getPool, query, transaction };
