// 先生画面（授業中） — 担当：W5（デザイン：docs/design/06_先生画面_授業中）
// API：GET /lessons/:id, /classes/:id, /classes/:id/members, /lessons/:id/attendance, /lessons/:id/understanding,
//      /lessons/:id/questions, /lessons/:id/files?kind=material, /lessons/:id/chat,
//      POST /lessons/:id/start|end|attention|files, PATCH /lessons/:id/attention/auto, /questions/:id,
//      GET /attention/:check_id, DELETE /files/:id, PUT /lessons/:id/spotlight（W3 putSpotlight）
// Socket：understanding:update/reset, question:new/answered/raised, attention:update, attendance:update,
//         spotlight:update, chat:message, lesson:started/ended（受信）／ chat:message, understanding:reset（送信）
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ALLOWED_UPLOAD_MIMES,
  ATTENDANCE_STATUS,
  DEFAULTS,
  ERROR_CODES,
  FILE_KINDS,
  LIMITS,
  LESSON_STATUS,
  QUESTION_STATUS,
  ROLES,
} from '@sotsuken/shared/constants';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@sotsuken/shared/socket-events';
import { del, get, patch, post, upload } from '../../api/client.js';
import { connectLesson, disconnectLesson } from '../../socket.js';
import RequireLogin, { useCurrentUser } from '../../components/shared/RequireLogin.jsx';
import Avatar from '../../components/shared/Avatar.jsx';
import RoleBadge from '../../components/shared/RoleBadge.jsx';
import ChatPanel from '../../components/shared/ChatPanel.jsx';
import QuestionBox from '../../components/shared/QuestionBox.jsx';
import useToast from '../../components/shared/useToast.jsx';
import useEscape from '../../components/shared/useEscape.js';
import MaterialPreview from '../../components/shared/MaterialPreview.jsx';
import { formatBytes, formatDuration } from '../../components/shared/format.js';
import {
  useLiveKitRoom,
  TeacherPublisher,
  StudentGrid,
  RoomAudio,
  putSpotlight,
  STATUS_LABELS,
} from '../../livekit';
import {
  AttendancePanel,
  AttentionPanel,
  MaterialPanel,
  UnderstandingPanel,
  liveLabel,
} from './TeachPanels.jsx';
import './teach.css';

const EMPTY_UNDERSTANDING = { understood: 0, confused: 0, again: 0, total: 0 };

/** id で重複を除いてマージ */
function mergeById(list, items) {
  const map = new Map(list.map((x) => [x.id, x]));
  items.forEach((x) => map.set(x.id, x));
  return [...map.values()];
}

export default function TeachPage() {
  return (
    <RequireLogin role={ROLES.TEACHER}>
      <TeachBody />
    </RequireLogin>
  );
}

