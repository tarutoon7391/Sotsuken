// 生徒画面（授業中）の本体 — 担当：W4（デザイン：docs/design/10_生徒画面_授業中）
// LearnPage が status=live のときに表示する。Socket は LearnPage が接続したものを受け取って使う。
// PC：3カラム（映像＋理解ボタン／資料／質問箱・チャット）。列の幅はつまみで変えられる
// スマホ：映像 → 3タブ（資料・質問箱・チャット）の縦積み。理解ボタンと挙手は下部固定
// props:
//   lessonId:  number
//   lesson:    LessonDetail（spotlight_user_id は spotlight:update で LearnPage が更新する）
//   className: string
//   me:        MeResponse
//   socket:    Socket|null
//   connected: boolean          Socket が繋がっているか（false なら再接続中の表示）
//   mobile:    boolean
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ATTENDANCE_STATUS, DEFAULTS, ERROR_CODES, FILE_KINDS, LESSON_STATUS, QUESTION_STATUS } from '@sotsuken/shared/constants';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@sotsuken/shared/socket-events';
import { get, post, upload } from '../../api/client.js';
import LessonHeader from '../../components/learn/LessonHeader.jsx';
import ConfirmDialog from '../../components/learn/ConfirmDialog.jsx';
import VideoStage from '../../components/learn/VideoStage.jsx';
import ReactionBar, { REACTIONS } from '../../components/learn/ReactionBar.jsx';
import MaterialPanel from '../../components/learn/MaterialPanel.jsx';
import { ChatPanel, QuestionBox, RoomAudio, useLiveKitRoom } from '../../components/learn/parts.js';
import AttentionModal from './AttentionModal.jsx';

/** id で重複を除いて昇順に並べる（REST の履歴と Socket の新着をまとめる） */
function mergeById(prev, rows) {
  const map = new Map(prev.map((r) => [r.id, r]));
  for (const r of rows) map.set(r.id, { ...map.get(r.id), ...r });
  return [...map.values()].sort((a, b) => a.id - b.id);
}

const COL_MIN = 0.6; // 列幅の下限（fr）
const ACK_TIMEOUT_MS = 8000; // Socket の ack を待つ上限（届かなければ通信エラーとして扱う）

