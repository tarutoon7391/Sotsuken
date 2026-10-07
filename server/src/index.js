// サーバーの起動口：HTTP（Express）と WebSocket（Socket.IO）を同じポートで動かす
const http = require('http');
const config = require('./config');
const app = require('./app');
const { sessionMiddleware } = require('./session');
const { setupSockets } = require('./sockets');
const { startJobs } = require('./jobs');

const server = http.createServer(app);
setupSockets(server, sessionMiddleware);

// 定期ジョブ（jobs/ 配下を自動読込。出席タイマーなど）
startJobs();

server.listen(config.port, () => {
  console.log(`サーバー起動: http://localhost:${config.port}`);
});
