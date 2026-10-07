// Socket.IO の入口。
// 1. セッションからユーザーを確認（未ログインは切断）
// 2. 接続時の auth.lesson_id を検証（授業の存在・クラス所属。不正なら切断）
// 3. 授業ルーム（全員／先生／生徒）に join
// 4. sockets/handlers/*.js を自動で読み込み、各イベントハンドラを登録する
//
// 出席の記録（接続で present、切断で away。live 中のみ）はフェーズ0では行わない。
// → handlers/attendance.js（出席担当）が connection / disconnect を処理する。
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { ROLES, roomNames } = require('@sotsuken/shared/constants');
const { CONNECT_AUTH } = require('@sotsuken/shared/socket-events');
const { getLessonAccess } = require('../services/access');
const { setIo } = require('./io');

const HANDLERS_DIR = path.join(__dirname, 'handlers');

/** handlers/ 配下の .js を全部読み込む（各ファイルは function (io, socket) を export する） */
function loadHandlers() {
  if (!fs.existsSync(HANDLERS_DIR)) return [];
  return fs
    .readdirSync(HANDLERS_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => {
      const mod = require(path.join(HANDLERS_DIR, f));
      const register = typeof mod === 'function' ? mod : mod.register;
      if (typeof register !== 'function') {
        throw new Error(`sockets/handlers/${f} は function (io, socket) を export してください`);
      }
      return { name: f, register };
    });
}

function setupSockets(httpServer, sessionMiddleware) {
  const io = new Server(httpServer);
  setIo(io);
  const handlers = loadHandlers();

  // Express と同じセッションを Socket.IO でも使う
  io.engine.use(sessionMiddleware);

  io.use(async (socket, next) => {
    try {
      const session = socket.request.session;
      if (!session || !session.user) return next(new Error('UNAUTHORIZED'));

      const lessonId = Number(socket.handshake.auth && socket.handshake.auth[CONNECT_AUTH.LESSON_ID]);
      if (!Number.isInteger(lessonId) || lessonId <= 0) return next(new Error('BAD_REQUEST'));

      const access = await getLessonAccess(session.user, lessonId);
      if (!access.lesson) return next(new Error('NOT_FOUND'));
      if (!access.isTeacher && !access.isMember) return next(new Error('FORBIDDEN'));

      // ハンドラが使う情報を socket.data にまとめる
      socket.data.user = session.user;                 // { id, name, role }
      socket.data.role = access.isTeacher ? ROLES.TEACHER : ROLES.STUDENT;
      socket.data.lessonId = lessonId;
      socket.data.lesson = access.lesson;              // 接続時点のスナップショット（status 等）
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    const { lessonId, role } = socket.data;
    socket.join(roomNames.lesson(lessonId));
    socket.join(role === ROLES.TEACHER ? roomNames.teachers(lessonId) : roomNames.students(lessonId));

    for (const h of handlers) h.register(io, socket);
  });

  return io;
}

module.exports = { setupSockets };
