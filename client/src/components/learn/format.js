// 生徒画面で使う小さな変換関数 — 担当：W4

/** 秒 → "m:ss"（負の値は 0 として扱う） */
export function formatMmSs(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
