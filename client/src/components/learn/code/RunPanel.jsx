// 保存・実行の操作列（保存ボタン・▶ 実行・stdin 入力欄・実行待ち表示・状態）— 担当：W4（F-10・docs/07 §15.1）
// props:
//   status:       { text, tone }     いまの状態（未保存／構文エラー／実行待ち N 人 など）
//   saving:       boolean
//   running:      boolean
//   queued:       number|null        実行待ちの順番（0 なら実行中、null なら待っていない）
//   stdin:        string
//   onStdin:      (text) => void
//   onSave:       () => void
//   onRun:        () => void
//   disabled?:    boolean            再接続中など
//   mobile?:      boolean
import { useState } from 'react';

export default function RunPanel({ status, saving, running, queued, stdin, onStdin, onSave, onRun, disabled = false, mobile = false }) {
  const [stdinOpen, setStdinOpen] = useState(false);

  return (
    <div className={`code-run${mobile ? ' is-mobile' : ''}`}>
      <div className="code-run-row">
        <span className={`code-state is-${status.tone}`}>
          <i className="code-state-dot" />
          {status.text}
        </span>
        {queued != null && queued > 0 && <span className="code-queue">実行待ち {queued} 人</span>}
        <span className="code-run-spacer" />
        <button type="button" className={`btn btn-ghost btn-sm code-stdin-toggle${stdinOpen ? ' is-on' : ''}`} onClick={() => setStdinOpen((v) => !v)}>
          標準入力{stdin ? '●' : ''}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onSave} disabled={disabled || saving} title="Ctrl+S / ⌘S">
          {saving ? '保存中…' : '保存'}
        </button>
        <button type="button" className="btn btn-primary btn-sm code-run-btn" onClick={onRun} disabled={disabled || running}>
          {running ? (queued ? '実行待ち…' : '実行中…') : '▶ 実行'}
        </button>
      </div>
      {stdinOpen && (
        <label className="code-stdin">
          <span className="tiny muted">標準入力（プログラムが読み取る内容。1 行ずつ）</span>
          <textarea value={stdin} onChange={(e) => onStdin(e.target.value)} rows={3} spellCheck={false} placeholder="例：3&#10;Taro" />
        </label>
      )}
    </div>
  );
}
