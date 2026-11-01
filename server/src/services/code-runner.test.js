// F-10 実行サーバー連携の単体テスト（DB 不要）— 担当：W2
// Piston の結果の解釈・javac のエラー行の抽出・待ち行列・レート制限を確かめる。Socket は io をモック。
jest.mock('../sockets/io', () => ({
  emitToLesson: jest.fn(),
  emitToTeachers: jest.fn(),
  emitToStudents: jest.fn(),
  emitToUser: jest.fn(),
  getIo: () => null,
  setIo: () => {},
}));

const { CODE_LIMITS, CODE_RUN_STATUS } = require('@sotsuken/shared/constants');
const runner = require('./code-runner');

describe('parseCompileErrors（javac の stderr）', () => {
  test('行番号・桁・メッセージを取り出す', () => {
    const stderr = [
      "Main.java:3: error: ';' expected",
      '        System.out.println("Hello")',
      '                                   ^',
      '1 error',
      '',
    ].join('\n');
    expect(runner.parseCompileErrors(stderr)).toEqual([{ line: 3, col: 36, message: "';' expected" }]);
  });

  test('ディレクトリ付きのパスでも拾う。ラッパー（Compile.java）のエラーは無視する', () => {
    const stderr = [
      '/piston/jobs/abc/Main.java:1: error: class Foo is public, should be declared in a file named Foo.java',
      'public class Foo {',
      '       ^',
      'Compile.java:1: error: something',
      '2 errors',
    ].join('\n');
    const errors = runner.parseCompileErrors(stderr);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
    expect(errors[0].col).toBe(8);
  });

  test('空なら空配列', () => {
    expect(runner.parseCompileErrors('')).toEqual([]);
    expect(runner.parseCompileErrors(null)).toEqual([]);
  });
});

describe('interpretResult（Piston の結果）', () => {
  test('接続できなければ runner_unavailable', () => {
    expect(runner.interpretResult(null, { compileOnly: false }).status).toBe(CODE_RUN_STATUS.RUNNER_UNAVAILABLE);
  });

  test('compile 段階の失敗は compile_error（保存・実行とも）', () => {
    const result = { compile: { code: 1, stdout: '', stderr: "Main.java:3: error: ';' expected" }, run: null };
    expect(runner.interpretResult(result, { compileOnly: true }).status).toBe(CODE_RUN_STATUS.COMPILE_ERROR);
    expect(runner.interpretResult(result, { compileOnly: false }).status).toBe(CODE_RUN_STATUS.COMPILE_ERROR);
  });

  test('保存（コンパイルのみ）は compile が通れば ok。run 段階は見ない', () => {
    const result = { compile: { code: 0, stdout: '', stderr: '' }, run: { code: 0, stdout: '', stderr: '' } };
    const out = runner.interpretResult(result, { compileOnly: true });
    expect(out.status).toBe(CODE_RUN_STATUS.OK);
    expect(out.stdout).toBeNull();
  });

  test('実行：exit 0 は ok、exit ≠ 0 は runtime_error、SIGKILL は timeout', () => {
    const base = { compile: { code: 0, stdout: '', stderr: '' } };
    expect(runner.interpretResult({ ...base, run: { code: 0, stdout: 'Hello\n', stderr: '' } }, { compileOnly: false })).toMatchObject({
      status: CODE_RUN_STATUS.OK,
      stdout: 'Hello\n',
      exit_code: 0,
    });
    expect(
      runner.interpretResult({ ...base, run: { code: 1, stdout: '', stderr: 'Exception in thread "main"' } }, { compileOnly: false }).status
    ).toBe(CODE_RUN_STATUS.RUNTIME_ERROR);
    expect(
      runner.interpretResult({ ...base, run: { code: null, signal: 'SIGKILL', stdout: '', stderr: '' } }, { compileOnly: false }).status
    ).toBe(CODE_RUN_STATUS.TIMEOUT);
  });

  test('stdout は OUTPUT_MAX_BYTES で切り詰める', () => {
    const big = 'a'.repeat(CODE_LIMITS.OUTPUT_MAX_BYTES + 100);
    const out = runner.truncateOutput(big);
    expect(Buffer.byteLength(out)).toBeLessThan(CODE_LIMITS.OUTPUT_MAX_BYTES + 100);
    expect(out).toContain('省略');
    expect(runner.truncateOutput('short')).toBe('short');
  });
});

