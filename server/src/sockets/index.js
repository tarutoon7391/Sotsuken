// Socket.IO の入口。接続時にセッションからユーザーを確認し、未ログインなら切断する。
// イベントは docs/04_API・イベント仕様.md の「Socket.IO イベント」にあるものだけ実装する。
const { Server } = require('socket.io');

function setupSockets(httpServer, sessionMiddleware) {
  const io = new Server(httpServer);

  // Express と同じセッションを Socket.IO でも使う
  io.engine.use(sessionMiddleware);

  io.use((socket, next) => {
    const session = socket.request.session;
    if (!session || !session.user) return next(new Error('UNAUTHORIZED'));
    socket.data.user = session.user;
    next();
  });

  io.on('connection', (socket) => {
    // TODO（通信基盤担当）：接続時に渡された lesson_id のクラス所属を検証し、
    //   授業ごとのルーム（例：`lesson:${id}`）に参加させる。
    //   出席の記録（present / away）は授業が live の間だけ行う。
    socket.on('disconnect', () => {});
  });

  return io;
}

module.exports = { setupSockets };
