// Express アプリ本体（REST API と静的ファイル配信）
const express = require('express');
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

// フロント（ビルド不要の素の HTML/CSS/JS）
app.use(express.static(config.publicDir));

app.use(errorHandler);

module.exports = app;
