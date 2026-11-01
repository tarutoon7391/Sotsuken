// 先生用：拡大パネル（1 人の生徒のコード・出力・直近の runs・コードスポットライト）— 担当：W5（F-10・docs/07 §15.2）
// 段階 1 は読み取り専用。段階 2 で Yjs により編集可（先生カーソル・teacher_editing バッジ）にする。
// props:
//   task:        CodeTask
//   student:     UserBrief
//   latestRun:   CodeRun|null        親が code:run_result で受けた直近の結果（開いている間の更新用）
//   isSpotlight: boolean
//   isLive:      boolean
//   onSpotlight: (userId|null) => void
//   onClose:     () => void
import { useEffect, useState } from 'react';
import { CODE_RUN_KINDS } from '@sotsuken/shared/constants';
import { get } from '../../../api/client.js';
import useEscape from '../../shared/useEscape.js';
import { formatTime } from '../../shared/format.js';
import CodeEditor from '../../learn/code/CodeEditor.jsx';
import OutputPanel, { runLabel } from '../../learn/code/OutputPanel.jsx';

export default function CodeInspector({ task, student, latestRun, isSpotlight, isLive, onSpotlight, onClose }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0); // 取り直しのたびにエディタを作り直す
  useEscape(onClose);

  // 開いたとき・結果が届いたときに取り直す（コードは保存のたびに変わる）
  useEffect(() => {
    let alive = true;
    get(`/code/tasks/${task.id}/documents/${student.id}`, undefined, { redirect: false })
      .then((d) => {
        if (!alive) return;
        setDoc(d);
        setError('');
        setVersion((v) => v + 1);
      })
      .catch((err) => alive && setError(err.message || '読み込めませんでした'));
    return () => {
      alive = false;
    };
  }, [task.id, student.id, latestRun]);

  const run = doc && doc.runs && doc.runs.length ? doc.runs[0] : null;
  const compileErrors = run && run.kind === CODE_RUN_KINDS.COMPILE ? parseErrorsFromStderr(run.stderr) : [];

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog code-inspector" role="dialog" aria-labelledby="codeInspectorTitle" onClick={(e) => e.stopPropagation()}>
        <div className="code-inspector-head">
          <div className="dialog-title" id="codeInspectorTitle">
            {student.name} <span className="tiny muted">／ {task.title}</span>
          </div>
          <span className="tiny muted">{doc && doc.last_saved_at ? `最終保存 ${formatTime(doc.last_saved_at)}` : '未保存'}</span>
          <span className="hdr-spacer" />
          {isSpotlight ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSpotlight(null)}>★ 全員への表示を解除</button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onSpotlight(student.id)} disabled={!isLive}>
              ★ この生徒を全員に表示
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>閉じる</button>
        </div>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <div className="code-inspector-body">
          <div className="code-inspector-editor">
            {doc ? <CodeEditor key={`${student.id}-${version}`} value={doc.source} compileErrors={compileErrors} readOnly /> : <p className="page-loading">読み込み中…</p>}
          </div>
          <div className="code-inspector-side">
            <OutputPanel run={run} compileErrors={compileErrors} compact />
            <div className="code-runs">
              <h6 className="section-label">直近の結果</h6>
              {doc && doc.runs && doc.runs.length === 0 && <p className="tiny muted" style={{ margin: 0 }}>まだ保存・実行していません</p>}
              <ul>
                {(doc ? doc.runs : []).map((r) => {
                  const l = runLabel(r);
                  return (
                    <li key={r.run_id}>
                      <span className="tiny muted">{formatTime(r.created_at)}</span>
                      <span className="tiny">{r.kind === CODE_RUN_KINDS.RUN ? '実行' : '保存'}</span>
                      <span className={`code-output-status is-${l.tone}`}>{l.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
        <p className="tiny muted code-inspector-note">段階 1 は読み取り専用です。先生による直接編集（共同編集）は段階 2 で追加します。</p>
      </div>
    </div>
  );
}

/** 保存（コンパイル）の stderr から行番号を拾う（サーバーと同じ javac の形式。拡大パネルの行マーク用） */
export function parseErrorsFromStderr(stderr) {
  const errors = [];
  if (!stderr) return errors;
  const lines = String(stderr).split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/Main\.java:(\d+): error: (.*)$/);
    if (!m) continue;
    const caret = lines[i + 2];
    const col = caret && /^\s*\^\s*$/.test(caret) ? caret.indexOf('^') + 1 : null;
    errors.push({ line: Number(m[1]), col, message: m[2].trim() });
  }
  return errors;
}
