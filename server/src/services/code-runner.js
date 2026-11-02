// F-10 プログラミングモード：保存（コンパイル）・実行・待ち行列・レート制限・Piston 連携（docs/04 §7.1・§7.4）— 担当：W2
// 生徒のコードは**このサーバーでは絶対に実行しない**。必ず CODE_RUNNER_URL（Piston）に転送する。
// - 保存＝コンパイルのみ：Main.java の前に「何もしない Compile.java」を置いて Piston に渡す。
//   Piston は先頭ファイルのクラスを実行するので main は走らず、compile 段階の結果だけが返る
// - 実行＝コンパイル＋実行（stdin あり）。待ち行列（授業ごと・同時 CONCURRENT_RUNS）に入れて 202 を返し、結果は code:run_result で配信
// - 待ち行列・レート制限・死活状態はメモリ持ち（再起動で消えてよい）
const {
  CODE_LIMITS,
  CODE_MAIN_FILE,
  CODE_RUN_KINDS,
  CODE_RUN_STATUS,
  CODE_STATES,
  ERROR_CODES,
  LESSON_MODES,
  LESSON_STATUS,
  CODE_LANGUAGES,
} = require('@sotsuken/shared/constants');
const { SERVER_EVENTS } = require('@sotsuken/shared/socket-events');
const config = require('../config');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/error');
const { emitToTeachers, emitToUser } = require('../sockets/io');
const codeTasks = require('./code-tasks');

const NOT_LIVE_MESSAGE = '授業は開催中ではありません';
const NOT_CODING_MESSAGE = 'プログラミングモード中ではありません';
const RUNNER_DOWN_MESSAGE = '実行サーバーに接続できません';

/** 保存（コンパイルのみ）のときに先頭に置くラッパー。main を即終了させる */
const COMPILE_WRAPPER_FILE = 'Compile.java';
const COMPILE_WRAPPER_SOURCE = 'public class Compile { public static void main(String[] args) { } }\n';

// ---------------------------------------------------------------- 実行サーバー（Piston）

/** 死活状態。available: null=未確認 / true / false */
const runnerState = { available: null, checkedAt: null, failures: 0 };

function isConfigured() {
  return Boolean(config.codeRunnerUrl);
}

/** 実行サーバーの状態（画面の注意バー・テスト用） */
function getRunnerState() {
  return { configured: isConfigured(), ...runnerState };
}

function markUp() {
  runnerState.available = true;
  runnerState.failures = 0;
  runnerState.checkedAt = new Date();
}

function markDown() {
  runnerState.failures += 1;
  runnerState.available = false;
  runnerState.checkedAt = new Date();
}

/** 実行サーバーへ送るヘッダー。鍵があるときだけ X-Runner-Key を付ける（鍵はログ・レスポンスに出さない） */
function runnerHeaders(headers = {}) {
  return config.codeRunnerKey ? { ...headers, 'X-Runner-Key': config.codeRunnerKey } : headers;
}

