// Issue #25：先生画面に戻ってきたとき、モード切替の選択状態（lesson.mode）と中央の表示（映像／コード）が一致すること
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LESSON_MODES, LESSON_STATUS, ROLES } from '@sotsuken/shared/constants';

let lessonMode = LESSON_MODES.VIDEO;

vi.mock('../../api/client.js', () => {
  const get = vi.fn((path) => {
    if (path === '/lessons/76') {
      return Promise.resolve({
        id: 76,
        class_id: 1,
        title: 'テスト授業',
        status: LESSON_STATUS.LIVE,
        mode: lessonMode,
        started_at: new Date().toISOString(),
        spotlight_user_id: null,
        away_timeout_min: 10,
      });
    }
    if (path === '/classes/1') return Promise.resolve({ id: 1, name: 'テストクラス' });
    if (path === '/lessons/76/understanding') return Promise.resolve(null);
    if (path === '/lessons/76/attention/auto') return Promise.resolve(null);
    return Promise.resolve([]);
  });
  const ok = vi.fn(() => Promise.resolve({}));
  return { get, post: ok, put: ok, patch: ok, del: ok, upload: ok };
});
vi.mock('../../socket.js', () => ({
  connectLesson: () => ({ on: vi.fn(), emit: vi.fn() }),
  disconnectLesson: vi.fn(),
}));
vi.mock('../../components/shared/RequireLogin.jsx', () => ({
  default: ({ children }) => children,
  useCurrentUser: () => ({ user: { id: 1, name: '先生', role: ROLES.TEACHER } }),
}));
vi.mock('../../livekit', () => ({
  useLiveKitRoom: () => ({ room: null, status: 'connected' }),
  TeacherPublisher: () => null,
  StudentGrid: () => <div data-testid="student-grid" />,
  RoomAudio: () => null,
  putSpotlight: vi.fn(),
  STATUS_LABELS: {},
}));
vi.mock('../../components/teach/code/CodePanel.jsx', () => ({
  default: () => <div data-testid="code-panel" />,
}));
vi.mock('../../components/teach/code/TaskManager.jsx', () => ({ TaskDialog: () => null }));
vi.mock('../../components/shared/ChatPanel.jsx', () => ({ default: () => null }));
vi.mock('../../components/shared/QuestionBox.jsx', () => ({ default: () => null }));
vi.mock('../../components/shared/MaterialPreview.jsx', () => ({ default: () => null }));
vi.mock('./TeachPanels.jsx', () => ({
  AttendancePanel: () => null,
  AttentionPanel: () => null,
  MaterialPanel: () => null,
  UnderstandingPanel: () => null,
  liveLabel: () => '授業中',
}));

const { default: TeachPage } = await import('./TeachPage.jsx');

function renderTeach() {
  return render(
    <MemoryRouter initialEntries={['/lessons/76/teach']}>
      <Routes>
        <Route path="/lessons/:id/teach" element={<TeachPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TeachPage：表示モードの復元', () => {
  beforeEach(() => {
    lessonMode = LESSON_MODES.VIDEO;
  });
  afterEach(() => cleanup()); // globals: false なので自動 cleanup されない

  it('「プログラミング」選択中の授業に戻ると、コード画面が表示される', async () => {
    lessonMode = LESSON_MODES.CODING;
    renderTeach();
    const codingBtn = await screen.findByRole('button', { name: /プログラミング/ });
    expect(codingBtn).toHaveClass('is-on');
    expect(screen.getByTestId('code-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('student-grid')).not.toBeInTheDocument();
  });

  it('「映像」選択中の授業に戻ると、映像画面が表示される', async () => {
    lessonMode = LESSON_MODES.VIDEO;
    renderTeach();
    const codingBtn = await screen.findByRole('button', { name: /プログラミング/ });
    expect(codingBtn).not.toHaveClass('is-on');
    expect(screen.getByTestId('student-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('code-panel')).not.toBeInTheDocument();
  });
});
