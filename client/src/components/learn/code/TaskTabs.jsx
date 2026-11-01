// 課題タブ（先生が追加した順）— 担当：W4（F-10・docs/07 §15.1）。先生画面（W5）も同じ部品を使う
// props:
//   tasks:        CodeTask[]
//   selectedId:   number|null       いま開いているタブ
//   activeId:     number|null       先生が指定した「今の課題」（強調）
//   onSelect:     (taskId) => void
//   stateOf?:     (taskId) => string|undefined   タブに小さく出す状態（例「エラー」）
//   right?:       ReactNode         右端（先生用の「＋」など）
export default function TaskTabs({ tasks, selectedId, activeId, onSelect, stateOf, right }) {
  return (
    <div className="code-tabs" role="tablist">
      {tasks.length === 0 && <span className="code-tabs-empty">課題はまだありません</span>}
      {tasks.map((t) => {
        const note = stateOf ? stateOf(t.id) : null;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selectedId === t.id}
            className={`code-tab${selectedId === t.id ? ' is-selected' : ''}${activeId === t.id ? ' is-active' : ''}`}
            onClick={() => onSelect(t.id)}
            title={activeId === t.id ? '今の課題' : t.title}
          >
            {activeId === t.id && <span className="code-tab-now">今</span>}
            <span className="code-tab-title">{t.title}</span>
            {note && <span className="code-tab-note">{note}</span>}
          </button>
        );
      })}
      {right && <span className="code-tabs-right">{right}</span>}
    </div>
  );
}
