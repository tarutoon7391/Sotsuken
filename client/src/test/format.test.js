// 表示整形の単体テスト（vitest の動作確認を兼ねる）
import { describe, it, expect } from 'vitest';
import { formatDuration, formatBytes, formatJoinCode } from '../components/shared/format';

describe('formatDuration', () => {
  it('1時間未満は m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
  });
  it('1時間以上は h:mm:ss', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });
  it('不正値は 0:00', () => {
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration('x')).toBe('0:00');
  });
});

describe('formatBytes', () => {
  it('単位を切り替える', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0MB');
  });
});

describe('formatJoinCode', () => {
  it('8桁ならハイフンを入れる', () => {
    expect(formatJoinCode('ABCD2345')).toBe('ABCD-2345');
    expect(formatJoinCode('ABC')).toBe('ABC');
  });
});
