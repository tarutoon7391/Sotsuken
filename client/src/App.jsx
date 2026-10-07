// ルーティング（docs/07_画面一覧・画面設計書.md の14画面）。
// 各ページの中身は担当ワーカーが実装する。このファイルはパスの対応表なので、フェーズ1中は変更しない。
//
// | #  | パス                        | コンポーネント   | 担当 |
// | 1  | /login                     | LoginPage       | W5  |
// | 2  | /register                  | RegisterPage    | W5  |
// | 3  | /me                        | ProfilePage     | W5  |
// | 4  | /classes                   | ClassListPage   | W5  |
// | 5  | /classes/:id               | ClassDetailPage | W5  |
// | 6  | /lessons/:id/teach         | TeachPage       | W5  |
// | 7  | /lessons/:id/attendance    | AttendancePage  | W5  |
// | 8  | /lessons/:id/result        | ResultPage      | W5  |
// | 9  | /lessons/:id/learn（preparing）| WaitingPage  | W4（LearnPage が status を見て出し分ける）|
// | 10 | /lessons/:id/learn         | LearnPage       | W4  |
// | 11 | （10の上）                  | AttentionModal  | W4  |
// | 12 | /lessons/:id/away          | AwayPage        | W4  |
// | 13 | /lessons/:id/ended         | EndedPage       | W5  |
// | 14 | /error/:status, その他      | ErrorPage       | W5  |
import { Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ProfilePage from './pages/auth/ProfilePage.jsx';
import ClassListPage from './pages/classes/ClassListPage.jsx';
import ClassDetailPage from './pages/classes/ClassDetailPage.jsx';
import TeachPage from './pages/teach/TeachPage.jsx';
import AttendancePage from './pages/teach/AttendancePage.jsx';
import ResultPage from './pages/teach/ResultPage.jsx';
import LearnPage from './pages/learn/LearnPage.jsx';
import AwayPage from './pages/learn/AwayPage.jsx';
import EndedPage from './pages/common/EndedPage.jsx';
import ErrorPage from './pages/common/ErrorPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/classes" replace />} />

      {/* 認証・プロフィール（W5） */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/me" element={<ProfilePage />} />

      {/* クラス（W5） */}
      <Route path="/classes" element={<ClassListPage />} />
      <Route path="/classes/:id" element={<ClassDetailPage />} />

      {/* 先生（W5） */}
      <Route path="/lessons/:id/teach" element={<TeachPage />} />
      <Route path="/lessons/:id/attendance" element={<AttendancePage />} />
      <Route path="/lessons/:id/result" element={<ResultPage />} />

      {/* 生徒（W4） */}
      <Route path="/lessons/:id/learn" element={<LearnPage />} />
      <Route path="/lessons/:id/away" element={<AwayPage />} />

      {/* 共通（W5） */}
      <Route path="/lessons/:id/ended" element={<EndedPage />} />
      <Route path="/error/:status" element={<ErrorPage />} />
      <Route path="*" element={<ErrorPage status={404} />} />
    </Routes>
  );
}