/** 死活監視：GET /runtimes。起動時と CODE_LIMITS.RUNNER_HEALTH_INTERVAL_MS おき（jobs/code-runner-health.js） */
async function checkHealth() {
  if (!isConfigured()) {
    runnerState.available = false;
    return false;
  }
  try {
    const res = await fetch(`${config.codeRunnerUrl}/runtimes`, {
      headers: runnerHeaders(),
      signal: AbortSignal.timeout(CODE_LIMITS.RUNNER_HTTP_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    markUp();
  } catch (err) {
    markDown();
  }
  return runnerState.available;
}

/** stdout / stderr を CODE_LIMITS.OUTPUT_MAX_BYTES（UTF-8 バイト数）で切り詰める */
function truncateOutput(text) {
  if (text == null) return null;
  const s = String(text);
  if (Buffer.byteLength(s) <= CODE_LIMITS.OUTPUT_MAX_BYTES) return s;
  const cut = Buffer.from(s).subarray(0, CODE_LIMITS.OUTPUT_MAX_BYTES).toString();
  return `${cut}\n…（${CODE_LIMITS.OUTPUT_MAX_BYTES / 1024}KB を超えたため省略）`;
}

/**
 * javac の stderr からエラー行を取り出す
 *   Main.java:3: error: ';' expected
 *           System.out.println("Hello")
 *                                      ^
 * @returns {{ line: number, col: number|null, message: string }[]}
 */
function parseCompileErrors(stderr) {
  const errors = [];
  if (!stderr) return errors;
  const lines = String(stderr).split('\n');
  const head = new RegExp(`(?:^|[\\\\/])${CODE_MAIN_FILE.replace('.', '\\.')}:(\\d+): error: (.*)$`);
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(head);
    if (!m) continue;
    let col = null;
    // 次の 2 行が「ソース行」「^ の行」なら桁を拾う
    const caret = lines[i + 2];
    if (caret && /^\s*\^\s*$/.test(caret)) col = caret.indexOf('^') + 1;
    errors.push({ line: Number(m[1]), col, message: m[2].trim() });
  }
  return errors;
}

/**
 * Piston の /execute を呼ぶ。接続できない・タイムアウト・HTTP エラーは null を返し、死活状態を down にする
 * @param {{ name: string, content: string }[]} files  先頭がエントリ（実行されるクラス）
 * @param {string} [stdin]
 */
async function executeOnPiston(files, stdin) {
  if (!isConfigured()) return null;
  const full = {
    language: CODE_LANGUAGES.JAVA,
    version: '*',
    files,
    stdin: stdin || '',
    compile_timeout: CODE_LIMITS.CPU_TIMEOUT_MS,
    run_timeout: CODE_LIMITS.CPU_TIMEOUT_MS,
    compile_memory_limit: CODE_LIMITS.MEMORY_MB * 1024 * 1024,
    run_memory_limit: CODE_LIMITS.MEMORY_MB * 1024 * 1024,
  };
  // 公開 API（emkc.org）は run_timeout 3 秒・メモリ指定なしが上限。400 で弾かれたら控えめな値で 1 回だけ再送する
  const conservative = {
    language: full.language,
    version: full.version,
    files,
    stdin: full.stdin,
    compile_timeout: PUBLIC_API_COMPILE_TIMEOUT_MS,
    run_timeout: PUBLIC_API_RUN_TIMEOUT_MS,
  };

  const first = await postExecute(full);
  if (first.ok) return first.json;
  if (first.status === 400) {
    const second = await postExecute(conservative);
    if (second.ok) return second.json;
    return { error: second.message || first.message };
  }
  return first.message ? { error: first.message } : null;
}

/** 公開 Piston API の上限（docs/04 §7.4 の値より小さい。セルフホスト時は full の値がそのまま通る） */
const PUBLIC_API_RUN_TIMEOUT_MS = 3000;
const PUBLIC_API_COMPILE_TIMEOUT_MS = 10000;

/**
 * POST /execute を 1 回呼ぶ
 * @returns {Promise<{ ok: true, json: object } | { ok: false, status: number|null, message: string }>}
 *   ネットワーク・タイムアウト・5xx は死活状態を down にする。4xx（リクエスト内容の問題・レート超過）は down にしない
 */
async function postExecute(body) {
  try {
    const res = await fetch(`${config.codeRunnerUrl}/execute`, {
      method: 'POST',
      headers: runnerHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CODE_LIMITS.RUNNER_HTTP_TIMEOUT_MS),
    });
    if (res.ok) {
      markUp();
      return { ok: true, json: await res.json() };
    }
    let message = `実行サーバーが HTTP ${res.status} を返しました`;
    try {
      const text = await res.text();
      const parsed = text ? JSON.parse(text) : null;
      if (parsed && parsed.message) message = `実行サーバーのエラー（HTTP ${res.status}）: ${parsed.message}`;
      else if (text) message = `実行サーバーのエラー（HTTP ${res.status}）: ${text.slice(0, 200)}`;
    } catch {
      /* 本文が JSON でなければ既定の文言のまま */
    }
    if (res.status >= 500) markDown();
    console.error('Piston /execute:', message);
    return { ok: false, status: res.status, message };
  } catch (err) {
    markDown();
    return { ok: false, status: null, message: '' };
  }
}

/**
 * Piston の結果 → { status, stdout, stderr, exit_code }
 * compile 段階が失敗していれば compile_error。run 段階が SIGKILL なら timeout（CPU 制限）、exit code ≠ 0 なら runtime_error
 */
function interpretResult(result, { compileOnly }) {
  if (!result) {
    return { status: CODE_RUN_STATUS.RUNNER_UNAVAILABLE, stdout: null, stderr: RUNNER_DOWN_MESSAGE, exit_code: null };
  }
  if (result.error) {
    // 実行サーバーがリクエストを拒否した（4xx）。本文の理由をそのまま出力パネルに出す
    return { status: CODE_RUN_STATUS.RUNNER_UNAVAILABLE, stdout: null, stderr: truncateOutput(result.error), exit_code: null };
  }
  const compile = result.compile || null;
  const run = result.run || null;
  const compileFailed =
    compile && (Number(compile.code) !== 0 || /(^|\n)\S*\.java:\d+: error:/.test(String(compile.stderr || '')));
  if (compileFailed) {
    return {
      status: CODE_RUN_STATUS.COMPILE_ERROR,
      stdout: truncateOutput(compile.stdout || ''),
      stderr: truncateOutput(compile.stderr || compile.output || ''),
      exit_code: compile.code == null ? null : Number(compile.code),
    };
  }
  if (compileOnly) {
    return { status: CODE_RUN_STATUS.OK, stdout: null, stderr: truncateOutput(compile ? compile.stderr || '' : ''), exit_code: 0 };
  }
  if (!run) {
    return { status: CODE_RUN_STATUS.RUNNER_UNAVAILABLE, stdout: null, stderr: '実行結果が返りませんでした', exit_code: null };
  }
  const stdout = truncateOutput(run.stdout || '');
  const stderr = truncateOutput(run.stderr || '');
  const exitCode = run.code == null ? null : Number(run.code);
  if (run.signal === 'SIGKILL') {
    return { status: CODE_RUN_STATUS.TIMEOUT, stdout, stderr, exit_code: exitCode };
  }
  if (exitCode !== 0) {
    return { status: CODE_RUN_STATUS.RUNTIME_ERROR, stdout, stderr, exit_code: exitCode };
  }
  return { status: CODE_RUN_STATUS.OK, stdout, stderr, exit_code: 0 };
}

/** コンパイルのみ（保存時） */
async function compileSource(source) {
  const started = Date.now();
  const result = await executeOnPiston([
    { name: COMPILE_WRAPPER_FILE, content: COMPILE_WRAPPER_SOURCE },
    { name: CODE_MAIN_FILE, content: source },
  ]);
  const out = interpretResult(result, { compileOnly: true });
  return { ...out, duration_ms: Date.now() - started, errors: parseCompileErrors(out.stderr) };
}

/** コンパイル＋実行（▶ 実行） */
async function runSource(source, stdin) {
  const started = Date.now();
  const result = await executeOnPiston([{ name: CODE_MAIN_FILE, content: source }], stdin);
  const out = interpretResult(result, { compileOnly: false });
  return { ...out, duration_ms: Date.now() - started };
}

// ---------------------------------------------------------------- 待ち行列（授業ごと・同時 CONCURRENT_RUNS・FIFO）

const queues = new Map(); // lessonId → { running: number, waiting: item[] }

/** 同時実行本数（.env の CODE_RUNNER_CONCURRENCY で上書き可。1G の VPS では 2 にする） */
function maxConcurrent() {
  return config.codeRunnerConcurrency > 0 ? config.codeRunnerConcurrency : CODE_LIMITS.CONCURRENT_RUNS;
}

function getQueue(lessonId) {
  let q = queues.get(lessonId);
  if (!q) {
    q = { running: 0, waiting: [] };
    queues.set(lessonId, q);
  }
  return q;
}

function startItem(q, item) {
  q.running += 1;
  if (item.onPosition) item.onPosition(0);
  Promise.resolve()
    .then(() => item.task())
    .then(item.resolve, item.reject)
    .finally(() => {
      q.running -= 1;
      drainQueue(q);
    });
}

function drainQueue(q) {
  while (q.running < maxConcurrent() && q.waiting.length) startItem(q, q.waiting.shift());
  // 残っている人に新しい順番を知らせる（1 始まり）
  q.waiting.forEach((it, i) => it.onPosition && it.onPosition(i + 1));
}

/**
 * 授業の待ち行列に入れる
 * @param {number} lessonId
 * @param {() => Promise<any>} task
 * @param {(position: number) => void} [onPosition]  0 で実行開始、1 以上は待ち順
 * @returns {{ position: number, promise: Promise<any> }}
 */
function enqueue(lessonId, task, onPosition) {
  const q = getQueue(lessonId);
  const item = { task, onPosition, resolve: null, reject: null };
  const promise = new Promise((resolve, reject) => {
    item.resolve = resolve;
    item.reject = reject;
  });
  let position;
  if (q.running < maxConcurrent()) {
    position = 0;
    startItem(q, item);
  } else {
    q.waiting.push(item);
    position = q.waiting.length;
    if (onPosition) onPosition(position);
  }
  return { position, promise };
}

/** 待ち行列の状態（テスト用） */
function getQueueState(lessonId) {
  const q = getQueue(lessonId);
  return { running: q.running, waiting: q.waiting.length };
}

// ---------------------------------------------------------------- レート制限（ユーザー×課題で 1 分 RUNS_PER_MINUTE 回）

const RATE_WINDOW_MS = 60 * 1000;
const rateLog = new Map(); // `${userId}:${taskId}` → 実行時刻（ms）の配列

/** 上限内なら記録して true、超過なら false */
function takeRateSlot(userId, taskId, now = Date.now()) {
  const key = `${userId}:${taskId}`;
  const stamps = (rateLog.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (stamps.length >= CODE_LIMITS.RUNS_PER_MINUTE) {
    rateLog.set(key, stamps);
    return false;
  }
  stamps.push(now);
  rateLog.set(key, stamps);
  return true;
}

/** テスト用 */
function resetRateLimit() {
  rateLog.clear();
}

// ---------------------------------------------------------------- 結果の記録と配信

/** code_runs に 1 行入れて CodeRun を返す */
async function insertRun(taskId, userId, kind, out) {
  const result = await query(
    `INSERT INTO code_runs (task_id, user_id, kind, status, stdout, stderr, exit_code, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [taskId, userId, kind, out.status, out.stdout, out.stderr, out.exit_code, out.duration_ms]
  );
  const rows = await query(
    'SELECT id, task_id, user_id, kind, status, stdout, stderr, exit_code, duration_ms, created_at FROM code_runs WHERE id = ?',
    [result.insertId]
  );
  return codeTasks.toRun(rows[0]);
}

/** 実行開始前に確保した行を結果で更新して CodeRun を返す */
async function updateRun(runId, out) {
  await query(
    'UPDATE code_runs SET status = ?, stdout = ?, stderr = ?, exit_code = ?, duration_ms = ? WHERE id = ?',
    [out.status, out.stdout, out.stderr, out.exit_code, out.duration_ms, runId]
  );
  const rows = await query(
    'SELECT id, task_id, user_id, kind, status, stdout, stderr, exit_code, duration_ms, created_at FROM code_runs WHERE id = ?',
    [runId]
  );
  return codeTasks.toRun(rows[0]);
}

/** 結果を本人＋先生に code:run_result、先生に code:status で配信 */
function broadcastRun(lessonId, run, errors) {
  emitToUser(lessonId, run.user_id, SERVER_EVENTS.CODE_RUN_RESULT, run);
  emitToTeachers(lessonId, SERVER_EVENTS.CODE_RUN_RESULT, run);
  const status = { task_id: run.task_id, user_id: run.user_id, state: codeTasks.stateOfRunStatus(run.status) };
  if (errors && errors.length) status.line = errors[0].line;
  emitToTeachers(lessonId, SERVER_EVENTS.CODE_STATUS, status);
}

/** save / run を受け付けられる状態か（live かつ coding） */
function assertCodingMode(lesson) {
  if (lesson.status !== LESSON_STATUS.LIVE) throw new ApiError(409, ERROR_CODES.CONFLICT, NOT_LIVE_MESSAGE);
  if (lesson.mode !== LESSON_MODES.CODING) throw new ApiError(409, ERROR_CODES.NOT_CODING_MODE, NOT_CODING_MESSAGE);
}

// ---------------------------------------------------------------- API 本体

/**
 * POST /code/tasks/:task_id/save（生徒・先生）
 * 保存（code_documents 更新＋code_snapshots 追加）＋コンパイルのみ → SaveCodeResponse
 * 先生が生徒のコードを保存するときは target_user_id 必須・edited_by_teacher=true。生徒は target_user_id を付けられない
 * 実行サーバーが落ちていても保存は成功し、compile.status が runner_unavailable になる
 */
async function saveCode(access, user, input) {
  const { task, lesson, classRow, isTeacher } = access;
  assertCodingMode(lesson);
  const raw = input || {};
  const source = codeTasks.parseSource(raw.source);

  let targetUserId = user.id;
  let editedByTeacher = false;
  if (isTeacher) {
    const t = raw.target_user_id;
    if (!Number.isInteger(t) || t <= 0) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '先生が保存するときは target_user_id（保存先の生徒）が必要です');
    }
    const member = await query('SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ? LIMIT 1', [classRow.id, t]);
    if (!member.length) throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '指定したユーザーはこのクラスの生徒ではありません');
    targetUserId = t;
    editedByTeacher = true;
  } else if (raw.target_user_id !== undefined || raw.edited_by_teacher === true) {
    throw new ApiError(400, ERROR_CODES.BAD_REQUEST, '生徒は target_user_id を指定できません');
  }

  // コンパイル（待ち行列を通して実行サーバーの同時接続数を抑える）
  const compiled = await enqueue(lesson.id, () => compileSource(source)).promise;
  const compileOk = compiled.status === CODE_RUN_STATUS.OK;

  const snapshotId = await codeTasks.saveDocument(task.id, targetUserId, source, { compileOk, editedByTeacher });
  const run = await insertRun(task.id, targetUserId, CODE_RUN_KINDS.COMPILE, compiled);
  broadcastRun(lesson.id, run, compiled.errors);

  return { snapshot_id: snapshotId, compile: { status: compiled.status, errors: compiled.errors } };
}

/**
 * POST /code/tasks/:task_id/run（生徒）→ 202 RunCodeResponse。結果は code:run_result（kind run）
 * レート超過は 429 RATE_LIMITED、実行サーバー停止中は 503 RUNNER_UNAVAILABLE
 */
async function runCode(access, user, input) {
  const { task, lesson, isTeacher } = access;
  if (isTeacher) throw new ApiError(403, ERROR_CODES.FORBIDDEN, '実行は生徒だけができます');
  assertCodingMode(lesson);
  const raw = input || {};
  const source = codeTasks.parseSource(raw.source);
  let stdin = '';
  if (raw.stdin !== undefined && raw.stdin !== null) {
    if (typeof raw.stdin !== 'string') throw new ApiError(400, ERROR_CODES.BAD_REQUEST, 'stdin は文字列です');
    if (Buffer.byteLength(raw.stdin) > CODE_LIMITS.STDIN_MAX_BYTES) {
      throw new ApiError(400, ERROR_CODES.BAD_REQUEST, `標準入力は${CODE_LIMITS.STDIN_MAX_BYTES / 1024}KB 以内です`);
    }
    stdin = raw.stdin;
  }
  if (!isConfigured() || runnerState.available === false) {
    throw new ApiError(503, ERROR_CODES.RUNNER_UNAVAILABLE, RUNNER_DOWN_MESSAGE);
  }
  if (!takeRateSlot(user.id, task.id)) {
    throw new ApiError(429, ERROR_CODES.RATE_LIMITED, `実行は 1 分に${CODE_LIMITS.RUNS_PER_MINUTE}回までです`);
  }

  // run_id を先に確保する（結果が出るまでの仮の行。サーバー再起動で残った行は runner_unavailable のまま）
  const placeholder = { status: CODE_RUN_STATUS.RUNNER_UNAVAILABLE, stdout: null, stderr: null, exit_code: null, duration_ms: null };
  const pending = await insertRun(task.id, user.id, CODE_RUN_KINDS.RUN, placeholder);
  emitToTeachers(lesson.id, SERVER_EVENTS.CODE_STATUS, { task_id: task.id, user_id: user.id, state: CODE_STATES.RUNNING });

  const { position, promise } = enqueue(
    lesson.id,
    () => runSource(source, stdin),
    (pos) => emitToUser(lesson.id, user.id, SERVER_EVENTS.CODE_QUEUE, { position: pos })
  );
  promise
    .then((out) => updateRun(pending.run_id, out))
    .then((run) => broadcastRun(lesson.id, run))
    .catch((err) => console.error('code run でエラー:', err));

  return { run_id: pending.run_id, queued_position: position };
}

module.exports = {
  saveCode,
  runCode,
  checkHealth,
  getRunnerState,
  // テスト用・内部
  executeOnPiston,
  parseCompileErrors,
  interpretResult,
  truncateOutput,
  enqueue,
  getQueueState,
  takeRateSlot,
  resetRateLimit,
};
