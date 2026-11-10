// F-10 プログラミングモード：課題・コード本体・保存履歴・集計（docs/04 §7.1）— 担当：W1
// - 課題（code_tasks）の作成・更新・一覧・「今の課題」の切替・テンプレート再配布
// - 生徒×課題のコード本体（code_documents）と保存履歴（code_snapshots）の読み書き
// - 授業結果用の集計（summary）と生徒の授業後閲覧（mine）
// 保存＝コンパイルの流れと実行は services/code-runner.js（W2）。ここは DB と配信だけを担当する。
// 所属・先生チェックは middleware/class-member.js か getTaskAccess() で済ませてから呼ぶ前提。
const {
  CODE_DEFAULT_TEMPLATE,
  CODE_LANGUAGES,
  CODE_LIMITS,
  CODE_RUN_STATUS,
  CODE_STATES,
  ERROR_CODES,
  LESSON_STATUS,
  ROLES,
} = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { getLessonAccess } = require('./access');
const { emitToLesson, emitToUser } = require('../sockets/io');
const codeLive = require('./code-live');

const NOT_LIVE_MESSAGE = '授業は開催中ではありません';

/** DATETIME（Date | null）→ ISO 8601 / UTC */
function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

/** DB の行 → CodeTask（is_active は lessons.active_task_id と比べて決める） */
function toTask(row, activeTaskId) {
  return {
    id: row.id,
    lesson_id: row.lesson_id,
    title: row.title,
    language: row.language,
    template: row.template,
    sort_order: row.sort_order,
    is_active: activeTaskId != null && row.id === activeTaskId,
    created_at: iso(row.created_at),
  };
}

/** DB の行 → UserBrief */
function toUserBrief(row) {
  return { id: row.user_id, name: row.user_name, role: row.user_role, icon_url: row.user_icon_url };
}

/** DB の行 → CodeRun（code:run_result と同じ形） */
function toRun(row) {
  return {
    run_id: Number(row.id),
    task_id: row.task_id,
    user_id: row.user_id,
    kind: row.kind,
    status: row.status,
    stdout: row.stdout,
    stderr: row.stderr,
    exit_code: row.exit_code,
    duration_ms: row.duration_ms,
    created_at: iso(row.created_at),
  };
}

/** 直近のコンパイル／実行の結果 → コードグリッドの枠色（CODE_STATES）。無ければ idle */
function stateOfRunStatus(status) {
  switch (status) {
    case CODE_RUN_STATUS.OK:
      return CODE_STATES.OK;
    case CODE_RUN_STATUS.COMPILE_ERROR:
      return CODE_STATES.COMPILE_ERROR;
    case CODE_RUN_STATUS.RUNTIME_ERROR:
    case CODE_RUN_STATUS.TIMEOUT:
      return CODE_STATES.RUNTIME_ERROR;
    default:
      return CODE_STATES.IDLE; // runner_unavailable・未実行
  }
}

/** コードの先頭 N 行（コードグリッドの縮小表示用） */
function headLines(source, n = CODE_LIMITS.GRID_HEAD_LINES) {
  return String(source || '').split('\n').slice(0, n).join('\n');
}

/** 課題タイトルの入力チェック */
function parseTitle(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '課題のタイトルを入力してください');
  }
  const title = raw.trim();
  if (title.length > CODE_LIMITS.TASK_TITLE_MAX) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, `課題のタイトルは${CODE_LIMITS.TASK_TITLE_MAX}文字以内です`);
  }
  return title;
}

/** テンプレートの入力チェック。空・省略なら既定の Main 雛形 */
function parseTemplate(raw) {
  if (raw === undefined || raw === null) return CODE_DEFAULT_TEMPLATE;
  if (typeof raw !== 'string') throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'template は文字列です');
  if (raw.trim() === '') return CODE_DEFAULT_TEMPLATE;
  if (Buffer.byteLength(raw) > CODE_LIMITS.SOURCE_MAX_BYTES) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, `テンプレートは${CODE_LIMITS.SOURCE_MAX_BYTES / 1024}KB 以内です`);
  }
  return raw;
}

