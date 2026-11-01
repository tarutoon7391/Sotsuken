// 先生用：課題タブ（追加「＋」・今の課題にする・テンプレート編集・全員に再配布）— 担当：W5（F-10・docs/07 §15.2）
// props:
//   tasks:        CodeTask[]
//   selectedId:   number|null
//   activeId:     number|null
//   isLive:       boolean
//   onSelect:     (taskId) => void
//   onCreate:     ({ title, template }) => Promise<void>
//   onUpdate:     (taskId, { title, template }) => Promise<void>
//   onActivate:   (taskId) => Promise<void>
//   onRedistribute: (taskId) => Promise<void>
import { useState } from 'react';
import { CODE_DEFAULT_TEMPLATE, CODE_LIMITS } from '@sotsuken/shared/constants';
import useEscape from '../../shared/useEscape.js';
import TaskTabs from '../../learn/code/TaskTabs.jsx';

/** 課題の作成／編集ダイアログ（タイトル＋テンプレート）。TeachPage の起動ダイアログも同じ部品を使う */
export function TaskDialog({ title: dialogTitle, initial, submitLabel, busy, error, onSubmit, onCancel, note }) {
  const [title, setTitle] = useState(initial ? initial.title : '');
  const [template, setTemplate] = useState(initial ? initial.template : CODE_DEFAULT_TEMPLATE);
  useEscape(busy ? null : onCancel);

  function submit(e) {
    e.preventDefault();
    onSubmit({ title: title.trim(), template });
  }

  return (
    <div className="dialog-backdrop">
      <form className="dialog code-task-dialog" role="dialog" aria-labelledby="codeTaskTitle" onSubmit={submit}>
        <div className="dialog-title" id="codeTaskTitle">{dialogTitle}</div>
        {note && <div className="dialog-body">{note}</div>}
        <label className="field">
          <span className="tiny">タイトル（{CODE_LIMITS.TASK_TITLE_MAX} 文字まで）</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={CODE_LIMITS.TASK_TITLE_MAX}
            placeholder="例：課題1 Hello"
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span className="tiny">テンプレート（生徒に最初に配るコード。空なら既定の Main 雛形）</span>
          <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={10} spellCheck={false} className="code-task-template" />
        </label>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>キャンセル</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>{busy ? '送信中…' : submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

export default function TaskManager({ tasks, selectedId, activeId, isLive, onSelect, onCreate, onUpdate, onActivate, onRedistribute }) {
  const [dialog, setDialog] = useState(null); // { kind: 'create' } | { kind: 'edit', task } | { kind: 'redistribute', task }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = tasks.find((t) => t.id === selectedId) || null;

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      setDialog(null);
    } catch (err) {
      setError(err.message || '失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="code-taskmgr">
      <TaskTabs
        tasks={tasks}
        selectedId={selectedId}
        activeId={activeId}
        onSelect={onSelect}
        right={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: 'create' })} title="課題を追加">＋ 課題</button>
        }
      />
      {selected && (
        <div className="code-taskmgr-actions">
          {activeId !== selected.id ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onActivate(selected.id)} disabled={!isLive} title={isLive ? '' : '授業中のみ'}>
              今の課題にする
            </button>
          ) : (
            <span className="tiny muted">今の課題（生徒のエディタはこのタブ）</span>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: 'edit', task: selected })}>テンプレート編集</button>
          <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => setDialog({ kind: 'redistribute', task: selected })} disabled={!isLive}>
            全員に再配布
          </button>
        </div>
      )}

      {dialog && dialog.kind === 'create' && (
        <TaskDialog
          title="課題を追加"
          submitLabel="追加する"
          busy={busy}
          error={error}
          onCancel={() => setDialog(null)}
          onSubmit={(input) => run(() => onCreate(input))}
        />
      )}
      {dialog && dialog.kind === 'edit' && (
        <TaskDialog
          title="課題を編集"
          initial={dialog.task}
          submitLabel="保存する"
          note="テンプレートを変えても、生徒が書いたコードはそのままです（配り直すときは「全員に再配布」）。"
          busy={busy}
          error={error}
          onCancel={() => setDialog(null)}
          onSubmit={(input) => run(() => onUpdate(dialog.task.id, input))}
        />
      )}
      {dialog && dialog.kind === 'redistribute' && (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-labelledby="codeRedistTitle">
            <div className="dialog-title" id="codeRedistTitle">「{dialog.task.title}」を全員に再配布しますか？</div>
            <div className="dialog-body">全生徒のこの課題のコードがテンプレートで上書きされます。生徒が書いた内容は消えます（保存履歴は残ります）。</div>
            {error && <p className="form-alert" role="alert">{error}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)} disabled={busy}>キャンセル</button>
              <button type="button" className="btn btn-primary btn-accent-2" onClick={() => run(() => onRedistribute(dialog.task.id))} disabled={busy}>
                {busy ? '配布中…' : '上書きして配布する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
