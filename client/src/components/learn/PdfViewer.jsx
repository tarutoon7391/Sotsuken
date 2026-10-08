// PDF ビューア（pdf.js）— 担当：W4（デザイン：docs/design/10_生徒画面_授業中 の資料パネル）
// 監査 C-1 の裁定で pdfjs-dist を採用（ブラウザ内蔵ビューアの iframe はスマホで表示できないため）。
// pdf.js は大きいので MaterialPanel から React.lazy で読み込む（PDF を開いたときだけ取得される）。
//
// default export <PdfViewer url fileName mobile? />
//   ページの表示（PC は 1/2/4 ページ同時表示）、総ページ数、ページ送り（ボタン・左右の端・スマホのスワイプ）、拡大
// 部品：usePdfDocument(url) → { doc, numPages, error, loading } / <PdfPage doc pageNumber />
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export function usePdfDocument(url) {
  const [state, setState] = useState({ doc: null, numPages: 0, error: null, loading: Boolean(url) });

  useEffect(() => {
    if (!url) {
      setState({ doc: null, numPages: 0, error: null, loading: false });
      return undefined;
    }
    let alive = true;
    setState({ doc: null, numPages: 0, error: null, loading: true });
    const task = pdfjsLib.getDocument({ url, withCredentials: true });
    task.promise
      .then((doc) => {
        if (alive) setState({ doc, numPages: doc.numPages, error: null, loading: false });
      })
      .catch(() => {
        if (alive) setState({ doc: null, numPages: 0, error: 'PDF を読み込めませんでした', loading: false });
      });
    return () => {
      alive = false;
      task.destroy();
    };
  }, [url]);

  return state;
}

export function PdfPage({ doc, pageNumber, className = '' }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [rendered, setRendered] = useState(false);

  // 枠の大きさを見張る
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((b) => (Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 枠に収まる倍率で描く（高解像度の画面では devicePixelRatio 倍で描いて縮める）
  useEffect(() => {
    if (!doc || box.w < 1 || box.h < 1) return undefined;
    let cancelled = false;
    let renderTask = null;
    setRendered(false);
    doc
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const fit = Math.min(box.w / base.width, box.h / base.height);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: fit * dpr });
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        renderTask = page.render({ canvas, viewport });
        return renderTask.promise.then(() => !cancelled && setRendered(true));
      })
      .catch(() => {}); // 描画の中断（ページ送り・アンマウント）は無視する
    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [doc, pageNumber, box.w, box.h]);

  return (
    <div ref={wrapRef} className={`lr-pdf-page ${className}`}>
      <canvas ref={canvasRef} aria-label={`p.${pageNumber}`} />
      {!rendered && (
        <span className="lr-pdf-spin">
          <span className="lr-spinner" />
        </span>
      )}
    </div>
  );
}

const COLS = [1, 2, 4]; // PC のページ同時表示（4 は 2×2）
const SWIPE_PX = 50; // これ以上横に動いたらページ送り

