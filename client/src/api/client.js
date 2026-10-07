// fetch のラッパー。REST API（/api）は必ずここを通す。
// - JSON の送受信、クッキー（セッション）の送信
// - 401 → /login へ、403/404 → /error/:status へ（SPA 内遷移。画面側で止めたいときは { redirect: false }）
// - 409 などの業務エラーは ApiError として throw（呼び出し側が code で分岐する）
import { ERROR_CODES } from '@sotsuken/shared/constants';

/** API のエラー。err.status / err.code / err.message で分岐する */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** 共通処理（401/403/404）で画面遷移するときに使う。App 側から navigate を差し込む */
let onAuthError = (status) => {
  if (status === 401) window.location.assign('/login');
  else window.location.assign(`/error/${status}`);
};

/** react-router の navigate を使いたいときに差し替える（任意） */
export function setAuthErrorHandler(handler) {
  onAuthError = handler;
}

/**
 * @param {string} path  '/classes' のように /api を除いたパス
 * @param {{ method?: string, body?: any, formData?: FormData, query?: object, redirect?: boolean }} [options]
 */
export async function api(path, options = {}) {
  const { method = 'GET', body, formData, query, redirect = true } = options;

  let url = `/api${path}`;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const init = { method, credentials: 'same-origin', headers: {} };
  if (formData) {
    init.body = formData; // multipart（Content-Type はブラウザが付ける）
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (res.ok) return data;

  const code = (data && data.error && data.error.code) || ERROR_CODES.INTERNAL_ERROR;
  const message = (data && data.error && data.error.message) || `通信エラー（${res.status}）`;

  if (redirect && (res.status === 401 || res.status === 403 || res.status === 404)) {
    onAuthError(res.status);
  }
  throw new ApiError(res.status, code, message);
}

// よく使う形のショートカット
export const get = (path, query, options) => api(path, { ...options, query });
export const post = (path, body, options) => api(path, { ...options, method: 'POST', body });
export const put = (path, body, options) => api(path, { ...options, method: 'PUT', body });
export const patch = (path, body, options) => api(path, { ...options, method: 'PATCH', body });
export const del = (path, options) => api(path, { ...options, method: 'DELETE' });
export const upload = (path, formData, options) => api(path, { ...options, method: 'POST', formData });
