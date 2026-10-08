// 先生画面（授業中）の各パネル — 担当：W5
// 状態は TeachPage が持ち、ここは表示と操作の受け渡しだけ。
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ALLOWED_UPLOAD_MIMES, DEFAULTS, LESSON_STATUS } from '@sotsuken/shared/constants';
import Avatar from '../../components/shared/Avatar.jsx';
import { formatBytes, formatDuration } from '../../components/shared/format.js';
import { MaterialButton, fileKindLabel, useArmed } from '../classes/ClassDetailPage.jsx';

/** 見出しを押すと折りたためるパネル */
export function Panel({ label, right, children, className = '', defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`panel ${className}${open ? '' : ' is-folded'}`}>
      <div className="panel-head">
        <button type="button" className="panel-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <h6 className="section-label">{label}</h6>
          <span className="caret" aria-hidden="true">{open ? '▼' : '▶'}</span>
        </button>
        {right && <span className="right">{right}</span>}
      </div>
      {children}
    </div>
  );
}

/** 出席：出席／一時退出／欠課の人数 */
export function AttendancePanel({ lessonId, counts }) {
  return (
    <Panel
      label="出席"
      right={<Link className="btn btn-ghost btn-sm" to={`/lessons/${lessonId}/attendance`}>出席一覧を開く →</Link>}
    >
      <div className="att-row">
        <div className="stat"><span className="stat-value">{counts.present}</span><span className="stat-sub">出席</span></div>
        <div className="stat is-away"><span className="stat-value">{counts.away}</span><span className="stat-sub">一時退出</span></div>
        <div className="stat is-absent"><span className="stat-value">{counts.absent}</span><span className="stat-sub">欠課</span></div>
      </div>
    </Panel>
  );
}

const AUTO_CHOICES = [0, 5, 10, 15];

/**
 * 確認ボタン
 * check: { check_id, deadline_at } | null ／ result: { responded: UserBrief[], pending: UserBrief[] } | null
 */
