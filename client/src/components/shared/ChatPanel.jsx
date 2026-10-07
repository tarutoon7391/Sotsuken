// 雑談チャット（先生画面・生徒画面で共通）— 担当：W5。W4 は props の形だけ合わせて使う。
//
// props:
//   messages:    ChatMessage[]（shared/api-types の ChatMessage。{ id, user, body, file?, created_at }）
//   onSend:      (body: string) => void           テキスト送信（Socket の chat:message）
//   onAttach:    (file: File) => void              添付送信（POST files(kind=attachment) → chat:message に file_id）
//   currentUser: { id, name, role, icon_url? }     自分（自分の発言を右寄せにする等）
//   onLoadMore?: () => void                        過去分の読み込み（GET /chat?before=）
//
// - messages の並び順は問わない（id の昇順に並べ替えて表示する）
// - 添付は ALLOWED_UPLOAD_MIMES・FILE_MAX_BYTES をここで事前チェックし、通ったものだけ onAttach に渡す
// - 本文は React のテキストとして描画する（HTML として解釈しない）
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ALLOWED_UPLOAD_MIMES, DEFAULTS, ROLES } from '@sotsuken/shared/constants';
import Avatar from './Avatar.jsx';
import RoleBadge from './RoleBadge.jsx';
import { formatTime, formatBytes } from './format.js';

const ACCEPT = ALLOWED_UPLOAD_MIMES.join(',');

function FileView({ file }) {
  if (!file) return null;
  if (file.mime && file.mime.startsWith('image/')) {
    return (
      <a className="msg-thumb-link" href={file.url} target="_blank" rel="noopener noreferrer">
        <img className="msg-thumb" src={file.url} alt={file.file_name} loading="lazy" />
      </a>
    );
  }
  return (
    <a className="msg-file" href={file.url} target="_blank" rel="noopener noreferrer">
      <span className="msg-file-icon" aria-hidden="true">📄</span>
      <span className="msg-file-name">{file.file_name}</span>
      {file.size ? <span className="msg-file-size">{formatBytes(file.size)}</span> : null}
    </a>
  );
}

export default function ChatPanel({ messages = [], onSend, onAttach, currentUser, onLoadMore }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const stickToBottom = useRef(true);
  const prevFirstId = useRef(null);
  const prevScrollHeight = useRef(0);

  const sorted = useMemo(() => [...messages].sort((a, b) => a.id - b.id), [messages]);

  // 新着は下に追従（自分が上を読んでいるときは動かさない）。過去分の読み込みでは位置を保つ
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const firstId = sorted.length ? sorted[0].id : null;
    if (prevFirstId.current !== null && firstId !== null && firstId < prevFirstId.current) {
      el.scrollTop += el.scrollHeight - prevScrollHeight.current;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevFirstId.current = firstId;
    prevScrollHeight.current = el.scrollHeight;
  }, [sorted]);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  function send() {
    const body = draft.trim();
    if (!body || !onSend) return;
    onSend(body);
    setDraft('');
    stickToBottom.current = true;
  }

  function handleKeyDown(e) {
    // 日本語変換中の Enter は送信しない
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_UPLOAD_MIMES.includes(file.type)) {
      setError('画像・PDF・Office 文書のみ添付できます');
      return;
    }
    if (file.size > DEFAULTS.FILE_MAX_BYTES) {
      setError(`ファイルが大きすぎます（${formatBytes(DEFAULTS.FILE_MAX_BYTES)}まで）`);
      return;
    }
    stickToBottom.current = true;
    if (onAttach) onAttach(file);
  }

  return (
    <section className="chat-panel">
      <div className="chat-list" ref={listRef} onScroll={handleScroll}>
        {onLoadMore && sorted.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm chat-more" onClick={onLoadMore}>
            過去のメッセージを読み込む
          </button>
        )}
        {sorted.length === 0 && <p className="chat-empty">まだメッセージはありません</p>}
        {sorted.map((m) => {
          const user = m.user || {};
          const isTeacher = user.role === ROLES.TEACHER;
          const isMine = currentUser && user.id === currentUser.id;
          return (
            <div
              key={m.id}
              className={`msg${isTeacher ? ' is-teacher' : ''}${isMine ? ' is-mine' : ''}`}
            >
              <div className="msg-head">
                <Avatar user={user} size={22} />
                <span className="name">{user.name}</span>
                {user.role && <RoleBadge role={user.role} />}
                <time className="time" dateTime={m.created_at}>{formatTime(m.created_at)}</time>
              </div>
              {m.body && <div className="msg-body">{m.body}</div>}
              <FileView file={m.file} />
            </div>
          );
        })}
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="chat-input">
        <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={handleFile} />
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          aria-label="画像・PDFを添付"
          title="添付"
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={!onAttach}
        >
          📎
        </button>
        <input
          className="input"
          placeholder="メッセージ"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" className="btn btn-primary" onClick={send} disabled={!draft.trim()}>
          送信
        </button>
      </div>
    </section>
  );
}
