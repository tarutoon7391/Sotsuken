// Esc キーで閉じる（ダイアログ用）— 担当：W5
// 使い方：useEscape(onClose);  onClose が無いときは何もしない
import { useEffect } from 'react';

export default function useEscape(onClose) {
  useEffect(() => {
    if (!onClose) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
}
