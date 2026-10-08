// サーバーから受け取った URL を href / src に入れる前に通す。
// 許可するのは「/uploads/ 始まりのパス」と「同一オリジンの絶対 URL」だけ。
// javascript: などのスキーム、// で始まる protocol-relative、/\ で始まる外部遷移は null を返す。

const UPLOADS_PREFIX = '/uploads/';

/**
 * @param {unknown} url
 * @returns {string|null} 安全なら url をそのまま、そうでなければ null
 */
export function safeUrl(url) {
  if (typeof url !== 'string' || url === '') return null;
  // ブラウザは \ を / と同じに扱うので、/\evil.example は //evil.example と同じ意味になる
  if (url.startsWith('//') || url.startsWith('/\\')) return null;
  if (url.startsWith(UPLOADS_PREFIX)) return url;
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return url;
  } catch {
    return null;
  }
}
