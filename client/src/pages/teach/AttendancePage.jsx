// 出席一覧・修正 — 担当：W5（デザイン：docs/design/07_出席一覧）
// API：GET /lessons/:id/attendance, PATCH /lessons/:id/attendance/:user_id, PATCH /lessons/:id（away_timeout_min）
// 授業中は attendance:update（Socket）で状態を更新し、退出中の経過も毎秒進める
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ATTENDANCE_STATUS, LESSON_STATUS, ROLES } from '@sotsuken/shared/constants';
import { SERVER_EVENTS } from '@sotsuken/shared/socket-events';
import { get, patch } from '../../api/client.js';
import { connectLesson, disconnectLesson } from '../../socket.js';
import RequireLogin, { useCurrentUser } from '../../components/shared/RequireLogin.jsx';
import Avatar from '../../components/shared/Avatar.jsx';
import RoleBadge from '../../components/shared/RoleBadge.jsx';
import useToast from '../../components/shared/useToast.jsx';
import { formatDuration, formatTime } from '../../components/shared/format.js';
import './attendance.css';

const NOTE_MAX = 100; // attendance.note VARCHAR(100)
const SOON_SEC = 3 * 60; // 欠課まで残り3分で強調

export const STATUS_LABEL = {
  [ATTENDANCE_STATUS.PRESENT]: '出席',
  [ATTENDANCE_STATUS.AWAY]: '一時退出',
  [ATTENDANCE_STATUS.ABSENT]: '欠課',
};
export const STATUS_TAG = {
  [ATTENDANCE_STATUS.PRESENT]: 'tag-accent',
  [ATTENDANCE_STATUS.AWAY]: 'tag-neutral',
  [ATTENDANCE_STATUS.ABSENT]: 'tag-accent-2',
};
const STATUS_ORDER = [ATTENDANCE_STATUS.ABSENT, ATTENDANCE_STATUS.AWAY, ATTENDANCE_STATUS.PRESENT];

export default function AttendancePage() {
  return (
    <RequireLogin role={ROLES.TEACHER}>
      <AttendanceBody />
    </RequireLogin>
  );
}

