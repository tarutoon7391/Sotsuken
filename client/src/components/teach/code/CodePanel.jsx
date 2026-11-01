// 先生のプログラミングモード本体（課題管理・コードグリッド・拡大パネル・コードスポットライト）— 担当：W5（F-10・docs/07 §15.2）
// TeachPage の中央カラムで「コード」タブのときに表示する。Socket は TeachPage が繋いだものを connectLesson() で共有する。
// props:
//   lessonId:   number
//   lesson:     LessonDetail（mode / active_task_id / code_spotlight_user_id は TeachPage が Socket で更新する）
//   students:   UserBrief[]
//   isLive:     boolean
//   showToast:  (text) => void
//   onSpotlightChange?: (userId|null) => void   PUT の結果を先に TeachPage に反映したいとき
import { useCallback, useEffect, useRef, useState } from 'react';
import { CODE_RUN_KINDS, CODE_RUN_STATUS, CODE_STATES } from '@sotsuken/shared/constants';
import { SERVER_EVENTS } from '@sotsuken/shared/socket-events';
import { get, patch, post, put } from '../../../api/client.js';
import { connectLesson } from '../../../socket.js';
import TaskManager from './TaskManager.jsx';
import CodeGrid, { CodeLegend } from './CodeGrid.jsx';
import CodeInspector from './CodeInspector.jsx';
import '../../learn/code/code.css';
import './teach-code.css';

/** code:run_result の status → グリッドの枠色（サーバーの code:status と同じ対応） */
function stateOfRun(run) {
  switch (run.status) {
    case CODE_RUN_STATUS.OK:
      return CODE_STATES.OK;
    case CODE_RUN_STATUS.COMPILE_ERROR:
      return CODE_STATES.COMPILE_ERROR;
    case CODE_RUN_STATUS.RUNTIME_ERROR:
    case CODE_RUN_STATUS.TIMEOUT:
      return CODE_STATES.RUNTIME_ERROR;
    default:
      return CODE_STATES.IDLE;
  }
}