/** コード本文の入力チェック（save / run で共通。W2 からも使う） */
function parseSource(raw) {
  if (typeof raw !== 'string') throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'source は文字列です');
  if (Buffer.byteLength(raw) > CODE_LIMITS.SOURCE_MAX_BYTES) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, `コードは${CODE_LIMITS.SOURCE_MAX_BYTES / 1024}KB 以内です`);
  }
  return raw;
}

/** 課題の取得（無ければ 404） */
async function findTask(taskId) {
  const rows = await query(
    'SELECT id, lesson_id, title, language, template, sort_order, created_at FROM code_tasks WHERE id = ?',
    [taskId]
  );
  if (!rows.length) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '課題が見つかりません');
  return rows[0];
}

/**
 * /api/code/tasks/:task_id/... の権限判定。課題の授業（code_tasks.lesson_id）のクラス所属で決める
 * （判定の中身は services/access.js。自前の所属チェックは書かない）
 * @returns {Promise<{ task: object, lesson: object, classRow: object, isTeacher: boolean, isMember: boolean }>}
 */
async function getTaskAccess(user, taskId, options = {}) {
  if (!Number.isInteger(taskId) || taskId <= 0) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '課題IDが不正です');
  const task = await findTask(taskId);
  const access = await getLessonAccess(user, task.lesson_id);
  if (!access.lesson) throw new ApiError(404, ERROR_CODES.NOT_FOUND, '授業が見つかりません');
  if (!access.isTeacher && !access.isMember) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この授業にアクセスする権限がありません');
  }
  if (options.teacherOnly && !access.isTeacher) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'この操作は授業の先生だけができます');
  }
  return { task, ...access };
}

/** クラスの生徒一覧（UserBrief 用の列つき。class_members の順） */
async function listClassStudents(classId) {
  return query(
    `SELECT u.id AS user_id, u.name AS user_name, u.role AS user_role, u.icon_url AS user_icon_url
       FROM class_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.class_id = ? AND u.role = ?
      ORDER BY m.joined_at, u.id`,
    [classId, ROLES.STUDENT]
  );
}

// ---------------------------------------------------------------- 課題

/** GET /lessons/:id/code/tasks（全員・ended でも可）→ CodeTask[]（sort_order 昇順） */
async function listTasks(lesson) {
  const rows = await query(
    `SELECT id, lesson_id, title, language, template, sort_order, created_at
       FROM code_tasks WHERE lesson_id = ? ORDER BY sort_order, id`,
    [lesson.id]
  );
  return rows.map((r) => toTask(r, lesson.active_task_id));
}

/**
 * POST /lessons/:id/code/tasks（先生）→ CodeTask。初回作成時は自動で active に。全員に code:task_added
 * live・preparing で可（ended は 409）
 */
