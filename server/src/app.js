// Express アプリ本体（REST API と静的ファイル配信）
const fs = require('fs');
const express = require('express');
const path = require('path');
const config = require('./config');
const { sessionMiddleware } = require('./session');
const apiRouter = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Railway は手前にプロキシがあるので、secure クッキーを正しく扱えるようにする
app.set('trust proxy', 1);

app.use(express.json());
app.use(sessionMiddleware);

app.use('/api', apiRouter);
app.use('/api', notFound);

// アップロードされた資料・添付・アイコン（files.url / users.icon_url は /uploads/... を指す）
app.use('/uploads', express.static(config.uploadDir));

// フロント
// - 本番：client/dist（npm run build の出力）を配信し、API 以外のパスは index.html に戻す（react-router 用）
// - 開発：client/dist が無ければ public/ の仮トップだけ出す（画面は Vite の開発サーバー http://localhost:5173 で見る）
if (fs.existsSync(path.join(config.clientDistDir, 'index.html'))) {
  app.use(express.static(config.clientDistDir));
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (req, res) => {
    res.sendFile(path.join(config.clientDistDir, 'index.html'));
  });
} else {
  app.use(express.static(config.publicDir));
}

app.use(errorHandler);

module.exports = app;
