// 確認ダイアログ（一時退出・待機画面の退出）— 担当：W4
// props:
//   title, body:   string
//   confirmLabel:  string
//   busy?:         boolean   送信中（ボタンを押せなくする）
//   error?:        string    失敗したときの一文
//   onCancel, onConfirm: () => void
import { useEffect } from 'react';

export default function ConfirmDialog({ title, body, confirmLabel, busy = false, error, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="dialog-backdrop lr-backdrop" onClick={() => !busy && onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{body}</div>
        {error && <div className="lr-dialog-error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            キャンセル
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
