// 確認ポップアップ — 担当：W4（デザイン：docs/design/10_生徒画面_授業中 の data-check）
// LearnPage の上に重ねる。attention:check を受けたら表示し、締切までカウントダウンする。
// props:
//   check:     { check_id, issued_at, deadline_at, receivedAt }   attention:check のペイロード＋受信した端末時刻
//   busy:      boolean                 応答を送って ack 待ち（ボタンを押せなくし、時間切れにしない）
//   onRespond: (checkId) => void       「確認」を押した（attention:respond を送る。結果は ack で親が判断）
//   onTimeout: (checkId) => void       時間切れ（トーストを出して閉じる）
//
// 秒数は「issued_at〜deadline_at の長さ（どちらもサーバーの時計）」を受信した時点から数える。
// 端末の時計がずれていても早く閉じたり締切後も残ったりしない（v4.3）。最終的な判定はサーバー（CHECK_EXPIRED）。
import { useEffect, useRef, useState } from 'react';
import { DEFAULTS } from '@sotsuken/shared/constants';

/** 応答の猶予（秒）。issued_at が無い古いサーバーでは既定値を使う */
function totalSeconds(check) {
  const issued = new Date(check.issued_at).getTime();
  const deadline = new Date(check.deadline_at).getTime();
  const sec = Math.round((deadline - issued) / 1000);
  return Number.isFinite(sec) && sec > 0 ? sec : DEFAULTS.ATTENTION_TIMEOUT_SEC;
}

export default function AttentionModal({ check, busy = false, onRespond, onTimeout }) {
  const total = totalSeconds(check);
  const startedAt = check.receivedAt || Date.now();
  const [sec, setSec] = useState(() => Math.max(0, total - Math.floor((Date.now() - startedAt) / 1000)));
  const buttonRef = useRef(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    const timer = setInterval(() => {
      const left = total - Math.floor((Date.now() - startedAt) / 1000);
      if (left > 0) {
        setSec(left);
        return;
      }
      setSec(0);
      // 応答を送った後はサーバーの結果（ack）を待つ
      if (!busyRef.current) {
        clearInterval(timer);
        onTimeoutRef.current(check.check_id);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [check.check_id, total, startedAt]);

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
        <button
          ref={buttonRef}
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => onRespond(check.check_id)}
        >
          {busy ? '送信中…' : '確認'}
        </button>
      </div>
    </div>
  );
}
