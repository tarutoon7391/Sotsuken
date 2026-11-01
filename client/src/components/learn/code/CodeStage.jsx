// 生徒のプログラミングモード本体（課題タブ・エディタ・保存／実行・出力・スポットライト）— 担当：W4（F-10・docs/07 §15.1）
// LessonLive が lesson.mode === 'coding' のとき映像エリアの代わりに表示する。
// 段階 1：コードはこの画面のローカル state だけ（save / run に source を送る）。段階 2 で Yjs に差し替える。
// props:
//   lessonId:  number
//   lesson:    LessonDetail（active_task_id は code:active_task で LearnPage が更新する）
//   me:        MeResponse
//   socket:    Socket|null
//   connected: boolean
//   mobile:    boolean
//   showToast: (text, kind?) => void
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CODE_RUN_KINDS, CODE_RUN_STATUS, ERROR_CODES } from '@sotsuken/shared/constants';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@sotsuken/shared/socket-events';
import { get, post } from '../../../api/client.js';
import CodeEditor from './CodeEditor.jsx';
import TaskTabs from './TaskTabs.jsx';
import RunPanel from './RunPanel.jsx';
import OutputPanel, { runLabel } from './OutputPanel.jsx';
import './code.css';

const MOBILE_HINT_KEY = 'manabiba.code.mobileHint';

/** 課題ごとの作業状態の初期値 */
function emptyWork(source) {
  return {
    source,            // いまのコード
    loaded: false,     // 自分の保存済みコードを取り直したか
    dirty: false,      // 最後の保存から変えたか
    syntax: { hasError: false, line: null },
    compileErrors: [], // 最後の保存のコンパイルエラー
    lastRun: null,     // 直近の code:run_result
    saving: false,
    running: false,
    queued: null,      // 実行待ちの順番（0 で実行中）
    resetCount: 0,     // 再配布のたびに増やしてエディタを作り直す
    error: '',         // 直近の失敗（429 / 503 など）
  };
}