function AttendanceBody() {
  const { id } = useParams();
  const lessonId = Number(id);
  const { user } = useCurrentUser();
  const [toast, showToast] = useToast();
  const [lesson, setLesson] = useState(null);
  const [cls, setCls] = useState(null);
  const [rows, setRows] = useState(null);
  const [loadedAt, setLoadedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [editing, setEditing] = useState(null);
  const [timeout, setTimeoutMin] = useState('');

  const load = useCallback(() => {
    get(`/lessons/${lessonId}/attendance`).then((r) => {
      setRows(r || []);
      setLoadedAt(Date.now());
    });
  }, [lessonId]);

  useEffect(() => {
    get(`/lessons/${lessonId}`).then((l) => {
      setLesson(l);
      setTimeoutMin(String(l.away_timeout_min));
      get(`/classes/${l.class_id}`).then(setCls);
    });
    load();
  }, [lessonId, load]);

  const isLive = lesson && lesson.status === LESSON_STATUS.LIVE;
  const isEnded = lesson && lesson.status === LESSON_STATUS.ENDED;

  // 授業中だけ Socket で状態を受け取る
  useEffect(() => {
    if (!isLive) return undefined;
    const socket = connectLesson(lessonId);
    socket.on(SERVER_EVENTS.ATTENDANCE_UPDATE, () => load()); // away_since・remaining も変わるので取り直す
    socket.on(SERVER_EVENTS.LESSON_ENDED, () => {
      setLesson((l) => ({ ...l, status: LESSON_STATUS.ENDED }));
      load();
    });
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      disconnectLesson();
    };
  }, [isLive, lessonId, load]);

  // 退出中の生徒は「読み込み時からの経過」を足して表示する
  const elapsedSinceLoad = isLive ? Math.max(0, Math.floor((now - loadedAt) / 1000)) : 0;
  const view = useMemo(() => {
    if (!rows) return [];
    const list = rows.map((r) => {
      const away = r.status === ATTENDANCE_STATUS.AWAY;
      return {
        ...r,
        total: r.away_total_sec + (away && r.away_since ? Math.max(0, (now - new Date(r.away_since).getTime()) / 1000) : 0),
        remain: away ? Math.max(0, r.remaining_sec - elapsedSinceLoad) : r.remaining_sec,
      };
    });
    const filtered = filter === 'all' ? list : list.filter((r) => r.status === filter);
    const sorted = [...filtered];
    if (sort === 'name') sorted.sort((a, b) => a.user.name.localeCompare(b.user.name, 'ja'));
    if (sort === 'status') sorted.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
    if (sort === 'entered') sorted.sort((a, b) => (a.joined_at || '9').localeCompare(b.joined_at || '9'));
    if (sort === 'total') sorted.sort((a, b) => b.total - a.total);
    return sorted;
  }, [rows, filter, sort, now, elapsedSinceLoad]);

  const counts = useMemo(() => {
    const c = { present: 0, away: 0, absent: 0 };
    (rows || []).forEach((r) => {
      c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [rows]);

  async function saveTimeout(e) {
    e.preventDefault();
    const min = Number(timeout);
    if (!Number.isInteger(min) || min < 1 || min > 60) {
      showToast('1〜60 の整数で入力してください');
      return;
    }
    try {
      await patch(`/lessons/${lessonId}`, { away_timeout_min: min });
      setLesson((l) => ({ ...l, away_timeout_min: min }));
      showToast('保存しました');
      load();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function saveRow(userId, status, note) {
    try {
      await patch(`/lessons/${lessonId}/attendance/${userId}`, { status, note });
      setEditing(null);
      showToast('出席を修正しました');
      load();
    } catch (err) {
      showToast(err.message);
    }
  }

  if (!lesson || !rows) return <p className="page-loading">読み込み中…</p>;

  // 終了後は出席／欠課の2値（一時退出は残らない）
  const statusChoices = isEnded
    ? [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.ABSENT]
    : [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.AWAY, ATTENDANCE_STATUS.ABSENT];

  return (
    <div className="page attendance-page">
      <header className="app-header">
        <div className="hdr-titles">
          <div className="hdr-kicker">{cls ? `${cls.name} ・ ` : ''}出席一覧</div>
          <div className="hdr-title">{lesson.title}</div>
        </div>
        <div className="hdr-spacer summary" aria-label="出席の集計">
          <span className="status"><span className="dot" />出席 <strong>{counts.present}</strong></span>
          {!isEnded && <span className="status"><span className="dot dot-neutral" />一時退出 <strong>{counts.away}</strong></span>}
          <span className="status"><span className="dot dot-accent-2" />欠課 <strong>{counts.absent}</strong></span>
        </div>
        <span className="status" title="授業の状態">
          <span className={`dot${isLive ? '' : ' dot-neutral'}`} />
          {isLive ? '授業中' : isEnded ? '終了' : '開始前'}
        </span>
        <span className="person">
          <Avatar user={user} />
          <span className="person-name">{user.name}</span>
          <RoleBadge role={user.role} />
        </span>
        {isEnded ? (
          <Link className="btn btn-secondary" to={`/lessons/${lessonId}/result`}>← 授業結果に戻る</Link>
        ) : (
          <Link className="btn btn-secondary" to={`/lessons/${lessonId}/teach`}>← 先生画面に戻る</Link>
        )}
      </header>

      <main className="page-main">
        {isEnded && (
          <p className="ended-note">
            <span className="tag tag-accent">確定</span>
            授業は終了しました。出席は「出席／欠課」で確定済みです（退出中だった生徒は、退出時間の累積で判定）。必要ならこの画面から修正できます。
          </p>
        )}

        <section className="section settings">
          <h6 className="section-label">設定</h6>
          <form className="settings-row" onSubmit={saveTimeout}>
            <label htmlFor="timeoutMin">退出時間の合計がこの時間を超えると欠課</label>
            <input
              id="timeoutMin"
              className="input"
              type="number"
              min="1"
              max="60"
              step="1"
              inputMode="numeric"
              value={timeout}
              onChange={(e) => setTimeoutMin(e.target.value)}
            />
            <span>分</span>
            <button className="btn btn-secondary" type="submit">保存</button>
          </form>
          <p className="small muted settings-note">
            1回ごとではなく、授業全体の退出時間の<strong>累積</strong>で判定します（回線切断の時間も含みます）。
          </p>
        </section>

        <section className="section">
          <div className="list-head">
            <h6 className="section-label">出席一覧</h6>
            <div className="seg" role="radiogroup" aria-label="状態で絞り込み">
              {['all', ...statusChoices].map((v) => (
                <label key={v} className="seg-opt">
                  <input type="radio" name="filter" value={v} checked={filter === v} onChange={() => setFilter(v)} />
                  {v === 'all' ? 'すべて' : STATUS_LABEL[v]}
                </label>
              ))}
            </div>
            <label className="sort">
              <span className="small muted">並び替え</span>
              <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="name">名前順</option>
                <option value="status">状態順</option>
                <option value="entered">入室時刻順</option>
                <option value="total">累積退出時間が長い順</option>
              </select>
            </label>
          </div>

          <table className="table attendance-table">
            <thead>
              <tr>
                <th scope="col">名前</th>
                <th scope="col">状態</th>
                <th scope="col">入室時刻</th>
                <th scope="col">現在の退出開始</th>
                <th scope="col">累積退出時間</th>
                <th scope="col">メモ</th>
                <th scope="col"><span className="sr-only">操作</span></th>
              </tr>
            </thead>
            <tbody>
              {view.map((r) => {
                const soon = r.status === ATTENDANCE_STATUS.AWAY && r.remain <= SOON_SEC;
                const isEditing = editing === r.user.id;
                return [
                  <tr key={r.user.id} className={isEditing ? 'is-editing' : ''}>
                    <td>
                      <span className="person">
                        <Avatar user={r.user} size={26} />
                        <span className="person-name">{r.user.name}</span>
                      </span>
                    </td>
                    <td>
                      <span className="status-cell">
                        <span className={`tag ${STATUS_TAG[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        {r.status === ATTENDANCE_STATUS.AWAY && (
                          <span className={`remain${soon ? ' is-soon' : ''}`}>欠課まで {formatDuration(r.remain)}</span>
                        )}
                        {r.note && <span className="manual">✎ 修正済み</span>}
                      </span>
                    </td>
                    <td className="num">{r.joined_at ? formatTime(r.joined_at) : '—'}</td>
                    <td className="num">{r.status === ATTENDANCE_STATUS.AWAY && r.away_since ? formatTime(r.away_since) : '—'}</td>
                    <td className={`num total${soon ? ' is-soon' : ''}`}>{formatDuration(r.total)}</td>
                    <td className="memo" title={r.note || ''}>{r.note || ''}</td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => setEditing(isEditing ? null : r.user.id)}>修正</button>
                    </td>
                  </tr>,
                  isEditing && (
                    <EditorRow
                      key={`${r.user.id}-edit`}
                      row={r}
                      choices={statusChoices}
                      onCancel={() => setEditing(null)}
                      onSave={(status, note) => saveRow(r.user.id, status, note)}
                    />
                  ),
                ];
              })}
            </tbody>
          </table>
          {view.length === 0 && <p className="muted small empty-note">この条件に当てはまる生徒はいません。</p>}
        </section>
      </main>
      {toast}
    </div>
  );
}

function EditorRow({ row, choices, onCancel, onSave }) {
  const [status, setStatus] = useState(choices.includes(row.status) ? row.status : choices[0]);
  const [note, setNote] = useState(row.note || '');
  return (
    <tr className="editor-row">
      <td colSpan={7}>
        <form
          className="editor"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(status, note.trim());
          }}
        >
          <div className="field">
            <label>状態</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {choices.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>メモ（例：回線トラブルのため出席扱い）</label>
            <input
              className="input"
              maxLength={NOTE_MAX}
              placeholder="修正の理由を残しておくと後で分かりやすい"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="editor-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>取消</button>
            <button type="submit" className="btn btn-primary">保存</button>
          </div>
        </form>
      </td>
    </tr>
  );
}