async function createTask(lesson, input) {
  if (lesson.status === LESSON_STATUS.ENDED) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, '終了した授業には課題を追加できません');
  }
  const raw = input || {};
  const title = parseTitle(raw.title);
  const template = parseTemplate(raw.template);
  const language = raw.language === undefined ? CODE_LANGUAGES.JAVA : raw.language;
  if (!Object.values(CODE_LANGUAGES).includes(language)) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '対応している言語は java だけです');
  }

  const orderRows = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM code_tasks WHERE lesson_id = ?', [
    lesson.id,
  ]);
  const result = await query(
    `INSERT INTO code_tasks (lesson_id, title, language, template, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [lesson.id, title, language, template, orderRows[0].next]
  );
  const taskId = result.insertId;

  // 「今の課題」が無ければこの課題を active にする（同時作成で先に埋まっていたら上書きしない）
  let activeTaskId = lesson.active_task_id;
  if (activeTaskId == null) {
    const updated = await query('UPDATE lessons SET active_task_id = ? WHERE id = ? AND active_task_id IS NULL', [
      taskId,
      lesson.id,
    ]);
    if (updated.affectedRows > 0) activeTaskId = taskId;
    else {
      const l = await query('SELECT active_task_id FROM lessons WHERE id = ?', [lesson.id]);
      activeTaskId = l.length ? l[0].active_task_id : null;
    }
  }

  const task = toTask(await findTask(taskId), activeTaskId);
  emitToLesson(lesson.id, SERVER_EVENTS.CODE_TASK_ADDED, { task });
  if (task.is_active) emitToLesson(lesson.id, SERVER_EVENTS.CODE_ACTIVE_TASK, { task_id: task.id });
  return task;
}

/** PATCH /code/tasks/:task_id（先生）{title?, template?} → CodeTask。既存の生徒コードには影響しない */
async function updateTask(access, input) {
  const { task, lesson } = access;
  if (lesson.status === LESSON_STATUS.ENDED) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, '終了した授業の課題は変更できません');
  }
  const raw = input || {};
  const title = raw.title === undefined ? task.title : parseTitle(raw.title);
  const template = raw.template === undefined ? task.template : parseTemplate(raw.template);
  await query('UPDATE code_tasks SET title = ?, template = ? WHERE id = ?', [title, template, task.id]);
  return toTask(await findTask(task.id), lesson.active_task_id);
}

/** PUT /lessons/:id/code/active-task（先生・live 中）{task_id} → {task_id}。全員に code:active_task */
async function setActiveTask(lesson, input) {
  if (lesson.status !== LESSON_STATUS.LIVE) throw new ApiError(409, ERROR_CODES.CONFLICT, NOT_LIVE_MESSAGE);
  const taskId = input && input.task_id;
  if (!Number.isInteger(taskId) || taskId <= 0) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'task_id が不正です');
  const rows = await query('SELECT id FROM code_tasks WHERE id = ? AND lesson_id = ?', [taskId, lesson.id]);
  if (!rows.length) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'この授業の課題ではありません');

  await query('UPDATE lessons SET active_task_id = ? WHERE id = ?', [taskId, lesson.id]);
  emitToLesson(lesson.id, SERVER_EVENTS.CODE_ACTIVE_TASK, { task_id: taskId });
  return { task_id: taskId };
}

/**
 * POST /code/tasks/:task_id/redistribute（先生・live 中）
 * テンプレートを全生徒の該当課題に上書き配布（code_documents.source を置換・ydoc_state を NULL）。
 * code_snapshots は消さない。クラスの生徒それぞれに code:reset
 */
async function redistribute(access) {
  const { task, lesson, classRow } = access;
  if (lesson.status !== LESSON_STATUS.LIVE) throw new ApiError(409, ERROR_CODES.CONFLICT, NOT_LIVE_MESSAGE);
  await query(
    'UPDATE code_documents SET source = ?, ydoc_state = NULL, updated_at = UTC_TIMESTAMP() WHERE task_id = ?',
    [task.template, task.id]
  );
  codeLive.clearTask(task.id); // 書きかけ・構文エラーも配り直したテンプレートに合わせて消す
  const students = await listClassStudents(classRow.id);
  for (const s of students) {
    emitToUser(lesson.id, s.user_id, SERVER_EVENTS.CODE_RESET, { task_id: task.id });
  }
}

// ---------------------------------------------------------------- コード本体・保存履歴

/** 生徒×課題の現在のコード（無ければ null） */
async function findDocument(taskId, userId) {
  const rows = await query('SELECT task_id, user_id, source, updated_at FROM code_documents WHERE task_id = ? AND user_id = ?', [
    taskId,
    userId,
  ]);
  return rows[0] || null;
}

/**
 * 保存（code_documents を更新し code_snapshots に 1 行追加）。コンパイルは呼び出し側（code-runner）が済ませてから渡す
 * @returns {Promise<number>} snapshot_id
 */
async function saveDocument(taskId, userId, source, { compileOk, editedByTeacher }) {
  await query(
    `INSERT INTO code_documents (task_id, user_id, source, ydoc_state, updated_at)
     VALUES (?, ?, ?, NULL, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE source = VALUES(source), updated_at = UTC_TIMESTAMP()`,
    [taskId, userId, source]
  );
  const result = await query(
    `INSERT INTO code_snapshots (task_id, user_id, source, compile_ok, edited_by_teacher, saved_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [taskId, userId, source, compileOk ? 1 : 0, editedByTeacher ? 1 : 0]
  );
  return Number(result.insertId);
}

/**
 * GET /code/tasks/:task_id/documents（先生）→ CodeDocumentSummary[]。コードグリッドの初期表示用
 * まだ書いていない生徒はテンプレートを source_head に、state は idle
 * 書きかけ（code:draft）があればそれを source_head に、構文エラー中（code:syntax）なら state は syntax_error（code-live.js）
 */
async function listDocuments(access) {
  const { task, classRow } = access;
  const students = await listClassStudents(classRow.id);
  const docs = await query('SELECT user_id, source FROM code_documents WHERE task_id = ?', [task.id]);
  const saves = await query(
    'SELECT user_id, MAX(saved_at) AS last_saved_at FROM code_snapshots WHERE task_id = ? GROUP BY user_id',
    [task.id]
  );
  // 生徒ごとの直近の run（id が最大のもの）
  const runs = await query(
    `SELECT r.user_id, r.status
       FROM code_runs r
       JOIN (SELECT user_id, MAX(id) AS max_id FROM code_runs WHERE task_id = ? GROUP BY user_id) m
         ON m.max_id = r.id`,
    [task.id]
  );
  const docByUser = new Map(docs.map((d) => [d.user_id, d]));
  const savedByUser = new Map(saves.map((s) => [s.user_id, s.last_saved_at]));
  const runByUser = new Map(runs.map((r) => [r.user_id, r.status]));

  return students.map((s) => {
    const doc = docByUser.get(s.user_id);
    const lastRunStatus = runByUser.get(s.user_id) || null;
    const draft = codeLive.getDraft(task.id, s.user_id);
    const syntax = codeLive.getSyntax(task.id, s.user_id);
    const item = {
      user: toUserBrief(s),
      source_head: headLines(draft != null ? draft : doc ? doc.source : task.template),
      state: syntax.hasError ? CODE_STATES.SYNTAX_ERROR : stateOfRunStatus(lastRunStatus),
      last_saved_at: iso(savedByUser.get(s.user_id)),
      last_run_status: lastRunStatus,
    };
    if (syntax.hasError && syntax.line) item.line = syntax.line;
    return item;
  });
}

/**
 * GET /code/tasks/:task_id/documents/:user_id（先生・本人）→ CodeDocumentDetail
 * 他の生徒のものは 403。まだ書いていなければテンプレートを返す
 */
async function getDocument(access, user, userId) {
  const { task, isTeacher } = access;
  if (!Number.isInteger(userId) || userId <= 0) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'user_id が不正です');
  if (!isTeacher && userId !== user.id) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, '他の生徒のコードは見られません');
  }
  const users = await query('SELECT id AS user_id, name AS user_name, role AS user_role, icon_url AS user_icon_url FROM users WHERE id = ?', [
    userId,
  ]);
  if (!users.length) throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'ユーザーが見つかりません');

  const doc = await findDocument(task.id, userId);
  const saves = await query('SELECT MAX(saved_at) AS last_saved_at FROM code_snapshots WHERE task_id = ? AND user_id = ?', [
    task.id,
    userId,
  ]);
  const runs = await query(
    `SELECT id, task_id, user_id, kind, status, stdout, stderr, exit_code, duration_ms, created_at
       FROM code_runs WHERE task_id = ? AND user_id = ?
      ORDER BY id DESC LIMIT ${Number(CODE_LIMITS.RECENT_RUNS)}`,
    [task.id, userId]
  );
  // 先生には書きかけ（未保存）のコードを見せる（本人は保存済みのコードから復元する）
  const draft = isTeacher ? codeLive.getDraft(task.id, userId) : null;
  return {
    user: toUserBrief(users[0]),
    source: draft != null ? draft : doc ? doc.source : task.template,
    updated_at: iso(doc ? doc.updated_at : task.created_at),
    last_saved_at: iso(saves[0] && saves[0].last_saved_at),
    runs: runs.map(toRun),
  };
}

