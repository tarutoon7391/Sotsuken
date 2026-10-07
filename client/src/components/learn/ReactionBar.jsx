// 理解リアクション3ボタン＋質問（挙手）ボタン — 担当：W4
// props:
//   selected:  'understood'|'confused'|'again'|null   選択中（understanding:reset で null に戻す）
//   onReact:   (type) => void                         understanding:send
//   hand:      boolean                                挙手中か
//   onHand:    () => void                             挙手のトグル
//   feedback:  string                                 ボタン下の一文
//   mobile?:   boolean                                スマホの下部固定（3ボタン＋横長の挙手ボタン）
import { useEffect, useState } from 'react';
import { UNDERSTANDING_TYPES } from '@sotsuken/shared/constants';
import Icon from './Icon.jsx';

export const REACTIONS = [
  { type: UNDERSTANDING_TYPES.UNDERSTOOD, label: 'わかった', cls: 'is-got' },
  { type: UNDERSTANDING_TYPES.CONFUSED, label: 'わからない', cls: 'is-lost' },
  { type: UNDERSTANDING_TYPES.AGAIN, label: 'もう一度', cls: 'is-again' },
];

export default function ReactionBar({ selected, onReact, hand, onHand, feedback, mobile = false }) {
  // 押した瞬間だけ少し弾ませる
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 300);
    return () => clearTimeout(t);
  }, [flash]);

  const buttons = REACTIONS.map((r) => (
    <button
      key={r.type}
      type="button"
      className={`lr-react ${r.cls}${selected === r.type ? ' is-active' : ''}${flash === r.type ? ' is-flash' : ''}`}
      aria-pressed={selected === r.type}
      onClick={() => {
        setFlash(r.type);
        onReact(r.type);
      }}
    >
      {r.label}
    </button>
  ));

  const handButton = (
    <button type="button" className={`lr-hand${hand ? ' is-on' : ''}`} aria-pressed={hand} onClick={onHand}>
      <span className="lr-hand-main">
        <Icon name="hand" size={20} />
        {hand ? '挙手中' : '質問する'}
      </span>
      <span className="lr-hand-help">{hand ? '先生に伝わっています' : '先生に手を挙げる'}</span>
    </button>
  );

  if (mobile) {
    return (
      <div className="lr-dock">
        <div className="lr-reactions">{buttons}</div>
        {handButton}
        <div className="lr-feedback">{feedback}</div>
      </div>
    );
  }
  return (
    <>
      <div className="lr-reactions">
        {buttons}
        {handButton}
      </div>
      <div className="lr-feedback">{feedback}</div>
    </>
  );
}