export function AttentionPanel({ isLive, check, result, onIssue, autoInterval, onAutoChange, busy }) {
  const [now, setNow] = useState(Date.now());
  const deadline = check ? new Date(check.deadline_at).getTime() : 0;
  const running = !!check && deadline > now;

  useEffect(() => {
    if (!check) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [check]);

  const responded = result ? result.responded.length : 0;
  const total = result ? result.responded.length + result.pending.length : 0;
  const remainSec = Math.max(0, Math.ceil((deadline - now) / 1000));
  // 全体の秒数は issued_at〜deadline_at（自動発動の分も同じ）
  const issued = check && check.issued_at ? new Date(check.issued_at).getTime() : 0;
  const totalSec = issued && deadline > issued ? (deadline - issued) / 1000 : DEFAULTS.ATTENTION_TIMEOUT_SEC;

  return (
    <Panel label="確認">
      {!check && (
        <div>
          <button type="button" className="btn btn-primary btn-block" style={{ margin: 0 }} onClick={onIssue} disabled={!isLive || busy}>
            🔔 確認を送る
          </button>
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>
            {isLive ? '全生徒の画面に「今、画面を見ていますか？」を出します' : '授業を開始すると送れます'}
          </p>
        </div>
      )}
      {running && (
        <div>
          {check.auto && <span className="tag tag-neutral" style={{ marginBottom: 6 }}>自動で送信</span>}
          <div className="check-run">
            <span className={`countdown${remainSec <= 10 ? ' is-low' : ''}`}>{remainSec}</span>
            <div className="stat">
              <span className="stat-value">
                {responded}<span className="muted" style={{ fontSize: 14 }}>/{total}</span>
              </span>
              <span className="stat-sub">応答</span>
            </div>
          </div>
          <div className="check-track"><span style={{ width: `${Math.min(100, (remainSec / totalSec) * 100)}%` }} /></div>
        </div>
      )}
      {check && !running && (
        <div>
          <div className="small" style={{ marginBottom: 6 }}>
            確認が終わりました。
            {result && result.pending.length > 0 ? (
              <><span className="strong accent-2-text">{result.pending.length}</span> 人が未応答です</>
            ) : (
              '全員が応答しました'
            )}
          </div>
          {result && result.pending.length > 0 && (
            <div className="noresp">
              {result.pending.map((u) => (
                <span key={u.id} className="chip"><Avatar user={u} size={18} />{u.name}</span>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={onIssue} disabled={!isLive || busy}>
            🔔 もう一度送る
          </button>
        </div>
      )}
      <div className="check-auto">
        自動
        <div className="seg" role="radiogroup" aria-label="自動発動の間隔">
          {AUTO_CHOICES.map((m) => (
            <label key={m} className="seg-opt">
              <input
                type="radio"
                name="auto"
                value={m}
                checked={autoInterval === m}
                onChange={() => onAutoChange(m)}
                disabled={!isLive}
              />
              {m === 0 ? 'オフ' : `${m}分`}
            </label>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** 資料：一覧＋アップロード＋削除（2回押し） */
export function MaterialPanel({ files, onUpload, onDelete, error, onOpen, previewId }) {
  const fileRef = useRef(null);
  const [armed, setArmed] = useArmed(); // 3秒押さなければ元に戻る

  function pick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) onUpload(file);
  }

  return (
    <Panel
      label="資料"
      right={
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()}>⬆ アップロード</button>
      }
    >
      <input ref={fileRef} type="file" hidden accept={ALLOWED_UPLOAD_MIMES.join(',')} onChange={pick} />
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="mat-list">
        {files.length === 0 && <p className="tiny muted" style={{ margin: 0 }}>資料はまだありません</p>}
        {files.map((f) => (
          <div key={f.id} className={`mat-item${f.mime && f.mime.startsWith('image/') ? ' is-img' : ''}`}>
            <span className="tiny strong">{fileKindLabel(f.mime)}</span>
            <MaterialButton className="mat-open name" file={f} onOpen={onOpen} active={previewId === f.id} />
            <span className="pages">{formatBytes(f.size)}</span>
            <button
              type="button"
              className={`mat-del${armed === f.id ? ' is-armed' : ''}`}
              aria-label={`${f.file_name} を削除`}
              onClick={() => {
                if (armed !== f.id) return setArmed(f.id);
                setArmed(null);
                onDelete(f);
              }}
            >
              {armed === f.id ? '削除する' : '✕'}
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** 理解度（主役）：わかった／わからない／もう一度 */
export function UnderstandingPanel({ summary, resetAt, onReset, isLive }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { understood = 0, confused = 0, again = 0, total = 0 } = summary || {};
  const answered = understood + confused + again;
  const base = total || answered;
  const pct = (n) => (base ? Math.round((n / base) * 100) : 0);
  // 「わからない」が回答の3割以上で注意表示
  const alert = answered > 0 && confused / answered >= 0.3;

  const rows = [
    { key: 'got', label: 'わかった', n: understood },
    { key: 'lost', label: 'わからない', n: confused },
    { key: 'again', label: 'もう一度', n: again },
  ];

  return (
    <div className={`panel understand${alert ? ' is-alert' : ''}`}>
      <div className="panel-head">
        <h6 className="section-label">
          理解度 <span className="count">{answered}{total ? `/${total}` : ''}人</span>
        </h6>
        {alert && <span className="tag tag-accent-2">「わからない」が多い</span>}
        <span className="right">
          {resetAt && <span className="tiny muted">最終リセットから {formatDuration((now - resetAt) / 1000)}</span>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onReset} disabled={!isLive}>↺ リセット</button>
        </span>
      </div>
      <div className="rows">
        {rows.map((r) => (
          <RowCells key={r.key} k={r.key} label={r.label} n={r.n} pct={pct(r.n)} />
        ))}
      </div>
    </div>
  );
}

function RowCells({ k, label, n, pct }) {
  return (
    <>
      <span className={`u-label u-${k}`}>{label}</span>
      <div className={`u-track u-${k}`}><span style={{ width: `${pct}%` }} /></div>
      <span className={`u-count u-${k}`}>{n}</span>
      <span className="u-pct">{pct}%</span>
    </>
  );
}

/** 配信状態のラベル（ヘッダー用） */
export function liveLabel(status) {
  if (status === LESSON_STATUS.LIVE) return '配信中';
  if (status === LESSON_STATUS.ENDED) return '終了';
  return '開始前';
}
