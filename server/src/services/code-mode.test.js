// F-10 プログラミングモードのテスト（DB）— 担当：W1 / W2
// MYSQL_URL / DATABASE_URL が無ければ skip。テストデータは f10_ 接頭辞で作り、最後に消す。
// Socket の送信は sockets/io をモック、実行サーバー（Piston）は global.fetch をモックする（外部には繋がない）。
jest.mock('../sockets/io', () => ({
  emitToLesson: jest.fn(),
  emitToTeachers: jest.fn(),
  emitToStudents: jest.fn(),
  emitToUser: jest.fn(),
  getIo: () => null,
  setIo: () => {},
}));

const { CODE_DEFAULT_TEMPLATE, CODE_RUN_KINDS, CODE_RUN_STATUS, CODE_STATES, ERROR_CODES, LESSON_MODES } =
  require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const config = require('../config');
const { getPool, query } = require('../db/pool');
const { getLessonAccess } = require('./access');
const io = require('../sockets/io');
const codeTasks = require('./code-tasks');
const codeMode = require('./code-mode');
const runner = require('./code-runner');

const describeDb = config.databaseUrl ? describe : describe.skip;

jest.setTimeout(60 * 1000);

/** Piston の応答を作る（compile 失敗 / run の結果を指定） */
function pistonResponse({ compileStderr = '', runStdout = '', runStderr = '', runCode = 0, signal = null } = {}) {
  const compileFailed = compileStderr !== '';
  return {
    ok: true,
    json: async () => ({
      compile: { code: compileFailed ? 1 : 0, stdout: '', stderr: compileStderr },
      run: compileFailed ? null : { code: runCode, signal, stdout: runStdout, stderr: runStderr },
    }),
  };
}

