// Socket.IO 接続のラッパー。授業画面（teach / learn / waiting）はここから接続する。
// 接続時に auth.lesson_id を渡す（サーバーが所属を検証し、不正なら connect_error）。
// イベント名は必ず @sotsuken/shared/socket-events から取る。
import { io } from 'socket.io-client';
import { CONNECT_AUTH } from '@sotsuken/shared/socket-events';

let socket = null;
let currentLessonId = null;

/**
 * 授業に接続する（同じ授業なら既存の接続を返す）
 * @param {number|string} lessonId
 * @returns {import('socket.io-client').Socket}
 */
export function connectLesson(lessonId) {
  const id = Number(lessonId);
  if (socket && currentLessonId === id) return socket;
  disconnectLesson();

  socket = io('/', {
    auth: { [CONNECT_AUTH.LESSON_ID]: id },
    withCredentials: true,
    // 再接続は socket.io の既定（指数バックオフ）に任せる。切断中は出席が away になる
  });
  currentLessonId = id;

  socket.on('connect_error', (err) => {
    // UNAUTHORIZED / FORBIDDEN / NOT_FOUND / BAD_REQUEST（sockets/index.js が投げる）
    console.warn('Socket 接続エラー:', err.message);
  });

  return socket;
}

/** 現在の接続（未接続なら null） */
export function getSocket() {
  return socket;
}

/** 授業から抜けるときに呼ぶ（画面のアンマウント時など） */
export function disconnectLesson() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
  currentLessonId = null;
}
