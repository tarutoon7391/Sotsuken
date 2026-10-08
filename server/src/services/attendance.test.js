// 出席（累積方式）のテスト — 担当：W2
// - computeRemainingSec は DB 無しで動く
// - DB を使うケースは MYSQL_URL / DATABASE_URL が無ければ skip。テストデータは w2_ 接頭辞で作り、最後に消す

const config = require('../config');
const { getPool, query } = require('../db/pool');
const attendance = require('./attendance');

describe('computeRemainingSec（閾値 − 累積 − 現在の経過）', () => {
  const now = new Date('2026-10-07T03:00:00Z');

  test('退出していなければ 閾値 − 累積', () => {
    expect(attendance.computeRemainingSec({ timeoutMin: 15, awayTotalSec: 300, awaySince: null, now })).toBe(600);
  });

  test('退出中は現在の経過も引く', () => {
    const awaySince = new Date(now.getTime() - 120 * 1000);
    expect(attendance.computeRemainingSec({ timeoutMin: 15, awayTotalSec: 300, awaySince, now })).toBe(480);
  });

  test('0 未満にはしない', () => {
    const awaySince = new Date(now.getTime() - 3600 * 1000);
    expect(attendance.computeRemainingSec({ timeoutMin: 15, awayTotalSec: 0, awaySince, now })).toBe(0);
  });
});

const describeDb = config.databaseUrl ? describe : describe.skip;

// Railway の MySQL はリモートで往復が遅いので、既定の 5 秒では足りない
jest.setTimeout(60 * 1000);