describe('executeOnPiston（公開 API の上限で 400 → 控えめな値で再送）', () => {
  const config = require('../config');
  const files = [{ name: 'Main.java', content: 'public class Main {}' }];
  let prevUrl;
  beforeEach(() => {
    prevUrl = config.codeRunnerUrl;
    config.codeRunnerUrl = 'http://piston.test/api/v2';
  });
  afterEach(() => {
    config.codeRunnerUrl = prevUrl;
    delete global.fetch;
  });

  test('1 回目が 400（run_timeout 超過）なら、timeout を縮めて 2 回目を送る', async () => {
    const bodies = [];
    global.fetch = jest.fn(async (url, init) => {
      bodies.push(JSON.parse(init.body));
      if (bodies.length === 1) {
        return { ok: false, status: 400, text: async () => JSON.stringify({ message: 'run_timeout cannot exceed 3000ms' }) };
      }
      return { ok: true, json: async () => ({ compile: { code: 0, stdout: '', stderr: '' }, run: { code: 0, stdout: 'Hello\n', stderr: '' } }) };
    });
    const result = await runner.executeOnPiston(files, '');
    expect(result.run.stdout).toBe('Hello\n');
    expect(bodies).toHaveLength(2);
    expect(bodies[0].run_timeout).toBe(CODE_LIMITS.CPU_TIMEOUT_MS);
    expect(bodies[1].run_timeout).toBe(3000);
    expect(bodies[1].run_memory_limit).toBeUndefined();
    // 4xx では死活状態を down にしない
    expect(runner.getRunnerState().available).toBe(true);
  });

  test('2 回とも 400 なら理由付きの error を返し、interpretResult は runner_unavailable にする', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ message: 'version not found' }) }));
    const result = await runner.executeOnPiston(files, '');
    expect(result.error).toContain('version not found');
    const out = runner.interpretResult(result, { compileOnly: false });
    expect(out.status).toBe(CODE_RUN_STATUS.RUNNER_UNAVAILABLE);
    expect(out.stderr).toContain('version not found');
  });

  test('ネットワークエラーは null（down 扱い）', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(await runner.executeOnPiston(files, '')).toBeNull();
    expect(runner.getRunnerState().available).toBe(false);
  });
});

describe('待ち行列（授業ごと・同時 CONCURRENT_RUNS）', () => {
  test('同時実行数を超えた分は待ち、順番が来ると position 0 で始まる', async () => {
    const lessonId = 9001;
    const resolvers = [];
    const positions = [];
    const items = [];
    for (let i = 0; i < CODE_LIMITS.CONCURRENT_RUNS + 2; i += 1) {
      const seen = [];
      positions.push(seen);
      items.push(
        runner.enqueue(
          lessonId,
          () => new Promise((resolve) => resolvers.push(() => resolve(i))),
          (pos) => seen.push(pos)
        )
      );
    }
    // 先頭 N 本は即実行（position 0）、残りは 1, 2
    for (let i = 0; i < CODE_LIMITS.CONCURRENT_RUNS; i += 1) expect(items[i].position).toBe(0);
    expect(items[CODE_LIMITS.CONCURRENT_RUNS].position).toBe(1);
    expect(items[CODE_LIMITS.CONCURRENT_RUNS + 1].position).toBe(2);
    expect(runner.getQueueState(lessonId)).toEqual({ running: CODE_LIMITS.CONCURRENT_RUNS, waiting: 2 });
    // job の起動は非同期（マイクロタスク）なので resolver が揃うのを待つ
    await new Promise((r) => setImmediate(r));
    expect(resolvers).toHaveLength(CODE_LIMITS.CONCURRENT_RUNS);

    // 1 本終わると次が始まり、残りの順番が 1 に繰り上がる
    resolvers[0]();
    await items[0].promise;
    await new Promise((r) => setImmediate(r));
    expect(runner.getQueueState(lessonId)).toEqual({ running: CODE_LIMITS.CONCURRENT_RUNS, waiting: 1 });
    expect(positions[CODE_LIMITS.CONCURRENT_RUNS]).toEqual([1, 0]);
    expect(positions[CODE_LIMITS.CONCURRENT_RUNS + 1]).toEqual([2, 1]);

    // 全部終わらせる（終わるたびに次が始まって resolver が増えるので、1 本ずつ）
    let done = 1;
    while (done < items.length) {
      await new Promise((r) => setImmediate(r));
      if (resolvers.length > done) {
        resolvers[done]();
        done += 1;
      }
    }
    await Promise.all(items.map((it) => it.promise));
    await new Promise((r) => setImmediate(r));
    expect(runner.getQueueState(lessonId)).toEqual({ running: 0, waiting: 0 });
  });

  test('失敗した job は reject され、次の job は止まらない', async () => {
    const lessonId = 9002;
    const a = runner.enqueue(lessonId, () => Promise.reject(new Error('boom')));
    await expect(a.promise).rejects.toThrow('boom');
    const b = runner.enqueue(lessonId, () => Promise.resolve('ok'));
    await expect(b.promise).resolves.toBe('ok');
  });
});

describe('レート制限（ユーザー×課題で 1 分 RUNS_PER_MINUTE 回）', () => {
  beforeEach(() => runner.resetRateLimit());

  test('上限までは通り、超えると拒否。1 分経つとまた通る', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < CODE_LIMITS.RUNS_PER_MINUTE; i += 1) expect(runner.takeRateSlot(1, 10, t0 + i)).toBe(true);
    expect(runner.takeRateSlot(1, 10, t0 + 100)).toBe(false);
    // 別の課題・別のユーザーは影響しない
    expect(runner.takeRateSlot(1, 11, t0 + 100)).toBe(true);
    expect(runner.takeRateSlot(2, 10, t0 + 100)).toBe(true);
    // 60 秒後
    expect(runner.takeRateSlot(1, 10, t0 + 60 * 1000 + 1)).toBe(true);
  });
});
