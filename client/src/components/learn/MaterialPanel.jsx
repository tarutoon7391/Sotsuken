// 資料パネル（一覧＋ビューア＋ページ送り）— 担当：W4
// props:
//   materials: FileInfo[]   GET /lessons/:id/files?kind=material（material:added で増える）
//   loading:   boolean
//   error:     string|null
//   onRetry:   () => void    読み込み失敗時の「再読み込み」
//   mobile?:   boolean       スマホは一覧を横スクロールのチップにし、左右スワイプでページ送り
//
// 表示方法：PDF は PdfViewer（pdf.js・総ページ数・1/2/4 ページ同時表示・拡大。PDF を開いたときだけ読み込む）、
// 画像は <img>（タップで拡大）、Office 文書はダウンロードリンク。
// 画像・文書は1枚＝1ページとして、ページ送り（ボタン・スマホのスワイプ）で前後の資料へ移る。
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { fileKindLabel } from './format.js';
import { safeUrl } from '../../lib/safe-url.js';

const SWIPE_PX = 50; // これ以上横に動いたらページ送り
const PdfViewer = lazy(() => import('./PdfViewer.jsx'));

export default function MaterialPanel({ materials, loading, error, onRetry, mobile = false }) {
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(false);
  const swipeX = useRef(null);

  // 選択中の資料が消えたら（削除・再読込）先頭に戻す
  const index = Math.max(0, materials.findIndex((m) => m.id === selectedId));
  const selected = materials[index] || null;
  useEffect(() => {
    setZoom(false);
  }, [selected && selected.id]);

  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => e.key === 'Escape' && setZoom(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  if (error && !selected) {
    return (
      <div className="lr-pages is-empty" role="alert">
        <div>
          <p className="lr-hint">{error}</p>
          <button type="button" className="btn btn-ghost" onClick={onRetry}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="lr-pages is-empty">
        <span className="lr-spinner" />
      </div>
    );
  }
  if (!selected) return <div className="lr-pages is-empty">資料はまだありません</div>;

  const kind = fileKindLabel(selected.mime);
  const url = safeUrl(selected.url);
  const isPdf = kind === 'PDF' && Boolean(url);

  function step(dir) {
    const next = materials[index + dir];
    if (next) setSelectedId(next.id);
  }

  // スマホ：左右スワイプで前後の資料へ（PDF のページ送りは PdfViewer が受け持つ）
  const swipeProps = mobile
    ? {
        onTouchStart: (e) => {
          swipeX.current = e.changedTouches[0].clientX;
        },
        onTouchEnd: (e) => {
          if (swipeX.current == null) return;
          const d = e.changedTouches[0].clientX - swipeX.current;
          swipeX.current = null;
          if (d < -SWIPE_PX) step(1);
          else if (d > SWIPE_PX) step(-1);
        },
      }
    : {};

  const list = mobile ? (
    <div className="lr-chips">
      {materials.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`lr-chip${m.id === selected.id ? ' is-active' : ''}`}
          onClick={() => setSelectedId(m.id)}
        >
          <span className={`lr-mat-kind${fileKindLabel(m.mime) === 'IMG' ? ' is-img' : ''}`}>{fileKindLabel(m.mime)}</span>
          {m.file_name}
        </button>
      ))}
    </div>
  ) : (
    <div className="lr-mat-list">
      {materials.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`lr-mat${m.id === selected.id ? ' is-active' : ''}`}
          onClick={() => setSelectedId(m.id)}
        >
          <span className={`lr-mat-kind${fileKindLabel(m.mime) === 'IMG' ? ' is-img' : ''}`}>{fileKindLabel(m.mime)}</span>
          <span className="lr-mat-name">{m.file_name}</span>
        </button>
      ))}
    </div>
  );

  if (isPdf) {
    return (
      <>
        {list}
        <Suspense
          fallback={
            <div className="lr-pages is-empty">
              <span className="lr-spinner" />
            </div>
          }
        >
          <PdfViewer key={selected.id} url={url} fileName={selected.file_name} mobile={mobile} />
        </Suspense>
      </>
    );
  }

  let viewer;
  if (!url) {
    viewer = (
      <div className="lr-pages is-empty" {...swipeProps}>
        この資料は表示できません
      </div>
    );
  } else if (kind === 'IMG') {
    viewer = (
      <div className="lr-pages" {...swipeProps}>
        <button type="button" className="lr-page" aria-label="拡大" onClick={() => setZoom(true)}>
          <img src={url} alt={selected.file_name} />
        </button>
      </div>
    );
  } else {
    viewer = (
      <div className="lr-pages is-empty" {...swipeProps}>
        <a className="lr-post-file" href={url} target="_blank" rel="noopener noreferrer" download={selected.file_name}>
          <Icon name="pdf" />
          {selected.file_name} をダウンロード
        </a>
      </div>
    );
  }

  return (
    <>
      {list}
      {viewer}
      {/* 画像・文書のページ送り：「何枚目 / 資料数」 */}
      <div className={mobile ? 'lr-m-pager' : 'lr-pager'}>
        <div className="lr-pager-right">
          <button type="button" className="btn btn-secondary btn-icon" aria-label="前の資料" disabled={index <= 0} onClick={() => step(-1)}>
            ‹
          </button>
          <span className="lr-pager-range">
            {index + 1} / {materials.length}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            aria-label="次の資料"
            disabled={index >= materials.length - 1}
            onClick={() => step(1)}
          >
            ›
          </button>
        </div>
      </div>

      {zoom && url && (
        <div className="lr-zoom" onClick={() => setZoom(false)}>
          <div className="lr-zoom-head">
            <span className="lr-zoom-name">{selected.file_name}</span>
            <button type="button" className="lr-zoom-close" aria-label="閉じる" onClick={() => setZoom(false)}>
              <Icon name="close" size={28} />
            </button>
          </div>
          <div className="lr-zoom-body">
            <span />
            <div className="lr-zoom-stage" onClick={(e) => e.stopPropagation()}>
              <img src={url} alt={selected.file_name} />
            </div>
            <span />
          </div>
        </div>
      )}
    </>
  );
}
