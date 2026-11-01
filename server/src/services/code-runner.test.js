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
