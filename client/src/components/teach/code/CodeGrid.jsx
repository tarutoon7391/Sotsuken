// 先生用：コードグリッド（生徒ごとにコード先頭 20 行の縮小＋枠色＋最終保存時刻）— 担当：W5（F-10・docs/07 §15.2）
// props:
//   students:   UserBrief[]                           クラスの生徒（未着手の生徒もセルを出す）
//   docs:       { [userId]: CodeDocumentSummary & { line?: number } }   GET documents の結果に code:status / code:run_result を重ねたもの
//   onOpen:     (student) => void                     セルをクリック → 拡大パネル
//   spotlightUserId?: number|null                     コードスポットライト中の生徒
import { CODE_STATES } from '@sotsuken/shared/constants';
import Avatar from '../../shared/Avatar.jsx';
import { formatTime } from '../../shared/format.js';

export const STATE_LABELS = {
  [CODE_STATES.IDLE]: '未保存',
  [CODE_STATES.SYNTAX_ERROR]: '構文エラー',
  [CODE_STATES.COMPILE_ERROR]: 'コンパイルエラー',
  [CODE_STATES.RUNTIME_ERROR]: '実行時エラー',
  [CODE_STATES.OK]: '正常終了',
  [CODE_STATES.RUNNING]: '実行中',
};

/** 凡例（グリッドの上に出す） */
export function CodeLegend() {
  return (
    <div className="legend code-legend">
      {[CODE_STATES.SYNTAX_ERROR, CODE_STATES.COMPILE_ERROR, CODE_STATES.RUNTIME_ERROR, CODE_STATES.OK, CODE_STATES.RUNNING, CODE_STATES.IDLE].map((s) => (
        <span key={s}>
          <i className={`sw sw-code is-${s}`} />
          {STATE_LABELS[s]}
        </span>
      ))}
    </div>
  );
}

export default function CodeGrid({ students, docs, onOpen, spotlightUserId = null }) {
  if (!students.length) return <p className="tiny muted" style={{ margin: 0 }}>クラスに生徒がいません</p>;
  return (
    <div className="code-grid">
      {students.map((s) => {
        const d = docs[s.id];
        const state = (d && d.state) || CODE_STATES.IDLE;
        const isSpot = spotlightUserId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            className={`code-cell is-${state}${isSpot ? ' is-spot' : ''}`}
            onClick={() => onOpen(s)}
            title={`${s.name}：${STATE_LABELS[state]}${d && d.line ? `（${d.line} 行目）` : ''}`}
          >
            <div className="code-cell-head">
              <Avatar user={s} size={18} />
              <span className="code-cell-name">{s.name}</span>
              {isSpot && <span className="code-cell-spot">★</span>}
              <span className={`code-cell-state is-${state}`}>
                {state === CODE_STATES.OK ? '✓' : STATE_LABELS[state]}
                {d && d.line ? ` ${d.line}行` : ''}
              </span>
            </div>
            {/* コードは HTML として解釈させない（React のテキストとして描画） */}
            <pre className="code-cell-src">{d && d.source_head ? d.source_head : ''}</pre>
            <div className="code-cell-foot">{d && d.last_saved_at ? `保存 ${formatTime(d.last_saved_at)}` : '未保存'}</div>
          </button>
        );
      })}
    </div>
  );
}
