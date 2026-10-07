// マイグレーション実行：server/migrations/ の .sql を名前順に、未適用のものだけ流す。
// 使い方：npm run migrate（npm start の前にも自動で実行される）
// スキーマ変更は必ず新しい番号の .sql を足して行う（適用済みのファイルは書き換えない）。
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function main() {
  if (!config.databaseUrl) {
    // npm start の前（prestart）にも呼ばれるので、DB 未設定のときは止めずにスキップする
    console.warn('DATABASE_URL が未設定のため、マイグレーションをスキップします');
    return;
  }
  const conn = await mysql.createConnection({
    uri: config.databaseUrl,
    multipleStatements: true,   // 1ファイルに複数の文を書けるようにする（マイグレーション専用）
    timezone: 'Z',
    charset: 'utf8mb4',
  });
  try {
    await conn.query("SET time_zone = '+00:00'");
    await conn.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name VARCHAR(255) NOT NULL PRIMARY KEY,
         applied_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP())
       ) DEFAULT CHARSET = utf8mb4`
    );
    const [rows] = await conn.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`適用中: ${file}`);
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      count += 1;
    }
    console.log(count ? `${count} 件のマイグレーションを適用しました` : '未適用のマイグレーションはありません');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('マイグレーションに失敗しました:', err.message);
  process.exit(1);
});
