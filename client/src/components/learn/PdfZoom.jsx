// PDF の拡大画面（アプリ自前の拡大 100〜400%）— 担当：W4
// ブラウザのピンチ・Ctrl＋ホイールは「描いた絵を引き伸ばすだけ」でぼやけるので、拡大画面の中では止めて
// アプリの倍率に回し、その倍率で描き直す（manager の依頼・トーンさんの判断）。
//
// props:
//   doc:        PDFDocumentProxy
//   numPages:   number
//   pageNumber: number              表示中のページ
//   fileName:   string
//   onPage:     (pageNumber) => void ページを変える（変えると 100% に戻る）
//   onClose:    () => void
//
// 操作：
//   PC   ：Ctrl＋ホイール（タッチパッドのピンチも同じ）でカーソル位置を中心に拡大縮小、「−」「＋」「画面に合わせる」、
//          Ctrl＋「+」「-」「0」、拡大中はドラッグとホイールで移動。100% のときは ←→ と左右のボタンでページ送り
//   スマホ：2本指ピンチで拡大縮小、拡大中は1本指で移動。100% のときは左右スワイプでページ送り
// 描き方：
//   倍率を変えている間は canvas を CSS の大きさで仮に引き伸ばし、止まって RERENDER_MS 経ったら
//   その倍率で描き直す（表示サイズを整数 px → canvas の画素数＝表示×dpr。上限を超えるときは dpr を下げる）。
//   描き直しは裏の canvas に描いてから一度に写すので、ちらつかない。置く位置は画面の画素の境目にそろえる。
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { cappedDpr, useDevicePixelRatio } from './pdf-canvas.js';

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25; // 「−」「＋」1回の倍率
const WHEEL_SPEED = 0.002; // Ctrl＋ホイールの効き（deltaY 1 あたり）
const RERENDER_MS = 150; // 倍率の変更が止まってから描き直すまで
const SWIPE_PX = 50;