export default function PdfViewer({ url, fileName, mobile = false }) {
  const { doc, numPages, error, loading } = usePdfDocument(url);
  const [page, setPage] = useState(1); // 表示している先頭ページ
  const [cols, setCols] = useState(1);
  const [zoomPage, setZoomPage] = useState(null);
  const swipeX = useRef(null);

  const visible = mobile ? 1 : cols;

  // ページ数の少ない資料では同時表示数を下げる
  useEffect(() => {
    if (numPages && cols > numPages) setCols(numPages >= 2 ? 2 : 1);
  }, [numPages, cols]);

  // 拡大中のキー操作（Esc で閉じる・←→でページ送り）
  useEffect(() => {
    if (zoomPage == null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setZoomPage(null);
      else if (e.key === 'ArrowLeft') setZoomPage((z) => Math.max(1, z - 1));
      else if (e.key === 'ArrowRight') setZoomPage((z) => Math.min(numPages, z + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomPage, numPages]);

  if (loading) {
    return (
      <div className="lr-pages is-empty">
        <span className="lr-spinner" />
      </div>
    );
  }
  if (error || !doc) {
    return (
      <div className="lr-pages is-empty">
        <div>
          <p className="lr-hint">{error || 'PDF を表示できません'}</p>
          <a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer" download={fileName}>
            ダウンロード
          </a>
        </div>
      </div>
    );
  }

  const last = Math.min(numPages, page + visible - 1);
  const canPrev = page > 1;
  const canNext = page + visible <= numPages;
  const prev = () => setPage((p) => Math.max(1, p - visible));
  const next = () => setPage((p) => (p + visible <= numPages ? p + visible : p));
  const range = `${last > page ? `${page}–${last}` : page} / ${numPages}`;

  const pages = [];
  for (let p = page; p <= last; p += 1) pages.push(p);

  // スマホ：左右スワイプでページ送り（canvas はタッチを奪わないので枠で受ける）
  const swipeProps = mobile
    ? {
        onTouchStart: (e) => {
          swipeX.current = e.changedTouches[0].clientX;
        },
        onTouchEnd: (e) => {
          if (swipeX.current == null) return;
          const d = e.changedTouches[0].clientX - swipeX.current;
          swipeX.current = null;
          if (d < -SWIPE_PX) next();
          else if (d > SWIPE_PX) prev();
        },
      }
    : {};

  return (
    <>
      <div className="lr-pages" {...swipeProps}>
        <div className="lr-pages-grid" style={{ gridTemplateColumns: `repeat(${visible === 1 ? 1 : 2}, minmax(0, 1fr))` }}>
          {pages.map((p) => (
            <button key={p} type="button" className="lr-pdf-cell" aria-label={`p.${p} を拡大`} onClick={() => setZoomPage(p)}>
              <PdfPage doc={doc} pageNumber={p} />
              {!mobile && <span className="lr-page-label">p.{p}</span>}
            </button>
          ))}
        </div>
        {!mobile && (
          <>
            <button type="button" className="lr-pages-nav is-prev" aria-label="前のページ" disabled={!canPrev} onClick={prev}>
              <Icon name="prev" size={28} />
            </button>
            <button type="button" className="lr-pages-nav is-next" aria-label="次のページ" disabled={!canNext} onClick={next}>
              <Icon name="next" size={28} />
            </button>
          </>
        )}
      </div>

      <div className={mobile ? 'lr-m-pager' : 'lr-pager'}>
        {!mobile && (
          <>
            <div className="lr-cols" role="group" aria-label="ページ同時表示">
              {COLS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cols === n ? 'is-active' : ''}
                  aria-pressed={cols === n}
                  disabled={numPages < n}
                  onClick={() => {
                    setCols(n);
                    setPage((p) => Math.max(1, Math.min(p, numPages - n + 1)));
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="lr-pager-note">ページ同時表示</span>
          </>
        )}
        <div className="lr-pager-right">
          <button type="button" className="btn btn-secondary btn-icon" aria-label="前のページ" disabled={!canPrev} onClick={prev}>
            ‹
          </button>
          <span className="lr-pager-range">{range}</span>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="次のページ" disabled={!canNext} onClick={next}>
            ›
          </button>
        </div>
      </div>

      {zoomPage != null && (
        <div className="lr-zoom" onClick={() => setZoomPage(null)}>
          <div className="lr-zoom-head">
            <span className="lr-zoom-name">{fileName}</span>
            <span className="lr-zoom-pos">
              p.{zoomPage} / {numPages}
            </span>
            <button type="button" className="lr-zoom-close" aria-label="閉じる" onClick={() => setZoomPage(null)}>
              <Icon name="close" size={28} />
            </button>
          </div>
          <div className="lr-zoom-body">
            <button
              type="button"
              className="lr-zoom-arrow"
              aria-label="前のページ"
              disabled={zoomPage <= 1}
              onClick={(e) => {
                e.stopPropagation();
                setZoomPage((z) => Math.max(1, z - 1));
              }}
            >
              <Icon name="prev" size={44} />
            </button>
            <div className="lr-zoom-stage" onClick={(e) => e.stopPropagation()}>
              <PdfPage doc={doc} pageNumber={zoomPage} />
            </div>
            <button
              type="button"
              className="lr-zoom-arrow"
              aria-label="次のページ"
              disabled={zoomPage >= numPages}
              onClick={(e) => {
                e.stopPropagation();
                setZoomPage((z) => Math.min(numPages, z + 1));
              }}
            >
              <Icon name="next" size={44} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
