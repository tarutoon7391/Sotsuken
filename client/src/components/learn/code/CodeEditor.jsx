// Java のコードエディタ（CodeMirror 6）— 担当：W4（F-10・docs/07 §15.1）
// props:
//   value:          string                 初期値。外から値を差し替えたいときは key を変えて作り直す（課題切替・再配布）
//   onChange?:      (source: string) => void
//   onSave?:        () => void             Ctrl+S / ⌘S
//   onSyntax?:      ({ hasError: boolean, line: number|null }) => void
//                   Lezer の構文解析でエラー節点があるか。CODE_LIMITS.SYNTAX_DEBOUNCE_MS のデバウンス後に呼ぶ（毎回呼ぶ。変化判定は呼び出し側）
//   compileErrors?: { line, col, message }[]  保存時のコンパイルエラー。該当行に赤い印を付ける
//   readOnly?:      boolean
//   compact?:       boolean                縮小表示（先生のコードグリッド・スポットライト）
//   className?:     string
// 先生の共同編集（Yjs）は段階 2 で client/src/lib/yjs-provider.js を差し込む。段階 1 はローカルの state だけ。
import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { java } from '@codemirror/lang-java';
import { syntaxTree } from '@codemirror/language';
import { linter, setDiagnostics } from '@codemirror/lint';
import { indentWithTab } from '@codemirror/commands';
import { CODE_LIMITS } from '@sotsuken/shared/constants';

/** Lezer の木からエラー節点を集めて lint の診断にする */
function syntaxDiagnostics(state) {
  const diags = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (!node.type.isError) return;
      diags.push({
        from: node.from,
        to: Math.min(state.doc.length, Math.max(node.to, node.from + 1)),
        severity: 'error',
        message: '構文エラー',
      });
    },
  });
  return diags;
}

/** コンパイルエラー（行・桁）→ lint の診断 */
function compileDiagnostics(state, errors) {
  const diags = [];
  for (const e of errors || []) {
    if (!Number.isInteger(e.line) || e.line < 1 || e.line > state.doc.lines) continue;
    const line = state.doc.line(e.line);
    const col = Number.isInteger(e.col) && e.col > 0 ? Math.min(e.col - 1, line.length) : 0;
    diags.push({
      from: line.from + col,
      to: col < line.length ? line.from + col + 1 : line.to,
      severity: 'error',
      message: e.message || 'コンパイルエラー',
    });
  }
  return diags;
}

export default function CodeEditor({
  value,
  onChange,
  onSave,
  onSyntax,
  compileErrors,
  readOnly = false,
  compact = false,
  className = '',
}) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  // コールバックは ref 経由で呼ぶ（エディタを作り直さずに最新の関数を使う）
  const cb = useRef({ onChange, onSave, onSyntax });
  cb.current = { onChange, onSave, onSyntax };

  useEffect(() => {
    const extensions = [
      basicSetup,
      java(),
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            if (cb.current.onSave) cb.current.onSave();
            return true;
          },
        },
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && cb.current.onChange) cb.current.onChange(update.state.doc.toString());
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: compact ? '11px' : '13px' },
        '.cm-scroller': { fontFamily: '"Cascadia Code", "Consolas", "Menlo", monospace', overflow: 'auto' },
      }),
    ];
    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
    } else {
      // 構文エラーの検出（打っている最中からリアルタイム。デバウンス後に onSyntax）
      extensions.push(
        linter(
          (view) => {
            const diags = syntaxDiagnostics(view.state);
            if (cb.current.onSyntax) {
              cb.current.onSyntax({
                hasError: diags.length > 0,
                line: diags.length ? view.state.doc.lineAt(diags[0].from).number : null,
              });
            }
            return diags;
          },
          { delay: CODE_LIMITS.SYNTAX_DEBOUNCE_MS }
        )
      );
    }

    const view = new EditorView({
      state: EditorState.create({ doc: value || '', extensions }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // value は初期値だけに使う（差し替えは key で作り直す）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, compact]);

  // 保存時のコンパイルエラーを行に印として出す（次に打ち直すと構文チェックの結果に置き換わる）
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !compileErrors) return;
    view.dispatch(setDiagnostics(view.state, compileDiagnostics(view.state, compileErrors)));
  }, [compileErrors]);

  return <div ref={hostRef} className={`code-editor${compact ? ' is-compact' : ''}${readOnly ? ' is-readonly' : ''} ${className}`} />;
}