const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export default function PdfZoom({ doc, numPages, pageNumber, fileName, onPage, onClose }) {
  const dpr = useDevicePixelRatio();
  const overlayRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const pageRef = useRef(null);

  const [stage, setStage] = useState({ w: 0, h: 0 }); // 表示領域の大きさ（CSS px）
  const [base, setBase] = useState(null); // ページの大きさ（scale 1）
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 }); // 倍率と、ページ左上の位置（表示領域の中の CSS px）
  const [renderZoom, setRenderZoom] = useState(1); // canvas を描いた倍率
  const [rendered, setRendered] = useState(false);
  const [dragging, setDragging] = useState(false);

  // 倍率 1 のとき表示領域に収まる倍率
  const fit = base && stage.w > 0 && stage.h > 0 ? Math.min(stage.w / base.w, stage.h / base.h) : 0;

  // イベントの中から最新の値を読むための控え
  const geomRef = useRef({ fit, base, stage });
  geomRef.current = { fit, base, stage };
  const viewRef = useRef(view);
  viewRef.current = view;

  /** 倍率 z のときの表示サイズ（整数 CSS px） */
  const sizeAt = useCallback((z) => {
    const g = geomRef.current;
    if (!g.base || !g.fit) return { w: 1, h: 1 };
    return {
      w: Math.max(1, Math.floor(g.base.w * g.fit * z)),
      h: Math.max(1, Math.floor(g.base.h * g.fit * z)),
    };
  }, []);

  /** 位置を表示領域の中に収める。ページの方が小さい向きは中央に置く */
  const clampView = useCallback(
    (v) => {
      const { stage: s } = geomRef.current;
      const { w, h } = sizeAt(v.zoom);
      const x = w <= s.w ? (s.w - w) / 2 : Math.min(0, Math.max(s.w - w, v.x));
      const y = h <= s.h ? (s.h - h) / 2 : Math.min(0, Math.max(s.h - h, v.y));
      return { zoom: v.zoom, x, y };
    },
    [sizeAt]
  );

  /** (fx, fy)（表示領域の中の位置）を中心に倍率を z にする */
  const zoomAt = useCallback(
    (z, fx, fy) => {
      setView((v) => {
        const zoom = clampZoom(z);
        if (zoom === v.zoom) return v;
        const { stage: s } = geomRef.current;
        const cx = fx ?? s.w / 2;
        const cy = fy ?? s.h / 2;
        const before = sizeAt(v.zoom);
        const after = sizeAt(zoom);
        const ux = (cx - v.x) / before.w;
        const uy = (cy - v.y) / before.h;
        return clampView({ zoom, x: cx - ux * after.w, y: cy - uy * after.h });
      });
    },
    [sizeAt, clampView]
  );

  const panBy = useCallback(
    (dx, dy) => setView((v) => (v.zoom > 1 ? clampView({ ...v, x: v.x + dx, y: v.y + dy }) : v)),
    [clampView]
  );

  const resetZoom = useCallback(() => setView((v) => clampView({ zoom: 1, x: v.x, y: v.y })), [clampView]);

  // ---- ページの読み込み（ページを変えたら 100% に戻す）
  useEffect(() => {
    let alive = true;
    setBase(null);
    setRendered(false);
    setView({ zoom: 1, x: 0, y: 0 });
    setRenderZoom(1);
    doc
      .getPage(pageNumber)
      .then((page) => {
        if (!alive) return;
        pageRef.current = page;
        const vp = page.getViewport({ scale: 1 });
        setBase({ w: vp.width, h: vp.height });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [doc, pageNumber]);

  // ---- 表示領域の大きさ
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage((s) => (Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 大きさが決まった・変わったら位置を収め直す
  useEffect(() => {
    if (fit) setView((v) => clampView(v));
  }, [fit, stage.w, stage.h, clampView]);

  // ---- 倍率の変更が止まったら、その倍率で描き直す
  useEffect(() => {
    if (view.zoom === renderZoom) return undefined;
    const t = setTimeout(() => setRenderZoom(view.zoom), RERENDER_MS);
    return () => clearTimeout(t);
  }, [view.zoom, renderZoom]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || !base || !fit) return undefined;
    let cancelled = false;
    const { w, h } = sizeAt(renderZoom);
    const useDpr = cappedDpr(w, h, dpr);
    const off = document.createElement('canvas');
    off.width = Math.round(w * useDpr);
    off.height = Math.round(h * useDpr);
    const task = page.render({ canvas: off, viewport: page.getViewport({ scale: off.width / base.w }) });
    task.promise
      .then(() => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext('2d').drawImage(off, 0, 0);
        setRendered(true);
      })
      .catch(() => {}); // 描き直しの中断は無視する
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [base, fit, renderZoom, dpr, sizeAt]);

  // ---- 表示サイズと位置（画面の画素の境目にそろえる）
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const st = stageRef.current;
    if (!canvas || !st || !fit) return;
    const { w, h } = sizeAt(view.zoom);
    const r = st.getBoundingClientRect();
    const snap = (v) => Math.round(v * dpr) / dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.left = `${snap(r.left + view.x) - r.left}px`;
    canvas.style.top = `${snap(r.top + view.y) - r.top}px`;
  }, [view, fit, dpr, sizeAt, stage.w, stage.h]);

  // ---- Ctrl＋ホイール（ピンチ）をアプリの倍率に回す。拡大中のホイールは移動
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1; // 行・ページ単位を px に
      if (e.ctrlKey) {
        e.preventDefault(); // ブラウザの拡大を止める
        const r = stageRef.current.getBoundingClientRect();
        zoomAt(viewRef.current.zoom * Math.exp(-e.deltaY * unit * WHEEL_SPEED), e.clientX - r.left, e.clientY - r.top);
      } else if (viewRef.current.zoom > 1) {
        e.preventDefault();
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        panBy(-dx * unit, -dy * unit);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, panBy]);

  // ---- キー操作
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === ';')) {
        e.preventDefault(); // ブラウザの拡大の代わりにアプリの倍率を上げる
        zoomAt(viewRef.current.zoom * ZOOM_STEP);
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        zoomAt(viewRef.current.zoom / ZOOM_STEP);
      } else if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        resetZoom();
      } else if (viewRef.current.zoom === 1 && e.key === 'ArrowLeft' && pageNumber > 1) {
        onPage(pageNumber - 1);
      } else if (viewRef.current.zoom === 1 && e.key === 'ArrowRight' && pageNumber < numPages) {
        onPage(pageNumber + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomAt, resetZoom, onClose, onPage, pageNumber, numPages]);

  // ---- ポインタ（ドラッグ・1本指で移動、2本指ピンチで拡大縮小、100% のスワイプでページ送り）
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  function stagePoint(e) {
    const r = stageRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function startGesture() {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: viewRef.current.zoom };
      setDragging(false);
    } else if (pts.length === 1) {
      gesture.current = { type: 'pan', startX: pts[0].x, last: { ...pts[0] } };
      setDragging(viewRef.current.zoom > 1);
    } else {
      gesture.current = null;
      setDragging(false);
    }
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stageRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, stagePoint(e));
    startGesture();
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = stagePoint(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(g.z0 * (d / g.d0), (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else {
      panBy(p.x - g.last.x, p.y - g.last.y);
      g.last = p;
    }
  }

  function onPointerUp(e) {
    if (!pointers.current.has(e.pointerId)) return;
    const g = gesture.current;
    const p = stagePoint(e);
    pointers.current.delete(e.pointerId);
    // 100% のときの左右スワイプ（タッチ・ペン）でページ送り
    if (g && g.type === 'pan' && e.pointerType !== 'mouse' && viewRef.current.zoom === 1 && pointers.current.size === 0) {
      const d = p.x - g.startX;
      if (d < -SWIPE_PX && pageNumber < numPages) onPage(pageNumber + 1);
      else if (d > SWIPE_PX && pageNumber > 1) onPage(pageNumber - 1);
    }
    startGesture(); // ピンチの途中で1本離したら、残りの1本で移動を続ける
  }

  const zoomed = view.zoom > 1;
  const stop = (e) => e.stopPropagation(); // 背景のクリックで閉じるのを止める

  return (
    <div className="lr-zoom is-pdf" ref={overlayRef} onClick={onClose}>
      <div className="lr-zoom-head">
        <span className="lr-zoom-name">{fileName}</span>
        <span className="lr-zoom-pos">
          p.{pageNumber} / {numPages}
        </span>
        <div className="lr-zoom-tools" onClick={stop}>
          <button
            type="button"
            className="lr-zoom-tool"
            aria-label="縮小"
            disabled={view.zoom <= ZOOM_MIN}
            onClick={() => zoomAt(view.zoom / ZOOM_STEP)}
          >
            −
          </button>
          <span className="lr-zoom-rate" aria-live="polite">
            {Math.round(view.zoom * 100)}%
          </span>
          <button
            type="button"
            className="lr-zoom-tool"
            aria-label="拡大"
            disabled={view.zoom >= ZOOM_MAX}
            onClick={() => zoomAt(view.zoom * ZOOM_STEP)}
          >
            ＋
          </button>
          <button
            type="button"
            className="lr-zoom-tool is-text"
            aria-label="画面に合わせる（100%）"
            disabled={!zoomed}
            onClick={resetZoom}
          >
            画面に合わせる
          </button>
        </div>
        <button type="button" className="lr-zoom-close" aria-label="閉じる" onClick={onClose}>
          <Icon name="close" size={28} />
        </button>
      </div>

      <div className="lr-zoom-body">
        <button
          type="button"
          className="lr-zoom-arrow"
          aria-label="前のページ"
          disabled={pageNumber <= 1}
          onClick={(e) => {
            stop(e);
            onPage(pageNumber - 1);
          }}
        >
          <Icon name="prev" size={44} />
        </button>
        <div
          ref={stageRef}
          className={`lr-zoom-stage${zoomed ? ' is-zoomed' : ''}${dragging ? ' is-dragging' : ''}`}
          onClick={stop}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} className="lr-zoom-canvas" aria-label={`p.${pageNumber}`} />
          {!rendered && (
            <span className="lr-pdf-spin">
              <span className="lr-spinner" />
            </span>
          )}
        </div>
        <button
          type="button"
          className="lr-zoom-arrow"
          aria-label="次のページ"
          disabled={pageNumber >= numPages}
          onClick={(e) => {
            stop(e);
            onPage(pageNumber + 1);
          }}
        >
          <Icon name="next" size={44} />
        </button>
      </div>
    </div>
  );
}
