// 表示用の整形（日時は UTC で受け取り、表示時だけ日本時間に変換する）
const TIME_ZONE = 'Asia/Tokyo';

/** ISO 文字列 → "14:05"（日本時間） */
export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ja-JP', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
}

/** ISO 文字列 → "10/7(水) 14:05"（日本時間） */
export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ja-JP', {
    timeZone: TIME_ZONE,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 秒 → "m:ss"（1時間以上は "h:mm:ss"） */
export function formatDuration(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** バイト数 → "1.2MB" など */
export function formatBytes(n) {
  const b = Number(n) || 0;
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`;
  if (b >= 1024) return `${Math.round(b / 1024)}KB`;
  return `${b}B`;
}
