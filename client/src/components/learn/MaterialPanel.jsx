// 資料パネル（一覧＋ビューア＋ページ送り）— 担当：W4
// props:
//   materials: FileInfo[]   GET /lessons/:id/files?kind=material
//   loading:   boolean
//   error:     string|null
//   mobile?:   boolean       スマホは一覧を横スクロールのチップにする
//
// 表示方法：画像は <img>、PDF はブラウザ内蔵ビューア（iframe の #page=N でページ送り）、
// Office 文書はダウンロードリンク。PDF のページ数は取れないので「p.N」だけ表示する。
import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { fileKindLabel, safeUrl } from './format.js';

export default function MaterialPanel({ materials, loading, error, mobile = false }) {
  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(false);

  // 選択中の資料が消えたら（削除・再読込）先頭に戻す
  const selected = materials.find((m) => m.id === selectedId) || materials[0] || null;
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

  if (loading) return <div className="lr-pages is-empty"><span className="lr-spinner" /></div>;
  if (error) return <div className="lr-pages is-empty">{error}</div>;
  if (!selected) return <div className="lr-pages is-empty">資料はまだありません</div>;

  const kind = fileKindLabel(selected.mime);
  const url = safeUrl(selected.url);
  const isPdf = kind === 'PDF';

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
    viewer = <div className="lr-pages is-empty">この資料は表示できません</div>;
  } else if (kind === 'IMG') {
    viewer = (
      <div className="lr-pages">
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
      </div>
    );
  } else {
    viewer = (
      <div className="lr-pages is-empty">
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
      {isPdf && url && (
        <div className={mobile ? 'lr-m-pager' : 'lr-pager'}>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            aria-label="前のページ"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          <span className="lr-pager-range">p.{page}</span>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="次のページ" onClick={() => setPage((p) => p + 1)}>
            ›
          </button>
          {!mobile && (
            <a className="btn btn-ghost lr-pager-open" href={url} target="_blank" rel="noopener noreferrer">
              別タブで開く
            </a>
          )}
        </div>
      )}

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
