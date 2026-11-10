// F-10 プログラミングモード：生徒の「いまの状態」（書きかけのコード・構文エラー）のメモリ置き場 — 担当：W2
// - code:draft（書きかけのコード）と code:syntax（構文エラー）を課題×生徒ごとに最新 1 件だけ持つ
// - 先生が画面を開き直したとき（GET documents）にも、保存前のコードと構文エラーを見せるために使う
// - DB には残さない（サーバー再起動で消えてよい。保存済みのコードは code_documents が正）

const entries = new Map(); // `${taskId}:${userId}` → { source: string|null, syntax: { hasError, line } }

function keyOf(taskId, userId) {
  return `${taskId}:${userId}`;
}

function getOrCreate(taskId, userId) {
  const key = keyOf(taskId, userId);
  let e = entries.get(key);
  if (!e) {
    e = { source: null, syntax: { hasError: false, line: null } };
    entries.set(key, e);
  }
  return e;
}

/** 書きかけのコードを記録する */
function setDraft(taskId, userId, source) {
  getOrCreate(taskId, userId).source = source;
}

/** 構文エラーの有無を記録する */
function setSyntax(taskId, userId, hasError, line) {
  getOrCreate(taskId, userId).syntax = { hasError: Boolean(hasError), line: hasError && line ? line : null };
}

/** 書きかけのコード（無ければ null） */
function getDraft(taskId, userId) {
  const e = entries.get(keyOf(taskId, userId));
  return e ? e.source : null;
}

/** 構文エラーの状態（無ければ エラーなし） */
function getSyntax(taskId, userId) {
  const e = entries.get(keyOf(taskId, userId));
  return e ? e.syntax : { hasError: false, line: null };
}

/** 課題のテンプレート再配布のときに、その課題の書きかけ・構文エラーを全員分消す */
function clearTask(taskId) {
  const prefix = `${taskId}:`;
  for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
}

/** テスト用 */
function clearAll() {
  entries.clear();
}

module.exports = { setDraft, setSyntax, getDraft, getSyntax, clearTask, clearAll };
