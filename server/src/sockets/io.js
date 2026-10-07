// Socket.IO サーバー（io）の置き場。REST のサービス層やジョブから Socket 送信したいときはここを使う。
// 例：const { emitToTeachers } = require('../sockets/io');
//     emitToTeachers(lessonId, SERVER_EVENTS.ATTENDANCE_UPDATE, { user_id, status, away_total_sec });
//
// ルームの割り当ては sockets/index.js（接続時に lesson / teacher / student の3ルームに入る）。
const { roomNames } = require('@sotsuken/shared/constants');

let io = null;

/** sockets/index.js が起動時に1回だけ呼ぶ */
function setIo(instance) {
  io = instance;
}

/** io 本体。未初期化（テスト時など）は null */
function getIo() {
  return io;
}

/** 授業の全員に送る */
function emitToLesson(lessonId, event, payload) {
  if (io) io.to(roomNames.lesson(lessonId)).emit(event, payload);
}

/** 授業の先生だけに送る */
function emitToTeachers(lessonId, event, payload) {
  if (io) io.to(roomNames.teachers(lessonId)).emit(event, payload);
}

/** 授業の生徒だけに送る */
function emitToStudents(lessonId, event, payload) {
  if (io) io.to(roomNames.students(lessonId)).emit(event, payload);
}

module.exports = { setIo, getIo, emitToLesson, emitToTeachers, emitToStudents };
