// 資料のプレビューウィンドウ（画面右下に固定。スマホ幅では下からのシート）— 担当：W5
// docs/07 §0「資料は新しいタブで開かない」。先生画面・クラス詳細・授業結果の資料一覧から開く。
//
// props:
//   file:    FileInfo（shared/api-types。{ id, file_name, url, mime, preview_url? }）。null なら何も出さない
//   onClose: () => void     閉じる（Esc でも閉じる）
//
// - PDF と、preview_url がある Office 文書は W4 の PdfViewer（pdf.js）で表示する。pdf.js は大きいので React.lazy
// - 画像は <img>。preview_url が無い Office 文書は「この資料はプレビューできません」＋ダウンロード
// - URL はすべて safeUrl を通す。元ファイルのダウンロードボタンはどの資料にも出す
// - 別の資料を渡すと中身が切り替わる（PdfViewer は key で作り直す）
import { Suspense, lazy } from 'react';
import { safeUrl } from '../../lib/safe-url.js';
import useIsMobile from '../learn/useIsMobile.js';
import useEscape from './useEscape.js';
// PdfViewer の見た目（lr- 接頭辞で他とぶつからない）は W4 の learn.css にある
import '../../pages/learn/learn.css';

const PdfViewer = lazy(() => import('../learn/PdfViewer.jsx'));

function kindOf(mime) {
  if (!mime) return 'other';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  return 'office';
}

export default function MaterialPreview({ file, onClose }) {
  const mobile = useIsMobile();
  useEscape(file ? onClose : null);
  if (!file) return null;

  const kind = kindOf(file.mime);
  const url = safeUrl(file.url); // 元ファイル（ダウンロード・画像表示用）
  const pdfUrl = kind === 'pdf' ? url : kind === 'office' ? safeUrl(file.preview_url) : null;

  let body;
  if (pdfUrl) {
    body = (
      <Suspense
        fallback={
          <div className="lr-pages is-empty">
            <span className="lr-spinner" />
          </div>
        }
      >
        <PdfViewer key={`${file.id}:${pdfUrl}`} url={pdfUrl} fileName={file.file_name} mobile={mobile} />
      </Suspense>
    );
  } else if (kind === 'image' && url) {
    body = (
      <div className="mat-preview-image">
        <img src={url} alt={file.file_name} />
      </div>
    );
  } else {
    // preview_url の無い Office 文書（変換していない・失敗した）、または URL が安全でない
    body = (
      <div className="mat-preview-empty">
        <p>この資料はプレビューできません</p>
        {url && (
          <a className="btn btn-primary" href={url} download={file.file_name}>
            ダウンロード
          </a>
        )}
      </div>
    );
  }

  return (
    <section className={`mat-preview${mobile ? ' is-sheet' : ''}`} role="dialog" aria-label={`資料のプレビュー：${file.file_name}`}>
      <header className="mat-preview-head">
        <span className="mat-preview-name" title={file.file_name}>{file.file_name}</span>
        {url && (
          <a
            className="btn btn-secondary btn-sm"
            href={url}
            download={file.file_name}
            aria-label={`${file.file_name} をダウンロード`}
          >
            ダウンロード
          </a>
        )}
        <button type="button" className="btn btn-ghost btn-icon mat-preview-close" onClick={onClose} aria-label="プレビューを閉じる" title="閉じる（Esc）">
          ✕
        </button>
      </header>
      <div className="mat-preview-body">{body}</div>
    </section>
  );
}