export default function LessonLive({ lessonId, lesson, className, me, socket, connected, mobile }) {
  const navigate = useNavigate();
  // 生徒は授業が live のときだけ LiveKit に接続する（W3 の取り決め）
  const { room, status: videoStatus } = useLiveKitRoom(lessonId, { enabled: lesson.status === LESSON_STATUS.LIVE });

  // ---- 初回読み込みの失敗（画面に出して再読み込みできるようにする）
  const [loadErrors, setLoadErrors] = useState({ attendance: '', questions: '', chat: '' });
  const setLoadError = useCallback(
    (key, msg) => setLoadErrors((e) => (e[key] === msg ? e : { ...e, [key]: msg })),
    []
  );

  // ---- 自分の出席状態（ヘッダー表示・欠課バナー用）
  const [attendance, setAttendance] = useState(null);
  const loadAttendance = useCallback(() => {
    get(`/lessons/${lessonId}/attendance/me`)
      .then((a) => {
        setAttendance(a);
        setLoadError('attendance', '');
      })
      .catch((err) => setLoadError('attendance', err.message || '出席状態を取得できませんでした'));
  }, [lessonId, setLoadError]);

  // ---- トースト（映像の右上）・ボタン下の一文
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((text, kind = 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ text, kind });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef(null);
  const showFeedback = useCallback((text) => {
    clearTimeout(feedbackTimer.current);
    setFeedback(text);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 2500);
  }, []);
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(feedbackTimer.current);
    },
    []
  );

  // ---- タブ（未読バッジは見えていないタブにだけ付ける）
  const [pcTab, setPcTab] = useState('qa');
  const [mTab, setMTab] = useState('material');
  const [unread, setUnread] = useState({ qa: 0, chat: 0 });
  const visibleTab = mobile ? mTab : pcTab;
  const visibleTabRef = useRef(visibleTab);
  visibleTabRef.current = visibleTab;
  useEffect(() => {
    setUnread((u) => (u[visibleTab] ? { ...u, [visibleTab]: 0 } : u));
  }, [visibleTab]);
  const bumpUnread = useCallback((tab) => {
    if (visibleTabRef.current !== tab) setUnread((u) => ({ ...u, [tab]: u[tab] + 1 }));
  }, []);

  // ---- 質問・チャット・資料
  const [questions, setQuestions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [hasMoreChat, setHasMoreChat] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [materialsState, setMaterialsState] = useState({ loading: true, error: null });

  // ---- 理解リアクション・挙手
  const [reaction, setReaction] = useState(null);
  const [raising, setRaising] = useState(false); // question:raise を送って ack 待ち
  // 挙手中かどうかは「自分の open の挙手（body=null）が質問一覧にあるか」で決める（先生が回答済みにすると解除）
  const hand =
    raising ||
    questions.some((q) => q.body == null && q.user && q.user.id === me.id && q.status === QUESTION_STATUS.OPEN);

  const loadMaterials = useCallback(() => {
    setMaterialsState((s) => ({ ...s, loading: true, error: null }));
    get(`/lessons/${lessonId}/files`, { kind: FILE_KINDS.MATERIAL })
      .then((rows) => {
        setMaterials(rows || []);
        setMaterialsState({ loading: false, error: null });
      })
      .catch((err) => setMaterialsState({ loading: false, error: err.message || '資料を読み込めませんでした' }));
  }, [lessonId]);

  const loadQuestions = useCallback(() => {
    get(`/lessons/${lessonId}/questions`)
      .then((rows) => {
        setQuestions((prev) => mergeById(prev, rows || []));
        setLoadError('questions', '');
      })
      .catch((err) => setLoadError('questions', err.message || '質問を読み込めませんでした'));
  }, [lessonId, setLoadError]);

  const loadChat = useCallback(() => {
    get(`/lessons/${lessonId}/chat`, { limit: DEFAULTS.CHAT_PAGE_LIMIT })
      .then((rows) => {
        rows = rows || [];
        setMessages((prev) => mergeById(prev, rows));
        setHasMoreChat((more) => more || rows.length >= DEFAULTS.CHAT_PAGE_LIMIT);
        setLoadError('chat', '');
      })
      .catch((err) => setLoadError('chat', err.message || 'チャットを読み込めませんでした'));
  }, [lessonId, setLoadError]);

  // 初回（Socket の接続を待たない）と、再接続のたび（切れている間の発言・質問・資料を取りこぼさないため）に読み直す
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!connected && loadedOnce.current) return;
    loadedOnce.current = true;
    loadAttendance();
    loadMaterials();
    loadQuestions();
    loadChat();
  }, [connected, loadAttendance, loadMaterials, loadQuestions, loadChat]);

  const loadOlderChat = useCallback(() => {
    if (!messages.length) return;
    get(`/lessons/${lessonId}/chat`, { before: messages[0].id, limit: DEFAULTS.CHAT_PAGE_LIMIT })
      .then((rows) => {
        rows = rows || [];
        setMessages((prev) => mergeById(prev, rows));
        setHasMoreChat(rows.length >= DEFAULTS.CHAT_PAGE_LIMIT);
      })
      .catch(() => showToast('過去のメッセージを読み込めませんでした', 'miss'));
  }, [lessonId, messages, showToast]);

  // ---- 確認ポップアップ
  const [check, setCheck] = useState(null);

  // ---- Socket の受信
  useEffect(() => {
    if (!socket) return undefined;
    const handlers = {
      [SERVER_EVENTS.CHAT_MESSAGE]: (m) => {
        setMessages((prev) => mergeById(prev, [m]));
        bumpUnread('chat');
      },
      [SERVER_EVENTS.QUESTION_NEW]: (q) => {
        // status は v4.3 で追加。古いサーバーでも動くよう open を既定にする
        setQuestions((prev) => mergeById(prev, [{ status: QUESTION_STATUS.OPEN, ...q }]));
        if (q.body != null) bumpUnread('qa'); // 挙手のみ（body=null）は生徒の一覧に出ないので数えない
      },
      [SERVER_EVENTS.QUESTION_ANSWERED]: ({ id }) => {
        setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, status: QUESTION_STATUS.ANSWERED } : q)));
      },
      [SERVER_EVENTS.UNDERSTANDING_RESET]: () => setReaction(null),
      // 受け取った端末時刻を残す（カウントダウンは issued_at〜deadline_at の長さをここから数える）
      [SERVER_EVENTS.ATTENTION_CHECK]: (payload) => setCheck({ ...payload, receivedAt: Date.now() }),
      [SERVER_EVENTS.MATERIAL_ADDED]: (payload) => {
        const file = payload && payload.file;
        if (file) setMaterials((prev) => (prev.some((m) => m.id === file.id) ? prev : [...prev, file]));
      },
    };
    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
    return () => Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
  }, [socket, bumpUnread]);

  // ---- 操作
  function sendReaction(type) {
    if (!socket) return;
    socket.emit(CLIENT_EVENTS.UNDERSTANDING_SEND, { type });
    setReaction(type);
    const r = REACTIONS.find((x) => x.type === type);
    showFeedback(`「${r ? r.label : type}」を送りました`);
  }

  // 挙手の取り下げは無い（ストレッチ）。挙手中は押せない
  function raiseHand() {
    if (!socket || hand) return;
    setRaising(true);
    socket.timeout(ACK_TIMEOUT_MS).emit(CLIENT_EVENTS.QUESTION_RAISE, {}, (err, res) => {
      // 成功時は ack より先に question:new が届いているので、一覧から挙手中になる
      setRaising(false);
      if (err) showToast('挙手を送れませんでした。通信を確認してください', 'miss');
      else if (res && res.error) showToast(res.error.message || '挙手できませんでした', 'miss');
      else showFeedback('先生に手を挙げました');
    });
  }

  async function postQuestion(body, isAnonymous) {
    try {
      const res = await post(`/lessons/${lessonId}/questions`, { body, is_anonymous: isAnonymous });
      if (res && res.id) setQuestions((prev) => mergeById(prev, [{ status: QUESTION_STATUS.OPEN, ...res }]));
    } catch (err) {
      showToast(err.message || '質問を送れませんでした', 'miss');
    }
  }

  function sendChat(body) {
    if (socket) socket.emit(CLIENT_EVENTS.CHAT_MESSAGE, { body });
  }

  async function attachChat(file) {
    try {
      const fd = new FormData();
      fd.append('kind', FILE_KINDS.ATTACHMENT);
      fd.append('file', file);
      const { file_id: fileId } = await upload(`/lessons/${lessonId}/files`, fd);
      if (socket) socket.emit(CLIENT_EVENTS.CHAT_MESSAGE, { file_id: fileId });
    } catch (err) {
      showToast(err.message || '添付を送れませんでした', 'miss');
    }
  }

  // 結果はサーバーの ack で判断する（締切超過は CHECK_EXPIRED）
  function respondCheck(checkId) {
    if (!socket) return;
    setCheck((c) => (c && c.check_id === checkId ? { ...c, responding: true } : c));
    socket.timeout(ACK_TIMEOUT_MS).emit(CLIENT_EVENTS.ATTENTION_RESPOND, { check_id: checkId }, (err, res) => {
      setCheck((c) => (c && c.check_id === checkId ? null : c));
      if (err) showToast('応答を送れませんでした。通信を確認してください', 'miss');
      else if (res && res.error && res.error.code === ERROR_CODES.CHECK_EXPIRED) showToast('締切を過ぎました', 'miss');
      else if (res && res.error) showToast(res.error.message || '応答できませんでした', 'miss');
      else showToast('確認しました', 'ok');
    });
  }

  function timeoutCheck(checkId) {
    setCheck((c) => (c && c.check_id === checkId ? null : c));
    showToast('確認に応答できませんでした', 'miss');
  }

  // ---- 一時退出
  const [leave, setLeave] = useState({ open: false, busy: false, error: '' });
  async function confirmLeave() {
    setLeave({ open: true, busy: true, error: '' });
    try {
      await post(`/lessons/${lessonId}/attendance/away`);
      navigate(`/lessons/${lessonId}/away`);
    } catch (err) {
      const msg =
        err.code === ERROR_CODES.ALREADY_ABSENT
          ? 'この授業ではすでに欠課になっています。'
          : err.message || '一時退出できませんでした';
      setLeave({ open: true, busy: false, error: msg });
    }
  }

  // ---- 列幅（PC）
  const [weights, setWeights] = useState([3, 1.5, 1.3]);
  const [dragging, setDragging] = useState(false);
  const mainRef = useRef(null);
  function startDrag(pos, e) {
    e.preventDefault();
    const w0 = weights.slice();
    const total = w0[0] + w0[1] + w0[2];
    const pxPerFr = ((mainRef.current ? mainRef.current.clientWidth : 1200) - 48 - 40) / total;
    const x0 = e.clientX;
    setDragging(true);
    const onMove = (ev) => {
      const d = (ev.clientX - x0) / pxPerFr;
      const sum = w0[pos] + w0[pos + 1];
      const a = Math.min(sum - COL_MIN, Math.max(COL_MIN, w0[pos] + d));
      const w = w0.slice();
      w[pos] = a;
      w[pos + 1] = sum - a;
      setWeights(w);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // ---- 表示
  let headerStatus = { label: '出席中', tone: 'on' };
  if (!connected) headerStatus = { label: '再接続中', tone: 'off' };
  else if (attendance && attendance.status === ATTENDANCE_STATUS.ABSENT) headerStatus = { label: '欠課', tone: 'absent' };

  // 読み込み失敗の一文＋再読み込み
  const errorBar = (msg, retry) =>
    msg ? (
      <div className="lr-load-error" role="alert">
        <span>{msg}</span>
        <button type="button" className="btn btn-ghost" onClick={retry}>
          再読み込み
        </button>
      </div>
    ) : null;

  // ヘッダーの下に出すお知らせ（欠課・出席状態の取得失敗）
  const banners = (
    <>
      {attendance && attendance.status === ATTENDANCE_STATUS.ABSENT && (
        <div className="lr-banner is-absent" role="status">
          この授業は欠課になっています。視聴は続けられます。出席の修正は先生に依頼してください。
        </div>
      )}
      {loadErrors.attendance && <div className="lr-banner">{errorBar(loadErrors.attendance, loadAttendance)}</div>}
    </>
  );

  const leaveButton = (
    <button type="button" className="btn btn-secondary lr-btn-leave" onClick={() => setLeave({ open: true, busy: false, error: '' })}>
      一時退出
    </button>
  );

  const video = (
    <VideoStage
      room={room}
      videoStatus={videoStatus}
      teacher={lesson.teacher}
      spotlightUserId={lesson.spotlight_user_id}
      meId={me.id}
      reconnecting={!connected}
      toast={toast}
      mobile={mobile}
    />
  );
  const reactionBar = (
    <ReactionBar
      selected={reaction}
      onReact={sendReaction}
      hand={hand}
      onHand={raiseHand}
      feedback={feedback || (hand ? '挙手中です。先生が対応すると解除されます' : '')}
      mobile={mobile}
    />
  );
  const questionBox = (
    <>
      {errorBar(loadErrors.questions, loadQuestions)}
      <QuestionBox questions={questions} onPost={postQuestion} isTeacher={false} />
    </>
  );
  const chatPanel = (
    <>
      {errorBar(loadErrors.chat, loadChat)}
      <ChatPanel
        messages={messages}
        onSend={sendChat}
        onAttach={attachChat}
        currentUser={me}
        onLoadMore={hasMoreChat ? loadOlderChat : undefined}
      />
    </>
  );
  const badge = (tab) => (unread[tab] > 0 ? <span className="lr-badge">{unread[tab]}</span> : null);
  // 資料は material:added で増える（再読み込みボタンは置かない）。読み込み失敗時だけ再読み込みを出す
  const materialPanel = (
    <MaterialPanel
      materials={materials}
      loading={materialsState.loading && materials.length === 0}
      error={materialsState.error}
      onRetry={loadMaterials}
      mobile={mobile}
    />
  );

  const overlays = (
    <>
      <RoomAudio room={room} spotlightUserId={lesson.spotlight_user_id} />
      {leave.open && (
        <ConfirmDialog
          title="一時退出しますか？"
          body={`この授業での退出時間の合計が${lesson.away_timeout_min ?? DEFAULTS.AWAY_TIMEOUT_MIN}分を超えると欠課扱いになります。`}
          confirmLabel="退出する"
          busy={leave.busy}
          error={leave.error}
          onCancel={() => setLeave({ open: false, busy: false, error: '' })}
          onConfirm={confirmLeave}
        />
      )}
      {check && (
        <AttentionModal
          key={check.check_id}
          check={check}
          busy={Boolean(check.responding)}
          onRespond={respondCheck}
          onTimeout={timeoutCheck}
        />
      )}
    </>
  );

  if (mobile) {
    return (
      <div className="lr-m">
        <LessonHeader className={className} title={lesson.title} status={headerStatus} me={me} action={leaveButton} mobile />
        {banners}
        <div className="lr-m-video">{video}</div>
        <div className="lr-cam-note">カメラONでも映像は先生にだけ届きます</div>

        <div className="lr-m-tabs" role="tablist">
          {[
            ['material', '資料'],
            ['qa', '質問箱'],
            ['chat', 'チャット'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mTab === key}
              className={`lr-tab${mTab === key ? ' is-active' : ''}`}
              onClick={() => setMTab(key)}
            >
              {label} {key !== 'material' && badge(key)}
            </button>
          ))}
        </div>

        <div className="lr-m-body">
          <div className="lr-m-panel">
            {mTab === 'material' && materialPanel}
            {mTab === 'qa' && <div className="lr-tab-body">{questionBox}</div>}
            {mTab === 'chat' && <div className="lr-tab-body">{chatPanel}</div>}
          </div>
        </div>

        {reactionBar}
        {overlays}
      </div>
    );
  }

  return (
    <div className={`lr-pc${dragging ? ' is-dragging' : ''}`}>
      <LessonHeader className={className} title={lesson.title} status={headerStatus} me={me} action={leaveButton} />
      {banners}

      <main
        className="lr-pc-main"
        ref={mainRef}
        style={{
          gridTemplateColumns: `minmax(220px,${weights[0]}fr) 20px minmax(150px,${weights[1]}fr) 20px minmax(200px,${weights[2]}fr)`,
        }}
      >
        <section className="lr-col">
          <div className="lr-col-head">
            <h6>映像</h6>
          </div>
          {video}
          {reactionBar}
        </section>

        <div className="lr-gutter" onPointerDown={(e) => startDrag(0, e)}>
          <span />
        </div>

        <section className="lr-col">
          <div className="lr-col-head">
            <h6>資料</h6>
          </div>
          {materialPanel}
        </section>

        <div className="lr-gutter" onPointerDown={(e) => startDrag(1, e)}>
          <span />
        </div>

        <section className="lr-col">
          <div className="lr-tabs" role="tablist">
            {[
              ['qa', '質問箱'],
              ['chat', 'チャット'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={pcTab === key}
                className={`lr-tab${pcTab === key ? ' is-active' : ''}`}
                onClick={() => setPcTab(key)}
              >
                {label} {badge(key)}
              </button>
            ))}
          </div>
          <div className="lr-tab-body">{pcTab === 'qa' ? questionBox : chatPanel}</div>
        </section>
      </main>
      {overlays}
    </div>
  );
}
