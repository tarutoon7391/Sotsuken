// PDF を canvas にくっきり描くための共通処理 — 担当：W4
// PdfViewer（一覧のページ）と PdfZoom（拡大画面）で使う。
import { useEffect, useState } from 'react';

/** canvas 1枚の画素数の上限（幅×高さ）。iOS Safari の上限（約1677万）より少し下 */
export const MAX_CANVAS_PIXELS = 16_000_000;

/**
 * 表示サイズ（CSS px）に対して実際に使う dpr。画素数が上限を超えるときは dpr を下げる
 * （超えると iOS では何も描かれない）
 */
export function cappedDpr(cssW, cssH, dpr) {
  const limit = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, cssW * cssH));
  return Math.min(dpr, limit);
}

/**
 * 画面の devicePixelRatio。ブラウザの拡大縮小や別のモニターへの移動で変わったら更新する
 * （古い解像度のまま引き伸ばされてぼやけるのを防ぐ）
 */
export function useDevicePixelRatio() {
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);
  useEffect(() => {
    // matchMedia は「今の値と一致するか」しか見張れないので、変わるたびに今の値で作り直す
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const onChange = () => setDpr(window.devicePixelRatio || 1);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [dpr]);
  return dpr;
}
