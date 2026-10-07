// 確認ポップアップ — 担当：W4（デザイン：docs/design/10_生徒画面_授業中 の data-check）
// LearnPage の上に重ねる。attention:check を受けたら表示し、締切までカウントダウンする。
// props:
//   check:     { check_id, deadline_at }   attention:check のペイロード
//   onRespond: (checkId) => void           「確認」を押した（attention:respond を送る）
//   onTimeout: () => void                  締切を過ぎた（トーストを出して閉じる）
import { useEffect, useRef, useState } from 'react';
import { DEFAULTS } from '@sotsuken/shared/constants';

/** 締切までの残り秒数。端末の時計がずれていて 0 以下なら既定の猶予秒を使う */
function initialSeconds(deadlineAt) {
  const left = Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000);
  if (!Number.isFinite(left) || left <= 0) return DEFAULTS.ATTENTION_TIMEOUT_SEC;
  return left;
}

export default function AttentionModal({ check, onRespond, onTimeout }) {
  const [sec, setSec] = useState(() => initialSeconds(check.deadline_at));
  const buttonRef = useRef(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    // 受け取った時点からの経過で数える（端末の時計のずれに影響されない）
    const total = initialSeconds(check.deadline_at);
    const startedAt = Date.now();
    setSec(total);
    const timer = setInterval(() => {
      const left = total - Math.floor((Date.now() - startedAt) / 1000);
      if (left <= 0) {
        clearInterval(timer);
        onTimeoutRef.current();
      } else {
        setSec(left);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [check.check_id, check.deadline_at]);

  useEffect(() => {
    if (buttonRef.current) buttonRef.current.focus();
  }, [check.check_id]);

  return (
    <div className="dialog-backdrop lr-backdrop is-check">
      <div className="dialog elev-lg lr-dialog-check" role="alertdialog" aria-modal="true" aria-labelledby="lr-check-title">
        <div className="lr-check-kicker">先生からの確認</div>
        <div className="dialog-title" id="lr-check-title">今、画面を見ていますか？</div>
        <div className={`lr-check-sec${sec <= 10 ? ' is-low' : ''}`} aria-live="polite">
          {sec}
        </div>
        <button ref={buttonRef} type="button" className="btn btn-primary" onClick={() => onRespond(check.check_id)}>
          確認
        </button>
      </div>
    </div>
  );
}
