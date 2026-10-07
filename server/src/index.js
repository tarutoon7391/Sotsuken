// サーバーの起動口：HTTP（Express）と WebSocket（Socket.IO）を同じポートで動かす
const http = require('http');
const config = require('./config');
const app = require('./app');
const { sessionMiddleware } = require('./session');
const { setupSockets } = require('./sockets');

const server = http.createServer(app);
setupSockets(server, sessionMiddleware);

// TODO（クラス・出席担当）：server/src/jobs/ に出席タイマー（1分間隔）を足したら、ここで開始する

server.listen(config.port, () => {
  console.log(`サーバー起動: http://localhost:${config.port}`);
});
