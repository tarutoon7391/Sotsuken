// 出席の自動記録（接続で present、切断で away）— 担当：W2
// 授業が live のときだけ記録する（判定は services/attendance.js が毎回 DB の status を見る）。
// 同じ生徒が複数タブで接続している場合は、最後の1本が切れたときだけ away にする。
const { ROLES, roomNames } = require('@sotsuken/shared/constants');
const attendance = require('../../services/attendance');

module.exports = function register(io, socket) {
  const { user, role, lessonId } = socket.data;
  if (role !== ROLES.STUDENT) return;

  attendance.markJoined(lessonId, user.id).catch((err) => {
    console.error('出席（入室）の記録に失敗:', err);
  });

  socket.on('disconnect', async () => {
    try {
      // disconnect の時点でこのソケットはルームから抜けているので、残りの接続だけが見える
      const others = await io.in(roomNames.students(lessonId)).fetchSockets();
      if (others.some((s) => s.data.user && s.data.user.id === user.id)) return;
      await attendance.markDisconnected(lessonId, user.id);
    } catch (err) {
      console.error('出席（退出）の記録に失敗:', err);
    }
  });
};