describeDb('出席の判定SQL（DB）', () => {
  const tag = `w2_${Date.now().toString(36)}`;
  let teacherId;
  let studentIds;
  let classId;
  let lessonId;
  let access;

  async function insertUser(suffix, role) {
    const r = await query(
      'INSERT INTO users (name, login_id, password_hash, role) VALUES (?, ?, ?, ?)',
      [`${tag}_${suffix}`.slice(0, 30), `${tag}_${suffix}`, 'x', role]
    );
    return r.insertId;
  }

  /** away_since を「sec 秒前」にずらして、時間の経過を再現する */
  async function setAway(userId, awayTotalSec, secAgo) {
    await query(
      `INSERT INTO attendance (lesson_id, user_id, status, joined_at, away_since, away_total_sec)
       VALUES (?, ?, 'away', UTC_TIMESTAMP(), DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? SECOND), ?)
       ON DUPLICATE KEY UPDATE status = 'away',
         away_since = DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? SECOND), away_total_sec = ?`,
      [lessonId, userId, secAgo, awayTotalSec, secAgo, awayTotalSec]
    );
  }

  async function row(userId) {
    const rows = await query('SELECT * FROM attendance WHERE lesson_id = ? AND user_id = ?', [lessonId, userId]);
    return rows[0] || null;
  }

  beforeAll(async () => {
    teacherId = await insertUser('t', 'teacher');
    studentIds = [];
    for (let i = 0; i < 4; i += 1) studentIds.push(await insertUser(`s${i}`, 'student'));
    const c = await query('INSERT INTO classes (teacher_id, name, join_code) VALUES (?, ?, ?)', [
      teacherId,
      tag,
      tag.slice(-8).toUpperCase().padStart(8, 'W'),
    ]);
    classId = c.insertId;
    for (const id of studentIds) {
      await query('INSERT INTO class_members (class_id, user_id) VALUES (?, ?)', [classId, id]);
    }
    const l = await query(
      `INSERT INTO lessons (class_id, title, room_name, status, away_timeout_min, started_at)
       VALUES (?, ?, ?, 'live', 15, UTC_TIMESTAMP())`,
      [classId, tag, tag]
    );
    lessonId = l.insertId;
    access = { lesson: { id: lessonId, class_id: classId }, isTeacher: false };
  });

  afterAll(async () => {
    if (classId) await query('DELETE FROM classes WHERE id = ?', [classId]); // lessons / attendance も消える
    await query('DELETE FROM users WHERE login_id LIKE ?', [`${tag}_%`]);
    await getPool().end();
  });

  test('累積：14分退出→復帰→再退出→1分で欠課', async () => {
    const uid = studentIds[0];
    await setAway(uid, 0, 14 * 60);

    const me = await attendance.returnFromAway(access, uid);
    expect(me.status).toBe('present');
    expect(me.away_total_sec).toBeGreaterThanOrEqual(14 * 60);
    expect(me.away_total_sec).toBeLessThan(14 * 60 + 5);

    await attendance.goAway(access, uid);
    expect((await row(uid)).status).toBe('away');

    // 再退出から1分経過したことにする（累積 14分 ＋ 1分 = 閾値 15分）
    await query('UPDATE attendance SET away_since = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 SECOND) WHERE lesson_id = ? AND user_id = ?', [
      lessonId,
      uid,
    ]);
    await attendance.absentExpiredAll();

    const r = await row(uid);
    expect(r.status).toBe('absent');
    expect(r.away_since).toBeNull();
    expect(r.away_total_sec).toBeGreaterThanOrEqual(15 * 60);
  });

  test('復帰時の閾値判定：累積14分50秒で退出し20秒後に戻る→409 ALREADY_ABSENT で欠課', async () => {
    const uid = studentIds[1];
    await setAway(uid, 14 * 60 + 50, 20);

    await expect(attendance.returnFromAway(access, uid)).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_ABSENT',
    });
    expect((await row(uid)).status).toBe('absent');

    // 欠課のまま再度「戻る」も、「一時退出」も 409（v4.3）
    await expect(attendance.returnFromAway(access, uid)).rejects.toMatchObject({ code: 'ALREADY_ABSENT' });
    await expect(attendance.goAway(access, uid)).rejects.toMatchObject({ status: 409, code: 'ALREADY_ABSENT' });

    // 再接続しても欠課のまま（present に戻さない）
    expect(await attendance.markJoined(lessonId, uid)).toBe(false);
    expect((await row(uid)).status).toBe('absent');

    // 一覧・自分の状態では、欠課の残り秒数は 0
    const list = await attendance.listAttendance({ ...access, isTeacher: true });
    expect(list.find((r) => r.user.id === uid)).toMatchObject({ status: 'absent', remaining_sec: 0 });
    expect(await attendance.getMyAttendance(access, uid)).toMatchObject({ status: 'absent', remaining_sec: 0 });
  });

  test('先生が欠課→出席に手動修正すると累積がリセットされる', async () => {
    const uid = studentIds[1]; // 前のテストで欠課（累積 15 分超）になっている
    expect((await row(uid)).away_total_sec).toBeGreaterThanOrEqual(15 * 60);

    const updated = await attendance.updateAttendance({ ...access, isTeacher: true }, uid, {
      status: 'present',
      note: 'w2 回線トラブル',
    });
    expect(updated.status).toBe('present');
    expect(updated.away_total_sec).toBe(0);
    expect(updated.remaining_sec).toBe(15 * 60);

    const r = await row(uid);
    expect(r.away_total_sec).toBe(0);
    expect(r.away_since).toBeNull();
    expect(r.note).toBe('w2 回線トラブル');

    // 手動で away にすると away_since が今になる。もう一度 present に戻しておく
    const away = await attendance.updateAttendance({ ...access, isTeacher: true }, uid, { status: 'away' });
    expect(away.status).toBe('away');
    expect(away.away_since).not.toBeNull();
    await attendance.updateAttendance({ ...access, isTeacher: true }, uid, { status: 'present' });
  });

  test('授業終了時の確定：退出中は閾値未満なら出席、未入室は欠課（joined_at null）、away は残らない', async () => {
    const awayUid = studentIds[2];
    const neverUid = studentIds[3];
    await setAway(awayUid, 60, 30);

    await query("UPDATE lessons SET status = 'ended', ended_at = UTC_TIMESTAMP() WHERE id = ?", [lessonId]);
    const changed = await attendance.finalizeAttendance(lessonId);

    // 変化した生徒の一覧が返る（呼び出し側がコミット後に attendance:update を送る）
    expect(changed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: awayUid, status: 'present' }),
        expect.objectContaining({ user_id: neverUid, status: 'absent', away_total_sec: 0 }),
      ])
    );
    expect(changed).toHaveLength(2);

    const a = await row(awayUid);
    expect(a.status).toBe('present');
    expect(a.away_since).toBeNull();
    expect(a.away_total_sec).toBeGreaterThanOrEqual(90);

    const n = await row(neverUid);
    expect(n.status).toBe('absent');
    expect(n.joined_at).toBeNull();

    const remainingAway = await query("SELECT 1 FROM attendance WHERE lesson_id = ? AND status = 'away'", [lessonId]);
    expect(remainingAway).toHaveLength(0);
  });

  test('live でない授業では入室を記録しない', async () => {
    // 前のテストで ended にしている
    const r = await query('INSERT INTO users (name, login_id, password_hash, role) VALUES (?, ?, ?, ?)', [
      `${tag}_x`,
      `${tag}_x`,
      'x',
      'student',
    ]);
    expect(await attendance.markJoined(lessonId, r.insertId)).toBe(false);
    expect(await row(r.insertId)).toBeNull();

    // 終了後の切断でも away にしない（終了後に away の行を作らない）
    const presentUid = studentIds[1];
    expect((await row(presentUid)).status).toBe('present');
    expect(await attendance.markDisconnected(lessonId, presentUid)).toBe(false);
    expect((await row(presentUid)).status).toBe('present');
  });
});