export default function CodePanel({ lessonId, lesson, students, isLive, showToast, onSpotlightChange }) {
  const [tasks, setTasks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [docsByTask, setDocsByTask] = useState({}); // taskId → { [userId]: CodeDocumentSummary & { line? } }
  const [latestRun, setLatestRun] = useState({}); // `${taskId}:${userId}` → CodeRun
  const [inspect, setInspect] = useState(null); // UserBrief
  const [runnerDown, setRunnerDown] = useState(false);
  const activeId = lesson.active_task_id;
  const spotlightUserId = lesson.code_spotlight_user_id;

  const warn = useCallback((err) => showToast(err.message || '失敗しました'), [showToast]);

  // ---- 課題一覧
  const loadTasks = useCallback(() => {
    get(`/lessons/${lessonId}/code/tasks`)
      .then((list) => setTasks(list || []))
      .catch(warn);
  }, [lessonId, warn]);
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // 開いている課題が無ければ「今の課題」→ 先頭
  useEffect(() => {
    if (selectedId && tasks.some((t) => t.id === selectedId)) return;
    if (activeId && tasks.some((t) => t.id === activeId)) setSelectedId(activeId);
    else if (tasks.length) setSelectedId(tasks[0].id);
  }, [tasks, activeId, selectedId]);

  // ---- 課題ごとの全生徒のコード（グリッドの初期表示。課題を開くたびに取り直す）
  const loadDocs = useCallback(
    (taskId) => {
      if (!taskId) return;
      get(`/code/tasks/${taskId}/documents`)
        .then((rows) => {
          const map = {};
          (rows || []).forEach((d) => {
            map[d.user.id] = d;
          });
          setDocsByTask((m) => ({ ...m, [taskId]: map }));
        })
        .catch(warn);
    },
    [warn]
  );
  useEffect(() => {
    loadDocs(selectedId);
  }, [selectedId, loadDocs]);

  // ---- Socket（TeachPage と同じ接続）
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  useEffect(() => {
    const socket = connectLesson(lessonId);
    const patchDoc = (taskId, userId, fn) =>
      setDocsByTask((m) => {
        const docs = m[taskId] || {};
        const cur = docs[userId] || { user: { id: userId }, source_head: '', state: CODE_STATES.IDLE, last_saved_at: null, last_run_status: null };
        return { ...m, [taskId]: { ...docs, [userId]: { ...cur, ...fn(cur) } } };
      });

    const onTaskAdded = ({ task }) => {
      if (task) setTasks((list) => (list.some((t) => t.id === task.id) ? list : [...list, task]));
    };
    const onStatus = ({ task_id: taskId, user_id: userId, state, line }) => {
      patchDoc(taskId, userId, () => ({ state, line: line || null }));
    };
    const onRunResult = (run) => {
      if (!run) return;
      setLatestRun((m) => ({ ...m, [`${run.task_id}:${run.user_id}`]: run }));
      setRunnerDown(run.status === CODE_RUN_STATUS.RUNNER_UNAVAILABLE);
      patchDoc(run.task_id, run.user_id, (cur) => ({
        state: stateOfRun(run),
        last_run_status: run.status,
        last_saved_at: run.kind === CODE_RUN_KINDS.COMPILE ? run.created_at : cur.last_saved_at,
      }));
      // 保存されたらコードの先頭も新しくする（開いている課題だけ）
      if (run.kind === CODE_RUN_KINDS.COMPILE && run.task_id === selectedRef.current) loadDocs(run.task_id);
    };
    const onReconnect = () => {
      loadTasks();
      loadDocs(selectedRef.current);
    };
    socket.on(SERVER_EVENTS.CODE_TASK_ADDED, onTaskAdded);
    socket.on(SERVER_EVENTS.CODE_STATUS, onStatus);
    socket.on(SERVER_EVENTS.CODE_RUN_RESULT, onRunResult);
    socket.on('connect', onReconnect);
    return () => {
      socket.off(SERVER_EVENTS.CODE_TASK_ADDED, onTaskAdded);
      socket.off(SERVER_EVENTS.CODE_STATUS, onStatus);
      socket.off(SERVER_EVENTS.CODE_RUN_RESULT, onRunResult);
      socket.off('connect', onReconnect);
    };
  }, [lessonId, loadTasks, loadDocs]);

  // ---- 操作
  async function createTask(input) {
    const { task } = await post(`/lessons/${lessonId}/code/tasks`, input, { redirect: false });
    setTasks((list) => (list.some((t) => t.id === task.id) ? list : [...list, task]));
    setSelectedId(task.id);
    showToast(`課題「${task.title}」を追加しました`);
  }
  async function updateTask(taskId, input) {
    const { task } = await patch(`/code/tasks/${taskId}`, input, { redirect: false });
    setTasks((list) => list.map((t) => (t.id === task.id ? task : t)));
    showToast('課題を更新しました');
  }
  async function activate(taskId) {
    try {
      await put(`/lessons/${lessonId}/code/active-task`, { task_id: taskId }, { redirect: false });
      showToast('生徒のエディタをこの課題に切り替えました');
    } catch (err) {
      warn(err);
    }
  }
  async function redistribute(taskId) {
    await post(`/code/tasks/${taskId}/redistribute`, undefined, { redirect: false });
    loadDocs(taskId);
    showToast('テンプレートを全員に配り直しました');
  }
  async function spotlight(userId) {
    try {
      await put(`/lessons/${lessonId}/code/spotlight`, { user_id: userId }, { redirect: false });
      if (onSpotlightChange) onSpotlightChange(userId);
      showToast(userId ? '全員の画面にこの生徒のコードを表示しました' : '全員への表示を解除しました');
    } catch (err) {
      warn(err);
    }
  }

  const task = tasks.find((t) => t.id === selectedId) || null;
  const docs = (selectedId && docsByTask[selectedId]) || {};
  const spotUser = students.find((s) => s.id === spotlightUserId);

  return (
    <div className="code-panel">
      <TaskManager
        tasks={tasks}
        selectedId={selectedId}
        activeId={activeId}
        isLive={isLive}
        onSelect={setSelectedId}
        onCreate={createTask}
        onUpdate={updateTask}
        onActivate={activate}
        onRedistribute={redistribute}
      />
      {runnerDown && <div className="code-banner is-runner">⚠ 実行サーバーに接続できません。エディタ・保存・監視は使えますが、コンパイル結果と実行は返りません</div>}
      {spotUser && (
        <div className="spot-banner">
          ★ <span><strong>{spotUser.name}</strong> のコードを全員に表示中</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => spotlight(null)}>解除</button>
        </div>
      )}
      <div className="grid-head">
        <h6 className="section-label" style={{ margin: 0 }}>{task ? task.title : '課題'}</h6>
        <CodeLegend />
      </div>
      <div className="grid-wrap">
        {task ? (
          <CodeGrid students={students} docs={docs} onOpen={setInspect} spotlightUserId={spotlightUserId} />
        ) : (
          <p className="tiny muted" style={{ margin: 0 }}>「＋ 課題」で課題を追加すると、生徒のエディタが開きます</p>
        )}
      </div>

      {inspect && task && (
        <CodeInspector
          task={task}
          student={inspect}
          latestRun={latestRun[`${task.id}:${inspect.id}`] || null}
          isSpotlight={spotlightUserId === inspect.id}
          isLive={isLive}
          onSpotlight={spotlight}
          onClose={() => setInspect(null)}
        />
      )}
    </div>
  );
}