function TeachBody() {
  const { id } = useParams();
  const lessonId = Number(id);
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [toast, showToast] = useToast(3000);

  const [lesson, setLesson] = useState(null);
  const [cls, setCls] = useState(null);
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState({}); // user_id → { status, away_total_sec, away_since }
  const [loadError, setLoadError] = useState('');
  const [understanding, setUnderstanding] = useState(EMPTY_UNDERSTANDING);
  const [resetAt, setResetAt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [materialError, setMaterialError] = useState('');
  const [messages, setMessages] = useState([]);
  const [hasOlder, setHasOlder] = useState(true);
  const [spotlightUserId, setSpotlightUserId] = useState(null);
  const [check, setCheck] = useState(null);
  const [checkResult, setCheckResult] = useState(null);
  const [autoInterval, setAutoInterval] = useState(DEFAULTS.ATTENTION_AUTO_INTERVAL_MIN);
  const [socketDown, setSocketDown] = useState(false);
  const [rightTab, setRightTab] = useState('qa');
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState({ qa: 0, chat: 0 });
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [preview, setPreview] = useState(null); // プレビュー中の資料（FileInfo）
  const [busy, setBusy] = useState('');
  const closeEnd = useCallback(() => setConfirmEnd(false), []);
  useEscape(confirmEnd ? closeEnd : null); // 終了確認ダイアログは Esc で閉じる
  const rightTabRef = useRef(rightTab);
  const collapsedRef = useRef(collapsed);
  rightTabRef.current = rightTab;
  collapsedRef.current = collapsed;

  const isLive = lesson && lesson.status === LESSON_STATUS.LIVE;
  const { room, status: lkStatus } = useLiveKitRoom(lessonId, { enabled: !!lesson });

  // ---------------------------------------------------------------- 初期読み込み
  // 補助データの読み込み失敗はトーストで知らせる（401/403/404 は client.js が遷移させる）
  const warn = useCallback((err) => showToast(err.message), [showToast]);
  const loadAttendance = useCallback(() => {
    get(`/lessons/${lessonId}/attendance`)
      .then((rows) => {
        const map = {};
        (rows || []).forEach((r) => {
          map[r.user.id] = { status: r.status, away_total_sec: r.away_total_sec, away_since: r.away_since };
        });
        setAttendance(map);
      })
      .catch(warn);
  }, [lessonId, warn]);
  const loadQuestions = useCallback(() => {
    get(`/lessons/${lessonId}/questions`)
      .then((rows) => setQuestions(rows || []))
      .catch(warn);
  }, [lessonId, warn]);
  const loadMaterials = useCallback(() => {
    get(`/lessons/${lessonId}/files`, { kind: FILE_KINDS.MATERIAL })
      .then((rows) => setMaterials(rows || []))
      .catch(warn);
  }, [lessonId, warn]);

  useEffect(() => {
    let alive = true;
    get(`/lessons/${lessonId}`)
      .then((l) => {
        if (!alive) return;
        if (l.status === LESSON_STATUS.ENDED) {
          navigate(`/lessons/${lessonId}/result`, { replace: true });
          return;
        }
        setLesson(l);
        setSpotlightUserId(l.spotlight_user_id);
        get(`/classes/${l.class_id}`).then((c) => alive && setCls(c)).catch(warn);
        get(`/classes/${l.class_id}/members`).then((rows) => alive && setMembers(rows || [])).catch(warn);
      })
      .catch((err) => alive && setLoadError(err.message)); // 授業が取れないと画面を出せない
    get(`/lessons/${lessonId}/understanding`)
      .then((u) => alive && u && setUnderstanding(u.current))
      .catch(warn);
    get(`/lessons/${lessonId}/attention/auto`)
      .then((a) => alive && a && setAutoInterval(a.interval_min))
      .catch(warn);
    get(`/lessons/${lessonId}/chat`, { limit: DEFAULTS.CHAT_PAGE_LIMIT })
      .then((rows) => {
        if (!alive) return;
        setMessages(rows || []);
        setHasOlder((rows || []).length >= DEFAULTS.CHAT_PAGE_LIMIT);
      })
      .catch(warn);
    loadAttendance();
    loadQuestions();
    loadMaterials();
    return () => {
      alive = false;
    };
  }, [lessonId, navigate, warn, loadAttendance, loadQuestions, loadMaterials]);

  // ---------------------------------------------------------------- Socket
  useEffect(() => {
    const socket = connectLesson(lessonId);
    const bump = (key) => {
      const visible = !collapsedRef.current && rightTabRef.current === key;
      if (!visible) setUnread((u) => ({ ...u, [key]: u[key] + 1 }));
    };

    let wasDown = false;
    socket.on('connect', () => {
      setSocketDown(false);
      if (wasDown) {
        // 再接続したら取りこぼしを取り直す
        loadAttendance();
        loadQuestions();
      }
      wasDown = false;
    });
    socket.on('disconnect', () => {
      wasDown = true;
      setSocketDown(true);
    });

    socket.on(SERVER_EVENTS.UNDERSTANDING_UPDATE, (data) => setUnderstanding(data));
    socket.on(SERVER_EVENTS.UNDERSTANDING_RESET, () => {
      // 人数も含めて 0 に戻す（直後にサーバーから 0 件の understanding:update も届く）
      setUnderstanding(EMPTY_UNDERSTANDING);
      setResetAt(Date.now());
    });
    socket.on(SERVER_EVENTS.QUESTION_NEW, (q) => {
      setQuestions((list) => mergeById(list, [{ status: QUESTION_STATUS.OPEN, ...q }]));
      bump('qa');
    });
    socket.on(SERVER_EVENTS.QUESTION_ANSWERED, ({ id: qid }) => {
      setQuestions((list) => list.map((q) => (q.id === qid ? { ...q, status: QUESTION_STATUS.ANSWERED } : q)));
    });
    socket.on(SERVER_EVENTS.QUESTION_RAISED, ({ user: u }) => {
      showToast(`✋ ${u.name} さんが挙手しました`);
      loadQuestions(); // 挙手は質問（body なし）として記録されるので一覧を取り直す
    });
    // 確認：手動・自動とも attention:check（全員宛）で始まり、直後の attention:update が応答状況の初期値になる
    socket.on(SERVER_EVENTS.ATTENTION_CHECK, ({ check_id, issued_at, deadline_at, auto }) => {
      setCheck({ check_id, issued_at, deadline_at, auto });
      setCheckResult(null);
    });
    socket.on(SERVER_EVENTS.ATTENTION_UPDATE, (data) => setCheckResult(data));
    socket.on(SERVER_EVENTS.ATTENDANCE_UPDATE, ({ user_id, status, away_total_sec }) => {
      setAttendance((m) => {
        const prev = m[user_id];
        // 退出開始時刻はイベントに無いので、away になった時点を手元で記録する
        let awaySince = null;
        if (status === ATTENDANCE_STATUS.AWAY) {
          awaySince = prev && prev.status === ATTENDANCE_STATUS.AWAY && prev.away_since ? prev.away_since : new Date().toISOString();
        }
        return { ...m, [user_id]: { status, away_total_sec, away_since: awaySince } };
      });
    });
    socket.on(SERVER_EVENTS.MATERIAL_ADDED, ({ file }) => {
      if (file) setMaterials((list) => mergeById(list, [file]));
    });
    socket.on(SERVER_EVENTS.SPOTLIGHT_UPDATE, ({ user_id }) => setSpotlightUserId(user_id));
    socket.on(SERVER_EVENTS.CHAT_MESSAGE, (m) => {
      setMessages((list) => mergeById(list, [m]));
      bump('chat');
    });
    socket.on(SERVER_EVENTS.LESSON_STARTED, () => {
      setLesson((l) => (l ? { ...l, status: LESSON_STATUS.LIVE, started_at: l.started_at || new Date().toISOString() } : l));
      loadAttendance();
    });
    // 先生は授業結果へ直行する（/ended を経由しない）
    socket.on(SERVER_EVENTS.LESSON_ENDED, () => navigate(`/lessons/${lessonId}/result`, { replace: true }));

    return () => disconnectLesson();
  }, [lessonId, navigate, showToast, loadAttendance, loadQuestions]);

  // 確認の締切後に最終結果を取り直す
  useEffect(() => {
    if (!check) return undefined;
    const wait = new Date(check.deadline_at).getTime() - Date.now() + 500;
    const t = setTimeout(() => {
      get(`/attention/${check.check_id}`)
        .then((r) => r && setCheckResult({ responded: r.responded, pending: r.pending }))
        .catch(warn);
    }, Math.max(0, wait));
    return () => clearTimeout(t);
  }, [check, warn]);

  // ---------------------------------------------------------------- 経過時間
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---------------------------------------------------------------- 派生値
  const students = useMemo(() => members.filter((m) => m.role !== ROLES.TEACHER), [members]);
  const counts = useMemo(() => {
    const c = { present: 0, away: 0, absent: 0 };
    students.forEach((s) => {
      const st = (attendance[s.id] && attendance[s.id].status) || ATTENDANCE_STATUS.ABSENT;
      if (st === ATTENDANCE_STATUS.PRESENT) c.present += 1;
      else if (st === ATTENDANCE_STATUS.AWAY) c.away += 1;
      else c.absent += 1;
    });
    return c;
  }, [students, attendance]);
  const raisedUserIds = useMemo(
    () => questions.filter((q) => q.body == null && q.status === QUESTION_STATUS.OPEN && q.user).map((q) => q.user.id),
    [questions]
  );
  const spotlightUser = students.find((s) => s.id === spotlightUserId);

  // ---------------------------------------------------------------- 操作
  async function startLesson() {
    setBusy('start');
    try {
      await post(`/lessons/${lessonId}/start`, undefined, { redirect: false });
      setLesson((l) => ({ ...l, status: LESSON_STATUS.LIVE, started_at: new Date().toISOString() }));
      loadAttendance();
    } catch (err) {
      showToast(err.code === ERROR_CODES.ALREADY_LIVE ? 'このクラスで開催中の授業があります。先に終了してください' : err.message);
    } finally {
      setBusy('');
    }
  }

  async function endLesson() {
    setBusy('end');
    try {
      await post(`/lessons/${lessonId}/end`, undefined, { redirect: false });
      navigate(`/lessons/${lessonId}/result`, { replace: true }); // 先生は授業結果へ直行
    } catch (err) {
      showToast(err.message);
      setBusy('');
      setConfirmEnd(false);
    }
  }

  async function issueCheck() {
    setBusy('check');
    try {
      // 応答状況は attention:check → attention:update（サーバーが算出）で受け取る。ここでは締切だけ先に反映
      const res = await post(`/lessons/${lessonId}/attention`, { timeout_sec: DEFAULTS.ATTENTION_TIMEOUT_SEC });
      setCheck((c) => (c && c.check_id === res.check_id ? c : { ...res, issued_at: new Date().toISOString() }));
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusy('');
    }
  }

  async function changeAuto(min) {
    const prev = autoInterval;
    setAutoInterval(min);
    try {
      await patch(`/lessons/${lessonId}/attention/auto`, { interval_min: min });
      showToast(min ? `${min}分ごとに自動で確認を送ります` : '自動の確認をオフにしました');
    } catch (err) {
      setAutoInterval(prev);
      showToast(err.message);
    }
  }

  function resetUnderstanding() {
    const socket = connectLesson(lessonId);
    socket.emit(CLIENT_EVENTS.UNDERSTANDING_RESET, {});
  }

  async function spotlight(userId) {
    try {
      await putSpotlight(lessonId, userId);
      setSpotlightUserId(userId); // spotlight:update でも届くが先に反映
    } catch (err) {
      showToast(err.message);
    }
  }

  async function markAnswered(qid) {
    try {
      await patch(`/questions/${qid}`, { status: QUESTION_STATUS.ANSWERED });
      setQuestions((list) => list.map((q) => (q.id === qid ? { ...q, status: QUESTION_STATUS.ANSWERED } : q)));
    } catch (err) {
      showToast(err.message);
    }
  }

  async function uploadMaterial(file) {
    setMaterialError('');
    if (!ALLOWED_UPLOAD_MIMES.includes(file.type)) return setMaterialError('画像・PDF・Office 文書のみアップロードできます');
    if (file.size > LIMITS.MATERIAL_MAX_BYTES) return setMaterialError(`${formatBytes(LIMITS.MATERIAL_MAX_BYTES)}までのファイルにしてください`);
    const fd = new FormData();
    fd.append('kind', FILE_KINDS.MATERIAL);
    fd.append('file', file);
    try {
      await upload(`/lessons/${lessonId}/files`, fd);
      loadMaterials();
      showToast(`「${file.name}」をアップロードしました`);
    } catch (err) {
      setMaterialError(err.message);
    }
  }

  async function deleteMaterial(f) {
    try {
      await del(`/files/${f.id}`, { redirect: false });
      setMaterials((list) => list.filter((x) => x.id !== f.id));
      setPreview((p) => (p && p.id === f.id ? null : p));
    } catch (err) {
      setMaterialError(err.message);
    }
  }

  function sendChat(body) {
    connectLesson(lessonId).emit(CLIENT_EVENTS.CHAT_MESSAGE, { body });
  }

  async function attachChat(file) {
    const fd = new FormData();
    fd.append('kind', FILE_KINDS.ATTACHMENT);
    fd.append('file', file);
    try {
      const { file_id } = await upload(`/lessons/${lessonId}/files`, fd);
      connectLesson(lessonId).emit(CLIENT_EVENTS.CHAT_MESSAGE, { file_id });
    } catch (err) {
      showToast(err.message);
    }
  }

  async function loadOlderChat() {
    if (messages.length === 0) return;
    const oldest = Math.min(...messages.map((m) => m.id));
    const rows = await get(`/lessons/${lessonId}/chat`, { before: oldest, limit: DEFAULTS.CHAT_PAGE_LIMIT });
    setMessages((list) => mergeById(list, rows || []));
    setHasOlder((rows || []).length >= DEFAULTS.CHAT_PAGE_LIMIT);
  }

  function openTab(key) {
    setRightTab(key);
    setCollapsed(false);
    setUnread((u) => ({ ...u, [key]: 0 }));
  }

  // ---------------------------------------------------------------- 表示
  if (!lesson) {
    if (loadError) return <div className="page-loading form-alert" role="alert">{loadError}</div>;
    return <p className="page-loading">読み込み中…</p>;
  }

  const elapsed = lesson.started_at ? formatDuration((now - new Date(lesson.started_at).getTime()) / 1000) : '';
  const reconnecting = socketDown || lkStatus === 'reconnecting';

  /** 欠課までの残り秒数（閾値 − 累積 − 今回の経過） */
  function remainingSec(a) {
    const current = a.away_since ? Math.max(0, (now - new Date(a.away_since).getTime()) / 1000) : 0;
    return Math.max(0, lesson.away_timeout_min * 60 - a.away_total_sec - current);
  }

  // セルの下部（W3 StudentGrid の renderCellFooter）。一時退出中のセルは teach.css の :has() で減光する
  function cellFooter(s) {
    const a = attendance[s.id];
    const st = a && a.status;
    if (st === ATTENDANCE_STATUS.AWAY) {
      return <span className="cell-foot is-away">一時退出中・あと {formatDuration(remainingSec(a))}</span>;
    }
    if (st === ATTENDANCE_STATUS.ABSENT && isLive) return <span className="cell-foot is-absent">欠課</span>;
    return null;
  }

  return (
    <div className="app teach-app">
      <header className="app-header">
        <Link className="hdr-back" to={`/classes/${lesson.class_id}`} title="クラス詳細へ">←</Link>
        <div className="hdr-left">
          <div className="hdr-kicker">{cls ? cls.name : ''}</div>
          <div className="hdr-title">{lesson.title}</div>
        </div>
        <span className="hdr-spacer" />
        <span className="status">
          <span className={`dot${isLive ? ' dot-live' : ' dot-neutral'}`} />
          <span>{liveLabel(lesson.status)}</span>
          {isLive && <span className="elapsed">{elapsed}</span>}
        </span>
        <span className="person">
          <Avatar user={user} />
          <span className="person-name">{user.name}</span>
          <RoleBadge role={user.role} />
        </span>
        {isLive ? (
          <button type="button" className="btn btn-secondary btn-danger" onClick={() => setConfirmEnd(true)}>■ 授業を終了</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={startLesson} disabled={busy === 'start'}>
            {busy === 'start' ? '開始中…' : '▶ 授業を開始'}
          </button>
        )}
      </header>

      {reconnecting && (
        <div className="reconnect-band"><span className="spinner" />再接続中… 配信と生徒の映像が一時的に止まっています</div>
      )}

      <main className={`teach${collapsed ? ' is-collapsed' : ''}`}>
        {/* ===== 左：配信／出席／確認／資料（脇役） ===== */}
        <aside className="col col-left">
          <div className="panel">
            <div className="panel-head">
              <h6 className="section-label">配信</h6>
              <span className="right conn"><span className={`dot${lkStatus === 'connected' ? '' : ' dot-neutral'}`} />{STATUS_LABELS[lkStatus] || lkStatus}</span>
            </div>
            <TeacherPublisher room={room} status={lkStatus} />
          </div>
          <AttendancePanel lessonId={lessonId} counts={counts} />
          <AttentionPanel
            isLive={isLive}
            check={check}
            result={checkResult}
            onIssue={issueCheck}
            autoInterval={autoInterval}
            onAutoChange={changeAuto}
            busy={busy === 'check'}
          />
          <MaterialPanel
            files={materials}
            onUpload={uploadMaterial}
            onDelete={deleteMaterial}
            error={materialError}
            onOpen={setPreview}
            previewId={preview ? preview.id : null}
          />
        </aside>

        {/* ===== 中央：理解度＋生徒グリッド（主役） ===== */}
        <section className="col col-center">
          {!isLive && (
            <div className="before-band">
              授業はまだ始まっていません。準備ができたら「授業を開始」を押してください（待機中の生徒が出席になります）。
              <button type="button" className="btn btn-primary btn-sm" onClick={startLesson} disabled={busy === 'start'}>▶ 授業を開始</button>
            </div>
          )}
          <UnderstandingPanel summary={understanding} resetAt={resetAt} onReset={resetUnderstanding} isLive={isLive} />

          {spotlightUser && (
            <div className="spot-banner">
              ★ <span><strong>{spotlightUser.name}</strong> をスポットライト中（全員の画面に表示されています）</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => spotlight(null)}>解除</button>
            </div>
          )}

          <div className="grid-head">
            <h6 className="section-label" style={{ margin: 0 }}>
              生徒 <span className="count">入室 {counts.present}人 / {students.length}人</span>
            </h6>
            <div className="legend">
              <span><i className="sw sw-hand" />挙手中</span>
              <span><i className="sw sw-away" />一時退出中</span>
            </div>
          </div>
          <div className="grid-wrap">
            <StudentGrid
              room={room}
              students={students}
              spotlightUserId={spotlightUserId}
              onSpotlight={isLive ? spotlight : undefined}
              highlightUserIds={raisedUserIds}
              renderCellFooter={cellFooter}
            />
          </div>
        </section>

        {/* ===== 右：質問箱／チャット（生徒画面と同じ部品） ===== */}
        <aside className={`col col-right${collapsed ? ' is-collapsed' : ''}`}>
          <div className="right-head">
            <div className="tabs" role="tablist">
              <button className={`tab${rightTab === 'qa' ? ' is-on' : ''}`} role="tab" onClick={() => openTab('qa')}>
                質問箱 {unread.qa > 0 && <span className="badge">{unread.qa}</span>}
              </button>
              <button className={`tab${rightTab === 'chat' ? ' is-on' : ''}`} role="tab" onClick={() => openTab('chat')}>
                チャット {unread.chat > 0 && <span className="badge">{unread.chat}</span>}
              </button>
            </div>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="右カラムをたたむ" title="たたむ" onClick={() => setCollapsed(true)}>▶</button>
          </div>
          <div className="rail">
            <button type="button" className="rail-btn" aria-label="右カラムを開く" title="開く" onClick={() => setCollapsed(false)}>◀</button>
            <button type="button" className="rail-btn" aria-label="質問箱" onClick={() => openTab('qa')}>
              ？{unread.qa > 0 && <span className="badge">{unread.qa}</span>}
            </button>
            <button type="button" className="rail-btn" aria-label="チャット" onClick={() => openTab('chat')}>
              💬{unread.chat > 0 && <span className="badge">{unread.chat}</span>}
            </button>
          </div>
          <div className="right-body">
            <div className="pane" hidden={rightTab !== 'qa'}>
              <QuestionBox questions={questions} onMarkAnswered={markAnswered} isTeacher />
            </div>
            <div className="pane" hidden={rightTab !== 'chat'}>
              <ChatPanel
                messages={messages}
                onSend={sendChat}
                onAttach={attachChat}
                currentUser={user}
                onLoadMore={hasOlder ? loadOlderChat : undefined}
              />
            </div>
          </div>
        </aside>
      </main>

      <RoomAudio room={room} spotlightUserId={spotlightUserId} />

      {confirmEnd && (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-labelledby="dlgEndTitle">
            <div className="dialog-title" id="dlgEndTitle">授業を終了しますか？</div>
            <div className="dialog-body">配信が止まり、生徒は授業終了画面に移動します。出席と理解度の記録は「授業結果」から確認できます。</div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmEnd(false)}>キャンセル</button>
              <button type="button" className="btn btn-primary" onClick={endLesson} disabled={busy === 'end'}>
                {busy === 'end' ? '終了中…' : '終了する'}
              </button>
            </div>
          </div>
        </div>
      )}
      <MaterialPreview file={preview} onClose={() => setPreview(null)} />
      {toast}
    </div>
  );
}