describeDb('F-10 プログラミングモード（DB）', () => {
  const tag = `f10_${Date.now().toString(36)}`;
  let classId;
  let lessonId;
  let teacher;
  let s1;
  let s2;
  let outsider;
  let task1;

  async function insertUser(suffix, role) {
    const r = await query('INSERT INTO users (name, login_id, password_hash, role) VALUES (?, ?, ?, ?)', [
      `${tag}_${suffix}`.slice(0, 30),
      `${tag}_${suffix}`,
      'x',
      role,
    ]);
    return { id: r.insertId, name: `${tag}_${suffix}`, role };
  }

  const accessOf = (user) => getLessonAccess(user, lessonId);
  const taskAccessOf = (user, taskId) => codeTasks.getTaskAccess(user, taskId);

  beforeAll(async () => {
    config.codeRunnerUrl = 'http://piston.test/api/v2';
    teacher = await insertUser('t', 'teacher');
    s1 = await insertUser('s1', 'student');
    s2 = await insertUser('s2', 'student');
    outsider = await insertUser('o', 'student');
    const c = await query('INSERT INTO classes (teacher_id, name, join_code) VALUES (?, ?, ?)', [
      teacher.id,
      tag,
      Date.now().toString(36).slice(-8).toUpperCase().padStart(8, 'F'),
    ]);
    classId = c.insertId;
    for (const s of [s1, s2]) await query('INSERT INTO class_members (class_id, user_id) VALUES (?, ?)', [classId, s.id]);
    const l = await query(
      `INSERT INTO lessons (class_id, title, room_name, status, started_at) VALUES (?, ?, ?, 'live', UTC_TIMESTAMP())`,
      [classId, tag, `${tag}_room`]
    );
    lessonId = l.insertId;
  });

  afterAll(async () => {
    if (classId) await query('DELETE FROM classes WHERE id = ?', [classId]);
    await query('DELETE FROM users WHERE login_id LIKE ?', [`${tag}_%`]);
    await getPool().end();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    runner.resetRateLimit();
    global.fetch = jest.fn(async () => pistonResponse());
  });

  afterAll(() => {
    delete global.fetch;
  });

  describe('課題とモード', () => {
    test('課題が無いと coding にできない（409）', async () => {
      const { lesson } = await accessOf(teacher);
      await expect(codeMode.setMode(lesson, { mode: LESSON_MODES.CODING })).rejects.toMatchObject({ status: 409 });
    });

    test('課題の作成：空テンプレートは既定の雛形、初回は自動で active。全員に code:task_added', async () => {
      const { lesson } = await accessOf(teacher);
      task1 = await codeTasks.createTask(lesson, { title: '課題1 Hello', template: '' });
      expect(task1).toMatchObject({ lesson_id: lessonId, title: '課題1 Hello', language: 'java', is_active: true, sort_order: 1 });
      expect(task1.template).toBe(CODE_DEFAULT_TEMPLATE);
      expect(io.emitToLesson).toHaveBeenCalledWith(lessonId, SERVER_EVENTS.CODE_TASK_ADDED, { task: task1 });
      expect(io.emitToLesson).toHaveBeenCalledWith(lessonId, SERVER_EVENTS.CODE_ACTIVE_TASK, { task_id: task1.id });

      const task2 = await codeTasks.createTask(lesson, { title: '課題2', template: 'public class Main {}' });
      expect(task2.is_active).toBe(false);
      expect(task2.sort_order).toBe(2);

      const list = await codeTasks.listTasks((await accessOf(s1)).lesson);
      expect(list.map((t) => t.id)).toEqual([task1.id, task2.id]);
      expect(list[0].is_active).toBe(true);
    });

    test('タイトルが長すぎると 400。他の授業の課題は active にできない（400）', async () => {
      const { lesson } = await accessOf(teacher);
      await expect(codeTasks.createTask(lesson, { title: 'あ'.repeat(101) })).rejects.toMatchObject({ status: 400 });
      await expect(codeTasks.setActiveTask(lesson, { task_id: 999999999 })).rejects.toMatchObject({ status: 400 });
    });

    test('coding に切り替えると全員に lesson:mode、LessonDetail に mode が入る', async () => {
      const { lesson } = await accessOf(teacher);
      const detail = await codeMode.setMode(lesson, { mode: LESSON_MODES.CODING });
      expect(detail.mode).toBe(LESSON_MODES.CODING);
      expect(detail.active_task_id).toBe(task1.id);
      expect(io.emitToLesson).toHaveBeenCalledWith(lessonId, SERVER_EVENTS.LESSON_MODE, { mode: LESSON_MODES.CODING });
    });

    test('クラス外のユーザーは課題にアクセスできない（403）', async () => {
      await expect(taskAccessOf(outsider, task1.id)).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('保存（コンパイルのみ）', () => {
    test('; を抜いたコードを save → compile_error と行番号。先生に code:status / code:run_result', async () => {
      global.fetch = jest.fn(async () =>
        pistonResponse({ compileStderr: "Main.java:3: error: ';' expected\n        System.out.println(\"Hello\")\n                                   ^\n1 error\n" })
      );
      const access = await taskAccessOf(s1, task1.id);
      const res = await runner.saveCode(access, s1, { source: 'public class Main { void x() { int a = 1 } }' });
      expect(res.snapshot_id).toEqual(expect.any(Number));
      expect(res.compile.status).toBe(CODE_RUN_STATUS.COMPILE_ERROR);
      expect(res.compile.errors[0]).toMatchObject({ line: 3, message: "';' expected" });

      // Piston には Compile.java（ラッパー）→ Main.java の順で渡す
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.files.map((f) => f.name)).toEqual(['Compile.java', 'Main.java']);

      expect(io.emitToTeachers).toHaveBeenCalledWith(
        lessonId,
        SERVER_EVENTS.CODE_STATUS,
        expect.objectContaining({ task_id: task1.id, user_id: s1.id, state: CODE_STATES.COMPILE_ERROR, line: 3 })
      );
      expect(io.emitToUser).toHaveBeenCalledWith(
        lessonId,
        s1.id,
        SERVER_EVENTS.CODE_RUN_RESULT,
        expect.objectContaining({ kind: CODE_RUN_KINDS.COMPILE, status: CODE_RUN_STATUS.COMPILE_ERROR })
      );
    });

    test('正しいコードを save → ok。実行サーバーに繋がらなくても保存は成功し runner_unavailable', async () => {
      const access = await taskAccessOf(s1, task1.id);
      const ok = await runner.saveCode(access, s1, { source: 'public class Main { public static void main(String[] a) {} }' });
      expect(ok.compile).toEqual({ status: CODE_RUN_STATUS.OK, errors: [] });

      global.fetch = jest.fn(async () => {
        throw new Error('ECONNREFUSED');
      });
      const down = await runner.saveCode(access, s1, { source: 'public class Main {}' });
      expect(down.compile.status).toBe(CODE_RUN_STATUS.RUNNER_UNAVAILABLE);
      expect(down.snapshot_id).toBeGreaterThan(ok.snapshot_id);
    });

    test('先生は target_user_id 必須（400）。生徒は target_user_id を付けられない（400）。先生の保存は edited_by_teacher', async () => {
      const tAccess = await taskAccessOf(teacher, task1.id);
      await expect(runner.saveCode(tAccess, teacher, { source: 'x' })).rejects.toMatchObject({ status: 400 });
      await expect(runner.saveCode(tAccess, teacher, { source: 'x', target_user_id: outsider.id })).rejects.toMatchObject({ status: 400 });
      const sAccess = await taskAccessOf(s1, task1.id);
      await expect(runner.saveCode(sAccess, s1, { source: 'x', target_user_id: s2.id })).rejects.toMatchObject({ status: 400 });

      await runner.saveCode(tAccess, teacher, { source: '// fixed by teacher', target_user_id: s2.id, edited_by_teacher: true });
      const rows = await query('SELECT edited_by_teacher, user_id FROM code_snapshots WHERE task_id = ? AND user_id = ?', [task1.id, s2.id]);
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].edited_by_teacher)).toBe(1);
    });

    test('video モードでは save できない（409 NOT_CODING_MODE）', async () => {
      const { lesson } = await accessOf(teacher);
      await codeMode.setMode(lesson, { mode: LESSON_MODES.VIDEO });
      const access = await taskAccessOf(s1, task1.id);
      await expect(runner.saveCode(access, s1, { source: 'x' })).rejects.toMatchObject({ status: 409, code: ERROR_CODES.NOT_CODING_MODE });
      await codeMode.setMode((await accessOf(teacher)).lesson, { mode: LESSON_MODES.CODING });
    });
  });

  describe('実行', () => {
    const flush = () => new Promise((r) => setTimeout(r, 50));

    test('Hello を run → 202 {run_id, queued_position:0} → code:queue 0 → code:run_result ok', async () => {
      await runner.checkHealth(); // fetch モックが ok を返すので available
      global.fetch = jest.fn(async () => pistonResponse({ runStdout: 'Hello\n' }));
      const access = await taskAccessOf(s1, task1.id);
      const res = await runner.runCode(access, s1, { source: 'public class Main { public static void main(String[] a) { System.out.println("Hello"); } }' });
      expect(res).toEqual({ run_id: expect.any(Number), queued_position: 0 });
      await flush();
      expect(io.emitToUser).toHaveBeenCalledWith(lessonId, s1.id, SERVER_EVENTS.CODE_QUEUE, { position: 0 });
      expect(io.emitToUser).toHaveBeenCalledWith(
        lessonId,
        s1.id,
        SERVER_EVENTS.CODE_RUN_RESULT,
        expect.objectContaining({ run_id: res.run_id, kind: CODE_RUN_KINDS.RUN, status: CODE_RUN_STATUS.OK, stdout: 'Hello\n' })
      );
      expect(io.emitToTeachers).toHaveBeenCalledWith(
        lessonId,
        SERVER_EVENTS.CODE_STATUS,
        expect.objectContaining({ user_id: s1.id, state: CODE_STATES.OK })
      );
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.files.map((f) => f.name)).toEqual(['Main.java']);
    });

    test('1 分に 7 回 run → 7 回目が 429 RATE_LIMITED。先生は run できない（403）', async () => {
      const access = await taskAccessOf(s2, task1.id);
      for (let i = 0; i < 6; i += 1) await runner.runCode(access, s2, { source: 'x' });
      await expect(runner.runCode(access, s2, { source: 'x' })).rejects.toMatchObject({ status: 429, code: ERROR_CODES.RATE_LIMITED });
      const tAccess = await taskAccessOf(teacher, task1.id);
      await expect(runner.runCode(tAccess, teacher, { source: 'x' })).rejects.toMatchObject({ status: 403 });
      await flush();
    });

    test('実行サーバー停止中は run が 503 RUNNER_UNAVAILABLE', async () => {
      global.fetch = jest.fn(async () => {
        throw new Error('ECONNREFUSED');
      });
      await runner.checkHealth();
      const access = await taskAccessOf(s1, task1.id);
      await expect(runner.runCode(access, s1, { source: 'x' })).rejects.toMatchObject({ status: 503, code: ERROR_CODES.RUNNER_UNAVAILABLE });
      global.fetch = jest.fn(async () => pistonResponse());
      await runner.checkHealth();
    });
  });

  describe('コード本体・集計・授業後', () => {
    test('documents 一覧：全生徒分。直近の結果で state が決まる', async () => {
      const access = await taskAccessOf(teacher, task1.id);
      const list = await codeTasks.listDocuments(access);
      expect(list.map((d) => d.user.id).sort()).toEqual([s1.id, s2.id].sort());
      const d1 = list.find((d) => d.user.id === s1.id);
      expect(d1.state).toBe(CODE_STATES.OK);
      expect(d1.last_saved_at).toEqual(expect.any(String));
      expect(d1.source_head.split('\n').length).toBeLessThanOrEqual(20);
    });

    test('documents/:user_id：本人と先生は読める、他の生徒は 403。runs は新しい順 5 件まで', async () => {
      const own = await codeTasks.getDocument(await taskAccessOf(s1, task1.id), s1, s1.id);
      expect(own.user.id).toBe(s1.id);
      expect(own.runs.length).toBeLessThanOrEqual(5);
      expect(own.runs[0].run_id).toBeGreaterThan(own.runs[own.runs.length - 1].run_id);
      await expect(codeTasks.getDocument(await taskAccessOf(s1, task1.id), s1, s2.id)).rejects.toMatchObject({ status: 403 });
      const byTeacher = await codeTasks.getDocument(await taskAccessOf(teacher, task1.id), teacher, s2.id);
      expect(byTeacher.source).toBe('// fixed by teacher');
    });

    test('再配布：code_documents がテンプレートに戻り、生徒それぞれに code:reset。snapshots は残る', async () => {
      const access = await taskAccessOf(teacher, task1.id);
      const before = await query('SELECT COUNT(*) AS n FROM code_snapshots WHERE task_id = ?', [task1.id]);
      await codeTasks.redistribute(access);
      const docs = await query('SELECT source FROM code_documents WHERE task_id = ?', [task1.id]);
      docs.forEach((d) => expect(d.source).toBe(CODE_DEFAULT_TEMPLATE));
      const after = await query('SELECT COUNT(*) AS n FROM code_snapshots WHERE task_id = ?', [task1.id]);
      expect(Number(after[0].n)).toBe(Number(before[0].n));
      expect(io.emitToUser).toHaveBeenCalledWith(lessonId, s1.id, SERVER_EVENTS.CODE_RESET, { task_id: task1.id });
      expect(io.emitToUser).toHaveBeenCalledWith(lessonId, s2.id, SERVER_EVENTS.CODE_RESET, { task_id: task1.id });
    });

    test('コードスポットライト：全員に source 付きで配信。null で解除', async () => {
      const access = await accessOf(teacher);
      const res = await codeMode.setCodeSpotlight(access, { user_id: s2.id });
      expect(res).toEqual({ user_id: s2.id });
      expect(io.emitToLesson).toHaveBeenCalledWith(
        lessonId,
        SERVER_EVENTS.CODE_SPOTLIGHT,
        expect.objectContaining({ user_id: s2.id, task_id: task1.id, user: { id: s2.id, name: s2.name }, source: expect.any(String) })
      );
      await expect(codeMode.setCodeSpotlight(access, { user_id: outsider.id })).rejects.toMatchObject({ status: 400 });
      await codeMode.setCodeSpotlight(access, { user_id: null });
      expect(io.emitToLesson).toHaveBeenCalledWith(lessonId, SERVER_EVENTS.CODE_SPOTLIGHT, { user_id: null, task_id: task1.id });
    });

    test('summary：最後の保存の compile_ok の人数、保存回数のヒストグラム、先生編集あり', async () => {
      const access = await accessOf(teacher);
      const sum = await codeTasks.summary(access);
      expect(sum).toHaveLength(2);
      const t1 = sum.find((s) => s.task.id === task1.id);
      expect(t1.total).toBe(2);
      // s1 の最後の保存は runner_unavailable（compile_ok=0）、s2 は先生の保存（fetch モックは ok）→ 1 人
      expect(t1.compiled_ok_count).toBe(1);
      expect(t1.saves_histogram.reduce((n, h) => n + h.users, 0)).toBe(2);
      const s2row = t1.first_ok_at_by_user.find((r) => r.user.id === s2.id);
      expect(s2row.edited_by_teacher).toBe(true);
      expect(s2row.first_ok_at).toEqual(expect.any(String));
    });

    test('mine：自分のコードだけ。未着手の課題はテンプレート', async () => {
      const { lesson } = await accessOf(s1);
      const mine = await codeTasks.mine(lesson, s1);
      expect(mine).toHaveLength(2);
      expect(mine[0].task.id).toBe(task1.id);
      expect(mine[0].last_saved_at).toEqual(expect.any(String));
      expect(mine[1].source).toBe('public class Main {}');
      expect(mine[1].last_saved_at).toBeNull();
    });
  });
});
