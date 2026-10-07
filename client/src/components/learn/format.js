// 生徒画面で使う小さな変換関数 — 担当：W4

/** 秒 → "m:ss"（負の値は 0 として扱う） */
export function formatMmSs(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** UTC の ISO 文字列 → 日本時間の "HH:MM"（DB・API は UTC、表示だけ日本時間） */
export function formatTimeJst(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
}

/**
 * サーバーから受け取った URL を src / href に入れてよいか確かめる。
 * 同一オリジンの相対パスと http(s) だけ通し、javascript: などは null にする。
 */
export function safeUrl(url) {
  if (typeof url !== 'string' || url === '') return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

/** MIME → 資料一覧に出す短い種別 */
export function fileKindLabel(mime) {
  if (mime === 'application/pdf') return 'PDF';
  if (typeof mime === 'string' && mime.startsWith('image/')) return 'IMG';
  return 'DOC';
}

/** 名前の頭文字（アイコンの代わり） */
export function initialOf(name) {
  return name ? String(name).slice(0, 1) : '?';
}
