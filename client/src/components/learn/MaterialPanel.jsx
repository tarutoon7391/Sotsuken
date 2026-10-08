// 資料パネル（一覧＋ビューア＋ページ送り）— 担当：W4
// props:
//   materials: FileInfo[]   GET /lessons/:id/files?kind=material（material:added で増える）
//   loading:   boolean
//   error:     string|null
//   onRetry:   () => void    読み込み失敗時の「再読み込み」
//   mobile?:   boolean       スマホは一覧を横スクロールのチップにし、左右スワイプでページ送り
//
// 表示方法：画像は <img>、PDF はブラウザ内蔵ビューア（iframe の #page=N でページ送り）、
// Office 文書はダウンロードリンク。PDF のページ数は取れないので「p.N」だけ表示する。
// ページ送り：PDF はページ、画像・文書は1枚＝1ページなので前後の資料へ。
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { fileKindLabel } from './format.js';
import { safeUrl } from '../../lib/safe-url.js';

const SWIPE_PX = 50; // これ以上横に動いたらページ送り

export default function MaterialPanel({ materials, loading, error, onRetry, mobile = false }) {
  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(false);
  const swipeX = useRef(null);

  // 選択中の資料が消えたら（削除・再読込）先頭に戻す
  const index = Math.max(0, materials.findIndex((m) => m.id === selectedId));
  const selected = materials[index] || null;
  useEffect(() => {
    setPage(1);
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
  const isPdf = kind === 'PDF';

  function step(dir) {
    if (isPdf && url) {
      setPage((p) => Math.max(1, p + dir));
      return;
    }
    const next = materials[index + dir];
    if (next) setSelectedId(next.id);
  }

  // スマホ：左右スワイプでページ送り（PDF の上は iframe がタッチを取るので、透明な面を重ねて受ける）
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
  } else if (isPdf) {
    viewer = (
      <div className="lr-pages">
        {/* key でページ移動ごとに読み直す（#page の変更だけでは反映されないブラウザがある） */}
        <iframe key={`${selected.id}-${page}`} className="lr-pdf" src={`${url}#page=${page}`} title={selected.file_name} />
        {mobile && <div className="lr-swipe-layer" {...swipeProps} aria-hidden="true" />}
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

  // ページ表示：PDF は「p.N」、それ以外は「何枚目 / 資料数」
  const range = isPdf && url ? `p.${page}` : `${index + 1} / ${materials.length}`;
  const canPrev = isPdf && url ? page > 1 : index > 0;
  const canNext = isPdf && url ? true : index < materials.length - 1;

  return (
    <>
      {list}
      {viewer}
      <div className={mobile ? 'lr-m-pager' : 'lr-pager'}>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="前のページ" disabled={!canPrev} onClick={() => step(-1)}>
          ‹
        </button>
        <span className="lr-pager-range">{range}</span>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="次のページ" disabled={!canNext} onClick={() => step(1)}>
          ›
        </button>
        {!mobile && isPdf && url && (
          <a className="btn btn-ghost lr-pager-open" href={url} target="_blank" rel="noopener noreferrer">
            別タブで開く
          </a>
        )}
      </div>

      {zoom && url && (
        <div className="lr-zoom" onClick={() => setZoom(false)}>
          <div className="lr-zoom-head">
            <span className="lr-zoom-name">{selected.file_name}</span>
            <button type="button" className="lr-zoom-close" aria-label="閉じる" onClick={() => setZoom(false)}>
              <Icon name="close" size={28} />
            </button>
          </div>
          <div className="lr-zoom-stage" onClick={(e) => e.stopPropagation()}>
            <img src={url} alt={selected.file_name} />
          </div>
        </div>
      )}
    </>
  );
}
