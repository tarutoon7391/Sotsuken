// 出力パネル（stdout / stderr タブ・終了コード・実行時間・コンパイルエラー一覧）— 担当：W4（F-10・docs/07 §15.1）
// 先生の拡大パネル（W5）も同じ部品を使う。
// props:
//   run:           CodeRun|null            直近のコンパイル／実行の結果（code:run_result と同じ形）
//   compileErrors: {line,col,message}[]    保存時のコンパイルエラー（run.status が compile_error のとき）
//   onJumpLine?:   (line) => void          エラー行をクリックしたとき
//   compact?:      boolean
import { useEffect, useState } from 'react';
import { CODE_RUN_KINDS, CODE_RUN_STATUS } from '@sotsuken/shared/constants';

/** 結果 → 見出しの文言と色クラス */
export function runLabel(run) {
  if (!run) return { text: '', tone: 'idle' };
  const isRun = run.kind === CODE_RUN_KINDS.RUN;
  switch (run.status) {
    case CODE_RUN_STATUS.OK:
      return isRun ? { text: '正常終了', tone: 'ok' } : { text: 'コンパイル成功', tone: 'ok' };
    case CODE_RUN_STATUS.COMPILE_ERROR:
      return { text: 'コンパイルエラー', tone: 'error' };
    case CODE_RUN_STATUS.RUNTIME_ERROR:
      return { text: '実行時エラー', tone: 'warn' };
    case CODE_RUN_STATUS.TIMEOUT:
      return { text: '時間切れ（CPU 10 秒）', tone: 'warn' };
    case CODE_RUN_STATUS.RUNNER_UNAVAILABLE:
      return { text: '実行サーバーに接続できません', tone: 'idle' };
    default:
      return { text: run.status, tone: 'idle' };
  }
}

export default function OutputPanel({ run, compileErrors, onJumpLine, compact = false }) {
  const [tab, setTab] = useState('stdout');
  const label = runLabel(run);
  const errors = run && run.status === CODE_RUN_STATUS.COMPILE_ERROR ? compileErrors || [] : [];

  // 結果が来るたびに、中身のある方のタブを開く
  useEffect(() => {
    if (!run) return;
    if (run.status === CODE_RUN_STATUS.OK) setTab('stdout');
    else if (run.stderr) setTab('stderr');
  }, [run]);

  const text = tab === 'stdout' ? run && run.stdout : run && run.stderr;

  return (
    <div className={`code-output${compact ? ' is-compact' : ''}`}>
      <div className="code-output-head">
        <div className="code-tabs code-tabs-sm" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'stdout'} className={`code-tab${tab === 'stdout' ? ' is-selected' : ''}`} onClick={() => setTab('stdout')}>
            出力
          </button>
          <button type="button" role="tab" aria-selected={tab === 'stderr'} className={`code-tab${tab === 'stderr' ? ' is-selected' : ''}`} onClick={() => setTab('stderr')}>
            エラー {run && run.stderr && run.status !== CODE_RUN_STATUS.OK ? <span className="code-dot is-error" /> : null}
          </button>
        </div>
        {run && (
          <span className={`code-output-status is-${label.tone}`}>
            {label.text}
            {run.exit_code != null && run.kind === CODE_RUN_KINDS.RUN && <span className="code-output-meta">exit {run.exit_code}</span>}
            {run.duration_ms != null && <span className="code-output-meta">{(run.duration_ms / 1000).toFixed(1)} 秒</span>}
          </span>
        )}
      </div>
      {errors.length > 0 && (
        <ul className="code-output-errors">
          {errors.map((e, i) => (
            <li key={`${e.line}-${i}`}>
              <button type="button" className="code-output-errline" onClick={() => onJumpLine && onJumpLine(e.line)}>
                {e.line} 行目{e.col ? `・${e.col} 桁` : ''}
              </button>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      )}
      <pre className="code-output-body">{run ? text || (tab === 'stdout' ? '（出力なし）' : '（エラーなし）') : '保存（Ctrl+S）でコンパイル、▶ で実行します'}</pre>
    </div>
  );
}
