// 画面幅でスマホ表示かを判定する hook — 担当：W4
// デザイン（10_生徒画面_授業中）と同じく 700px 未満をスマホとする。
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 699px)';

export default function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
