// Issue #47：欠課の生徒が「一時退出」→「退出する」を押すと、409 ALREADY_ABSENT で止まって退出できない
// 欠課の生徒も退出中画面（/lessons/:id/away）へ移動でき、出席の生徒の一時退出は今までどおりであること
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ATTENDANCE_STATUS, ERROR_CODES, LESSON_MODES, LESSON_STATUS, ROLES } from '@sotsuken/shared/constants';

let attendanceStatus = ATTENDANCE_STATUS.PRESENT;
const postMock = vi.fn();

vi.mock('../../api/client.js', () => {
  const get = vi.fn((path) => {
    if (path === '/lessons/76/attendance/me') {
      return Promise.resolve({ status: attendanceStatus, away_total_sec: 0, remaining_sec: 600 });
    }
    return Promise.resolve([]);
  });
  const ok = vi.fn(() => Promise.resolve({}));
  return { get, post: (...args) => postMock(...args), del: ok, upload: ok };
});
vi.mock('../../components/learn/parts.js', () => ({
  useLiveKitRoom: () => ({ room: null, status: 'connected' }),
  RoomAudio: () => null,
  ChatPanel: () => null,
  QuestionBox: () => null,
}));
vi.mock('../../components/learn/VideoStage.jsx', () => ({ default: () => null }));
vi.mock('../../components/learn/MaterialPanel.jsx', () => ({ default: () => null }));
vi.mock('../../components/learn/code/CodeStage.jsx', () => ({ default: () => null }));
vi.mock('../../components/learn/LessonHeader.jsx', () => ({ default: ({ action }) => <div>{action}</div> }));

const { default: LessonLive } = await import('./LessonLive.jsx');

const lesson = {
  id: 76,
  class_id: 1,
  title: 'テスト授業',
  status: LESSON_STATUS.LIVE,
  mode: LESSON_MODES.VIDEO,
  spotlight_user_id: null,
  away_timeout_min: 15,
  teacher: { id: 1, name: '先生' },
};
const me = { id: 2, name: '生徒', role: ROLES.STUDENT };

function renderLive() {
  return render(
    <MemoryRouter initialEntries={['/lessons/76/learn']}>
      <Routes>
        <Route
          path="/lessons/:id/learn"
          element={<LessonLive lessonId={76} lesson={lesson} className="テストクラス" me={me} socket={null} connected mobile={false} />}
        />
        <Route path="/lessons/:id/away" element={<div>退出中画面</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function apiError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

describe('LessonLive：一時退出', () => {
  beforeEach(() => {
    attendanceStatus = ATTENDANCE_STATUS.PRESENT;
    postMock.mockReset();
  });
  afterEach(() => cleanup()); // globals: false なので自動 cleanup されない

  it('欠課の生徒は、409 ALREADY_ABSENT が返っても退出中画面へ移動する', async () => {
    attendanceStatus = ATTENDANCE_STATUS.ABSENT;
    postMock.mockRejectedValue(apiError(409, ERROR_CODES.ALREADY_ABSENT, 'すでに欠課です'));
    renderLive();
    await screen.findByText(/この授業は欠課になっています。視聴は続けられます/);
    fireEvent.click(screen.getByRole('button', { name: '一時退出' }));
    expect(screen.getByText('この授業はすでに欠課になっているため、退出しても出席の記録は変わりません。')).toBeInTheDocument();
    expect(screen.queryByText(/分を超えると欠課扱い/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '退出する' }));
    expect(await screen.findByText('退出中画面')).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith('/lessons/76/attendance/away');
  });

  it('出席の生徒は、今までどおり欠課の注意を見てから退出中画面へ移動する', async () => {
    postMock.mockResolvedValue({});
    renderLive();
    fireEvent.click(screen.getByRole('button', { name: '一時退出' }));
    expect(screen.getByText('この授業での退出時間の合計が15分を超えると欠課扱いになります。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '退出する' }));
    expect(await screen.findByText('退出中画面')).toBeInTheDocument();
  });

  it('出席の生徒で一時退出に失敗したときは、エラーを表示してとどまる', async () => {
    postMock.mockRejectedValue(apiError(500, ERROR_CODES.INTERNAL_ERROR, '一時退出できませんでした'));
    renderLive();
    fireEvent.click(screen.getByRole('button', { name: '一時退出' }));
    fireEvent.click(screen.getByRole('button', { name: '退出する' }));
    expect(await screen.findByText('一時退出できませんでした')).toBeInTheDocument();
    expect(screen.queryByText('退出中画面')).not.toBeInTheDocument();
  });
});