export default function CodeStage({ lessonId, lesson, me, socket, connected, mobile, showToast }) {
  const [tasks, setTasks] = useState([]);
  const [tasksError, setTasksError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [works, setWorks] = useState({}); // taskId → work
  const [spotlight, setSpotlight] = useState(null); // { user_id, task_id, user, source } | null
  const [teacherEditing, setTeacherEditing] = useState({}); // taskId → bool
  const activeId = lesson.active_task_id;

  const updateWork = useCallback((taskId, patch) => {
    setWorks((w) => {
      const cur = w[taskId] || emptyWork('');
      const next = typeof patch === 'function' ? patch(cur) : patch;
      return { ...w, [taskId]: { ...cur, ...next } };
    });
  }, []);

  // ---- 課題一覧（初回・再接続のたび）
  const loadTasks = useCallback(async () => {
    try {
      const list = (await get(`/lessons/${lessonId}/code/tasks`)) || [];
      setTasks(list);
      setTasksError('');
      setWorks((w) => {
        const next = { ...w };
        for (const t of list) if (!next[t.id]) next[t.id] = emptyWork(t.template);
        return next;
      });
    } catch (err) {
      setTasksError(err.message || '課題を読み込めませんでした');
    }
  }, [lessonId]);

  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!connected && loadedOnce.current) return;
    loadedOnce.current = true;
    loadTasks();
  }, [connected, loadTasks]);

  // 開いている課題が無ければ「今の課題」→ 先頭
  useEffect(() => {
    if (selectedId && tasks.some((t) => t.id === selectedId)) return;
    if (activeId && tasks.some((t) => t.id === activeId)) setSelectedId(activeId);
    else if (tasks.length) setSelectedId(tasks[0].id);
  }, [tasks, activeId, selectedId]);

  // 先生が「今の課題」を切り替えたらそのタブへ
  const prevActive = useRef(activeId);
  useEffect(() => {
    if (activeId && activeId !== prevActive.current) setSelectedId(activeId);
    prevActive.current = activeId;
  }, [activeId]);

  // 課題を初めて開くとき、保存済みの自分のコードを取り直す（再読み込み後の復元）
  useEffect(() => {
    if (!selectedId) return;
    const w = works[selectedId];
    if (!w || w.loaded) return;
    let alive = true;
    get(`/code/tasks/${selectedId}/documents/${me.id}`, undefined, { redirect: false })
      .then((doc) => {
        if (!alive || !doc) return;
        updateWork(selectedId, (cur) => ({
          loaded: true,
          // 既に打ち始めていたら上書きしない
          source: cur.dirty ? cur.source : doc.source,
          lastRun: doc.runs && doc.runs.length ? doc.runs[0] : cur.lastRun,
          resetCount: cur.dirty ? cur.resetCount : cur.resetCount + 1,
        }));
      })
      .catch(() => alive && updateWork(selectedId, { loaded: true }));
    return () => {
      alive = false;
    };
  }, [selectedId, works, me.id, updateWork]);

  // スマホは「PC 推奨」を 1 回だけ
  useEffect(() => {
    if (!mobile) return;
    try {
      if (sessionStorage.getItem(MOBILE_HINT_KEY)) return;
      sessionStorage.setItem(MOBILE_HINT_KEY, '1');
    } catch {
      /* ストレージが使えなくても続ける */
    }
    showToast('コードの編集は PC を推奨します', 'ok');
  }, [mobile, showToast]);

  // ---- Socket の受信
  useEffect(() => {
    if (!socket) return undefined;
    const handlers = {
      [SERVER_EVENTS.CODE_TASK_ADDED]: ({ task }) => {
        if (!task) return;
        setTasks((list) => (list.some((t) => t.id === task.id) ? list : [...list, task]));
        updateWork(task.id, (cur) => (cur.source ? {} : emptyWork(task.template)));
      },
      [SERVER_EVENTS.CODE_RESET]: async ({ task_id: taskId }) => {
        showToast('先生が課題を配り直しました', 'ok');
        try {
          const list = (await get(`/lessons/${lessonId}/code/tasks`)) || [];
          setTasks(list);
          const t = list.find((x) => x.id === taskId);
          if (t) {
            updateWork(taskId, (cur) => ({
              source: t.template,
              dirty: false,
              compileErrors: [],
              lastRun: null,
              resetCount: cur.resetCount + 1,
              loaded: true,
            }));
          }
        } catch {
          /* 次の再接続で取り直す */
        }
      },
      [SERVER_EVENTS.CODE_RUN_RESULT]: (run) => {
        if (!run || run.user_id !== me.id) return;
        updateWork(run.task_id, (cur) => ({
          lastRun: run,
          ...(run.kind === CODE_RUN_KINDS.RUN ? { running: false, queued: null } : {}),
        }));
      },
      [SERVER_EVENTS.CODE_QUEUE]: ({ position }) => {
        // 自分が実行中の課題に付ける（同時に複数は出さない前提）
        setWorks((w) => {
          const next = { ...w };
          for (const id of Object.keys(next)) if (next[id].running) next[id] = { ...next[id], queued: position };
          return next;
        });
      },
      [SERVER_EVENTS.CODE_SPOTLIGHT]: (p) => setSpotlight(p && p.user_id != null ? p : null),
      [SERVER_EVENTS.CODE_TEACHER_EDITING]: ({ task_id: taskId, editing }) =>
        setTeacherEditing((m) => ({ ...m, [taskId]: Boolean(editing) })),
    };
    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
    return () => Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
  }, [socket, lessonId, me.id, updateWork, showToast]);

  // 再読み込み直後のスポットライト状態（LessonDetail から）
  useEffect(() => {
    if (lesson.code_spotlight_user_id == null) setSpotlight(null);
  }, [lesson.code_spotlight_user_id]);

  // ---- 操作
  const work = selectedId ? works[selectedId] : null;
  const task = tasks.find((t) => t.id === selectedId) || null;

  const onChange = useCallback(
    (source) => updateWork(selectedId, { source, dirty: true, error: '' }),
    [selectedId, updateWork]
  );

  // 構文エラーは変化したときだけサーバーへ（code:syntax）
  const lastSyntax = useRef({});
  const onSyntax = useCallback(
    ({ hasError, line }) => {
      if (!selectedId) return;
      updateWork(selectedId, { syntax: { hasError, line } });
      const prev = lastSyntax.current[selectedId];
      if (prev && prev.hasError === hasError && prev.line === line) return;
      lastSyntax.current[selectedId] = { hasError, line };
      if (socket) socket.emit(CLIENT_EVENTS.CODE_SYNTAX, { task_id: selectedId, has_error: hasError, line: line || undefined });
    },
    [selectedId, socket, updateWork]
  );

  const save = useCallback(async () => {
    if (!selectedId || !work || work.saving) return;
    const taskId = selectedId;
    updateWork(taskId, { saving: true, error: '' });
    try {
      const res = await post(`/code/tasks/${taskId}/save`, { source: work.source }, { redirect: false });
      updateWork(taskId, { saving: false, dirty: false, compileErrors: res.compile.errors || [] });
      if (res.compile.status === CODE_RUN_STATUS.OK) showToast('保存しました（コンパイル成功）', 'ok');
      else if (res.compile.status === CODE_RUN_STATUS.COMPILE_ERROR) showToast(`保存しました。コンパイルエラーが ${res.compile.errors.length} 件`, 'miss');
      else showToast('保存しました（実行サーバーに接続できないためコンパイルは未確認）', 'miss');
    } catch (err) {
      updateWork(taskId, { saving: false, error: err.message || '保存できませんでした' });
      showToast(err.code === ERROR_CODES.NOT_CODING_MODE ? 'プログラミングモードが終了しました' : err.message || '保存できませんでした', 'miss');
    }
  }, [selectedId, work, updateWork, showToast]);

  const run = useCallback(async () => {
    if (!selectedId || !work || work.running) return;
    const taskId = selectedId;
    updateWork(taskId, { running: true, queued: null, error: '' });
    try {
      const res = await post(`/code/tasks/${taskId}/run`, { source: work.source, stdin: work.stdin || '' }, { redirect: false });
      updateWork(taskId, { queued: res.queued_position });
    } catch (err) {
      let msg = err.message || '実行できませんでした';
      if (err.code === ERROR_CODES.RATE_LIMITED) msg = '実行は 1 分に 6 回までです。少し待ってからもう一度';
      else if (err.code === ERROR_CODES.RUNNER_UNAVAILABLE) msg = '実行サーバーに接続できません（保存はできます）';
      else if (err.code === ERROR_CODES.NOT_CODING_MODE) msg = 'プログラミングモードが終了しました';
      updateWork(taskId, { running: false, queued: null, error: msg });
      showToast(msg, 'miss');
    }
  }, [selectedId, work, updateWork, showToast]);

  // ---- 表示
  const status = useMemo(() => {
    if (!work) return { text: '', tone: 'idle' };
    if (work.error) return { text: work.error, tone: 'error' };
    if (work.running) return work.queued ? { text: `実行待ち ${work.queued} 人`, tone: 'running' } : { text: '実行中', tone: 'running' };
    if (work.syntax.hasError) return { text: `構文エラー${work.syntax.line ? `（${work.syntax.line} 行目）` : ''}`, tone: 'error' };
    if (work.dirty) return { text: '未保存', tone: 'idle' };
    if (work.lastRun) {
      const l = runLabel(work.lastRun);
      return { text: l.text, tone: l.tone };
    }
    return { text: '未保存', tone: 'idle' };
  }, [work]);

  const tabState = useCallback(
    (taskId) => {
      const w = works[taskId];
      if (!w) return undefined;
      if (w.syntax.hasError || (w.lastRun && w.lastRun.status === CODE_RUN_STATUS.COMPILE_ERROR)) return 'エラー';
      if (w.lastRun && w.lastRun.status === CODE_RUN_STATUS.OK && w.lastRun.kind === CODE_RUN_KINDS.RUN) return '✓';
      return undefined;
    },
    [works]
  );

  const spotIsMe = spotlight && spotlight.user_id === me.id;

  return (
    <div className={`code-stage${mobile ? ' is-mobile' : ''}`}>
      {spotlight && !spotIsMe && (
        <div className="code-spotlight">
          <div className="code-spotlight-head">
            <span className="code-spotlight-badge">★ 全員に表示中</span>
            <strong>{spotlight.user ? spotlight.user.name : '生徒'} さんのコード</strong>
            <span className="tiny muted">先生が解除するまで表示されます</span>
          </div>
          <CodeEditor key={`spot-${spotlight.user_id}-${spotlight.task_id}`} value={spotlight.source || ''} readOnly compact />
        </div>
      )}
      {spotIsMe && <div className="code-banner is-spot">★ あなたのコードが全員の画面に表示されています</div>}

      <TaskTabs tasks={tasks} selectedId={selectedId} activeId={activeId} onSelect={setSelectedId} stateOf={tabState} />
      {tasksError && (
        <div className="lr-load-error" role="alert">
          <span>{tasksError}</span>
          <button type="button" className="btn btn-ghost" onClick={loadTasks}>再読み込み</button>
        </div>
      )}

      {task && work ? (
        <>
          {teacherEditing[task.id] && <div className="code-banner is-teacher">✎ 先生が編集中です</div>}
          <div className="code-editor-wrap">
            <CodeEditor
              key={`${task.id}:${work.resetCount}`}
              value={work.source}
              onChange={onChange}
              onSave={save}
              onSyntax={onSyntax}
              compileErrors={work.compileErrors}
            />
          </div>
          <RunPanel
            status={status}
            saving={work.saving}
            running={work.running}
            queued={work.queued}
            stdin={work.stdin || ''}
            onStdin={(text) => updateWork(task.id, { stdin: text })}
            onSave={save}
            onRun={run}
            disabled={!connected}
            mobile={mobile}
          />
          <OutputPanel run={work.lastRun} compileErrors={work.compileErrors} compact={mobile} />
        </>
      ) : (
        <div className="code-empty">先生が課題を出すとここにエディタが表示されます</div>
      )}
    </div>
  );
}
