// カメラの使用がブラウザで拒否されているかを調べる hook — 担当：W4
// 待機画面で「ブラウザでカメラを許可してください」の案内を出すために使う（docs/design/09 の camDenied）。
// Permissions API が無いブラウザでは常に false（W3 の StudentCamera が出すエラー文に任せる）。
// 戻り値：[denied: boolean, retry: () => Promise<void>]
//   retry はカメラを一度だけ取得して許可を求め直す（取れたらすぐ止める）
import { useCallback, useEffect, useState } from 'react';

export default function useCameraDenied() {
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!navigator.permissions || !navigator.permissions.query) return undefined;
    let alive = true;
    let status = null;
    navigator.permissions
      .query({ name: 'camera' })
      .then((s) => {
        if (!alive) return;
        status = s;
        setDenied(s.state === 'denied');
        s.onchange = () => setDenied(s.state === 'denied');
      })
      .catch(() => {}); // 'camera' を問い合わせできないブラウザ（判定できないので案内は出さない）
    return () => {
      alive = false;
      if (status) status.onchange = null;
    };
  }, []);

  const retry = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      setDenied(false);
    } catch (err) {
      setDenied(Boolean(err && err.name === 'NotAllowedError'));
    }
  }, []);

  return [denied, retry];
}
