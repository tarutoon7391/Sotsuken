// 他ワーカーの部品の入口 — 担当：W4
// 生徒画面のページは W3 / W5 の部品を必ずここ経由で import する。
// 「部品確定」のメッセージが届いたら、下の import 元を本物に差し替えるだけでよい（ページ側は変更不要）。
// _stubs/ の仮部品は本物と同じ props で作ってある。結合時に _stubs/ ごと削除する。

// ---- W5（components/shared）。確定済み（feat/w5-teach 9e33d1a・docs/requests/w5-components.md）
// 本ブランチ単体では shared の中身がフェーズ0の仮表示のまま。W5 のマージ後に本物になる。
export { default as Avatar } from '../shared/Avatar.jsx';
export { default as RoleBadge } from '../shared/RoleBadge.jsx';
export { default as ChatPanel } from '../shared/ChatPanel.jsx';
export { default as QuestionBox } from '../shared/QuestionBox.jsx';

// ---- W3（client/src/livekit）。確定済み（feat/w3-livekit 0ba6f6b・docs/requests/w3-components.md）
// 本ブランチには livekit/index.js がまだ無いので、同じ API の仮部品を使う。
// TODO(結合時)：'./_stubs/livekit.jsx' → '../../livekit' に変えて _stubs/ を削除する
export { useLiveKitRoom, RemoteVideo, StudentCamera, RoomAudio } from './_stubs/livekit.jsx';