// ---------------------------------------------------------------- 集計・授業後の閲覧

/** GET /lessons/:id/code/summary（先生）→ CodeTaskSummary[]。授業結果画面用 */
async function summary(access) {
  const { lesson, classRow } = access;
  const tasks = await listTasks(lesson);
  if (!tasks.length) return [];
  const students = await listClassStudents(classRow.id);

  const result = [];
  for (const task of tasks) {
    // 生徒ごとの保存回数・最後の保存の compile_ok・最初にコンパイルが通った時刻・先生編集の有無
    const stats = await query(
      `SELECT s.user_id,
              COUNT(*) AS saves,
              MAX(s.edited_by_teacher) AS edited_by_teacher,
              MIN(CASE WHEN s.compile_ok THEN s.saved_at END) AS first_ok_at,
              (SELECT compile_ok FROM code_snapshots x
                WHERE x.task_id = s.task_id AND x.user_id = s.user_id ORDER BY x.id DESC LIMIT 1) AS last_compile_ok
         FROM code_snapshots s
        WHERE s.task_id = ?
        GROUP BY s.user_id, s.task_id`,
      [task.id]
    );
    const runs = await query(
      `SELECT r.user_id, r.status
         FROM code_runs r
         JOIN (SELECT user_id, MAX(id) AS max_id FROM code_runs WHERE task_id = ? GROUP BY user_id) m
           ON m.max_id = r.id`,
      [task.id]
    );
    const statByUser = new Map(stats.map((s) => [s.user_id, s]));
    const runByUser = new Map(runs.map((r) => [r.user_id, r.status]));

    const histogram = new Map();
    let compiledOk = 0;
    const byUser = students.map((s) => {
      const st = statByUser.get(s.user_id);
      const saves = st ? Number(st.saves) : 0;
      histogram.set(saves, (histogram.get(saves) || 0) + 1);
      if (st && Number(st.last_compile_ok) === 1) compiledOk += 1;
      return {
        user: toUserBrief(s),
        first_ok_at: iso(st && st.first_ok_at),
        last_state: stateOfRunStatus(runByUser.get(s.user_id) || null),
        edited_by_teacher: Boolean(st && Number(st.edited_by_teacher) === 1),
      };
    });

    result.push({
      task,
      total: students.length,
      compiled_ok_count: compiledOk,
      saves_histogram: [...histogram.entries()].sort((a, b) => a[0] - b[0]).map(([saves, users]) => ({ saves, users })),
      first_ok_at_by_user: byUser,
    });
  }
  return result;
}

