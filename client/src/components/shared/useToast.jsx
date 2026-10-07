// 画面上部に数秒だけ出す通知 — 担当：W5
// 使い方：const [toast, showToast] = useToast();  showToast('保存しました');  …JSX に {toast} を置く
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useToast(durationMs = 2400) {
  const [text, setText] = useState('');
  const timer = useRef(null);

  const show = useCallback(
    (message) => {
      setText(message);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setText(''), durationMs);
    },
    [durationMs]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const node = text ? (
    <div className="toast" role="status">
      {text}
    </div>
  ) : null;
  return [node, show];
}
