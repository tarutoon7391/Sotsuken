// 確認ボタン・理解度・質問・チャットのテスト（DB）— 担当：W2
// MYSQL_URL / DATABASE_URL が無ければ skip。テストデータは w2_ 接頭辞で作り、最後に消す。
// Socket の送信は sockets/io をモックして、宛先とペイロードを確かめる。
jest.mock('../sockets/io', () => ({
  emitToLesson: jest.fn(),
  emitToTeachers: jest.fn(),
  emitToStudents: jest.fn(),
  getIo: () => null,
  setIo: () => {},
}));

const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const config = require('../config');
const { getPool, query } = require('../db/pool');
const io = require('../sockets/io');
const attention = require('./attention');
const understanding = require('./understanding');
const questions = require('./questions');
const chat = require('./chat');

const describeDb = config.databaseUrl ? describe : describe.skip;

// Railway の MySQL はリモートで往復が遅いので、既定の 5 秒では足りない
jest.setTimeout(60 * 1000);

describeDb('確認ボタン・理解度・質問・チャット（DB）', () => {
  const tag = `w2_lf_${Date.now().toString(36)}`;
  let classId;
  let lessonId;
  let otherLessonId;
  let teacher;
  let s1;
  let s2;
  let accS1;

  async function insertUser(suffix, role) {
    const r = await query('INSERT INTO users (name, login_id, password_hash, role) VALUES (?, ?, ?, ?)', [
      `${tag}_${suffix}`.slice(0, 30),
      `${tag}_${suffix}`,
      'x',
      role,
    ]);
    return { id: r.insertId, name: `${tag}_${suffix}`, role };
  }

  async function insertLesson(status, suffix) {
    const r = await query(
      `INSERT INTO lessons (class_id, title, room_name, status, started_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
      [classId, tag, `${tag}_${suffix}`, status]
    );
    return r.insertId;
  }

  async function setLessonStatus(id, status) {
    await query('UPDATE lessons SET status = ? WHERE id = ?', [status, id]);
  }

  beforeAll(async () => {
    teacher = await insertUser('t', 'teacher');
    s1 = await insertUser('s1', 'student');
    s2 = await insertUser('s2', 'student');
    const c = await query('INSERT INTO classes (teacher_id, name, join_code) VALUES (?, ?, ?)', [
      teacher.id,
      tag,
      Date.now().toString(36).slice(-8).toUpperCase().padStart(8, 'W'),
    ]);
    classId = c.insertId;
    for (const s of [s1, s2]) await query('INSERT INTO class_members (class_id, user_id) VALUES (?, ?)', [classId, s.id]);
    lessonId = await insertLesson('live', 'a');
    otherLessonId = await insertLesson('preparing', 'b');
    for (const s of [s1, s2]) {
      await query("INSERT INTO attendance (lesson_id, user_id, status, joined_at) VALUES (?, ?, 'present', UTC_TIMESTAMP())", [
        lessonId,
        s.id,
      ]);
    }
    accS1 = { lesson: { id: lessonId }, isTeacher: false };
  });

  afterAll(async () => {
    if (classId) await query('DELETE FROM classes WHERE id = ?', [classId]);
    await query('DELETE FROM users WHERE login_id LIKE ?', [`${tag}_%`]);
    await getPool().end();
  });

  beforeEach(() => jest.clearAllMocks());

  describe('確認ボタン', () => {
    test('発動で全員に attention:check（issued_at・auto 付き）、直後に先生へ attention:update', async () => {
      const res = await attention.issueCheckByTeacher(lessonId, { timeout_sec: 30 });
      expect(io.emitToLesson).toHaveBeenCalledWith(
        lessonId,
        SERVER_EVENTS.ATTENTION_CHECK,
        expect.objectContaining({ check_id: res.check_id, deadline_at: res.deadline_at, auto: false })
      );
      expect(io.emitToLesson.mock.calls[0][2].issued_at).toEqual(expect.any(String));
      expect(io.emitToTeachers).toHaveBeenCalledWith(
        lessonId,
        SERVER_EVENTS.ATTENTION_UPDATE,
        expect.objectContaining({ responded: [], pending: expect.any(Array) })
      );
      expect(io.emitToTeachers.mock.calls[0][2].pending).toHaveLength(2);
    });

    test('一覧（GET /lessons/:id/attention）と自動設定の取得', async () => {
      const auto = await attention.issueCheck(lessonId, 30, true);
      const list = await attention.listChecks(lessonId);
      const found = list.find((c) => c.check_id === auto.check_id);
      expect(found).toMatchObject({ auto: true, responded_count: 0, pending_count: 2 });
      expect(list[0].auto).toBe(false);

      expect(attention.getAuto(lessonId)).toEqual({ interval_min: 0 });
      attention.setAuto(lessonId, { interval_min: 5 });
      expect(attention.getAuto(lessonId)).toEqual({ interval_min: 5 });
      attention.setAuto(lessonId, { interval_min: 0 });
      expect(attention.getAuto(lessonId)).toEqual({ interval_min: 0 });
    });

    test('応答済みの再押下は締切後でも成功、未応答は 409 CHECK_EXPIRED', async () => {
      const { check_id: checkId } = await attention.issueCheck(lessonId, 30, false);
      await attention.respond(checkId, s1);
      await query('UPDATE attention_checks SET deadline_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE id = ?', [checkId]);
      await expect(attention.respond(checkId, s1)).resolves.toBeUndefined();
      await expect(attention.respond(checkId, s2)).rejects.toMatchObject({ status: 409, code: 'CHECK_EXPIRED' });
    });

    test('接続中の授業と違う授業の確認は 403（Socket 用）', async () => {
      const { check_id: checkId } = await attention.issueCheck(lessonId, 30, false);
      await expect(attention.respond(checkId, s1, { lessonId: otherLessonId })).rejects.toMatchObject({ status: 403 });
    });

    test('授業が live でなければ発動・応答とも 409 CONFLICT', async () => {
      const { check_id: checkId } = await attention.issueCheck(lessonId, 30, false);
      await setLessonStatus(lessonId, 'ended');
      try {
        await expect(attention.respond(checkId, s2)).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
        await expect(attention.issueCheckByTeacher(lessonId, {})).rejects.toMatchObject({ code: 'CONFLICT' });
      } finally {
        await setLessonStatus(lessonId, 'live');
      }
    });
  });

  describe('理解度', () => {
    test('live でなければリセットは 409 で、understanding:reset を送らない', async () => {
      await expect(understanding.reset(otherLessonId)).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
      expect(io.emitToLesson).not.toHaveBeenCalled();
    });

    test('リセットで current が 0 になり、totals は減らない', async () => {
      await understanding.send(lessonId, s1.id, 'confused');
      await understanding.send(lessonId, s1.id, 'understood');
      expect(await understanding.getCurrent(lessonId)).toMatchObject({ understood: 1, confused: 0, total: 1 });
      await new Promise((r) => setTimeout(r, 1100)); // created_at が秒精度なので、リセットを次の秒にずらす
      await understanding.reset(lessonId);
      const summary = await understanding.getSummary(lessonId);
      expect(summary.current.total).toBe(0);
      expect(summary.totals).toMatchObject({ understood: 1, confused: 1 });
      expect(io.emitToLesson).toHaveBeenCalledWith(lessonId, SERVER_EVENTS.UNDERSTANDING_RESET, {});
    });
  });

  describe('質問', () => {
    test('空白だけの本文は 400、挙手は匿名にならない', async () => {
      await expect(questions.postQuestion(accS1, s1, { body: '   ' })).rejects.toMatchObject({ status: 400 });
      const raised = await questions.postQuestion(accS1, s1, { is_anonymous: true });
      expect(raised).toMatchObject({ body: null, is_anonymous: false });
      expect(io.emitToTeachers).toHaveBeenCalledWith(lessonId, SERVER_EVENTS.QUESTION_RAISED, {
        user: { id: s1.id, name: expect.any(String) },
      });
    });

    test('匿名質問は生徒向けの question:new に user を含めない（status は含める）', async () => {
      await questions.postQuestion(accS1, s1, { body: '<b>質問</b>', is_anonymous: true });
      const toStudents = io.emitToStudents.mock.calls.find((c) => c[1] === SERVER_EVENTS.QUESTION_NEW)[2];
      expect(toStudents.user).toBeUndefined();
      expect(toStudents.status).toBe('open');
      const toTeachers = io.emitToTeachers.mock.calls.find((c) => c[1] === SERVER_EVENTS.QUESTION_NEW)[2];
      expect(toTeachers.user.id).toBe(s1.id);
    });

    test('回答済み操作は終了済みの授業でも可', async () => {
      const q = await questions.postQuestion(accS1, s1, { body: '終了後に回答' });
      await setLessonStatus(lessonId, 'ended');
      try {
        await expect(questions.answerQuestion(q.id, teacher, { status: 'answered' })).resolves.toMatchObject({
          status: 'answered',
        });
      } finally {
        await setLessonStatus(lessonId, 'live');
      }
    });
  });

  describe('チャット', () => {
    async function insertFile(uploaderId, kind) {
      const r = await query(
        `INSERT INTO files (uploader_id, lesson_id, kind, file_name, url, mime, size)
         VALUES (?, ?, ?, 'a.png', '/uploads/w2.png', 'image/png', 10)`,
        [uploaderId, lessonId, kind]
      );
      return r.insertId;
    }

    test('添付は自分がアップロードした attachment だけ。資料・他人の添付・不正な file_id は不可', async () => {
      const own = await insertFile(s1.id, 'attachment');
      const others = await insertFile(s2.id, 'attachment');
      const material = await insertFile(teacher.id, 'material');

      const msg = await chat.postMessage(lessonId, s1, { file_id: own });
      expect(msg.file).toMatchObject({ id: own, kind: 'attachment' });
      await expect(chat.postMessage(lessonId, s1, { file_id: others })).rejects.toMatchObject({ status: 404 });
      await expect(chat.postMessage(lessonId, teacher, { file_id: material })).rejects.toMatchObject({ status: 404 });
      await expect(chat.postMessage(lessonId, s1, { file_id: true })).rejects.toMatchObject({ status: 400 });
      await expect(chat.postMessage(lessonId, s1, { file_id: String(own) })).rejects.toMatchObject({ status: 400 });
    });

    test('limit は 100 を超えたら丸める（400 にしない）', async () => {
      await chat.postMessage(lessonId, s1, { body: 'こんにちは' });
      await expect(chat.listMessages(lessonId, { limit: '500' })).resolves.toEqual(expect.any(Array));
      await expect(chat.listMessages(lessonId, { limit: '0' })).rejects.toMatchObject({ status: 400 });
    });

    test('終了済みの授業には投稿できない', async () => {
      await setLessonStatus(lessonId, 'ended');
      try {
        await expect(chat.postMessage(lessonId, s1, { body: 'x' })).rejects.toMatchObject({ status: 409 });
      } finally {
        await setLessonStatus(lessonId, 'live');
      }
    });
  });
});