/** GET /lessons/:id/code/mine（生徒）→ MyCodeDocument[]。自分のコードだけ（未着手の課題はテンプレート） */
async function mine(lesson, user) {
  const tasks = await listTasks(lesson);
  if (!tasks.length) return [];
  const docs = await query(
    `SELECT d.task_id, d.source
       FROM code_documents d
       JOIN code_tasks t ON t.id = d.task_id
      WHERE t.lesson_id = ? AND d.user_id = ?`,
    [lesson.id, user.id]
  );
  const saves = await query(
    `SELECT s.task_id, MAX(s.saved_at) AS last_saved_at
       FROM code_snapshots s
       JOIN code_tasks t ON t.id = s.task_id
      WHERE t.lesson_id = ? AND s.user_id = ?
      GROUP BY s.task_id`,
    [lesson.id, user.id]
  );
  const docByTask = new Map(docs.map((d) => [d.task_id, d.source]));
  const savedByTask = new Map(saves.map((s) => [s.task_id, s.last_saved_at]));
  return tasks.map((task) => ({
    task,
    source: docByTask.has(task.id) ? docByTask.get(task.id) : task.template,
    last_saved_at: iso(savedByTask.get(task.id)),
  }));
}

module.exports = {
  // 課題
  listTasks,
  createTask,
  updateTask,
  setActiveTask,
  redistribute,
  // コード本体・保存履歴
  findDocument,
  saveDocument,
  listDocuments,
  getDocument,
  // 集計
  summary,
  mine,
  // 共通（W2 の code-runner / routes からも使う）
  getTaskAccess,
  listClassStudents,
  parseSource,
  stateOfRunStatus,
  toRun,
  toTask,
  findTask,
};
