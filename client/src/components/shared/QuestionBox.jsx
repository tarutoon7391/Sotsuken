// 質問箱（先生画面・生徒画面で共通）— 担当：W5。W4 は props の形だけ合わせて使う。
//
// props:
//   questions:       Question[]（shared/api-types の Question。{ id, user?, body, is_anonymous, status, created_at }）
//   onPost:          (body: string, isAnonymous: boolean) => void   生徒の投稿（POST questions）
//   onMarkAnswered?: (id: number) => void                          先生の「回答済み」（PATCH questions/:id）
//   isTeacher:       boolean                                        先生なら回答済み操作と匿名の投稿者を表示
//
// - body が null の質問は「挙手のみ」。先生には上部の「挙手中」チップ（status=open のもの）で出し、
//   チップを押すと onMarkAnswered(id) で挙手を下ろす。生徒側の一覧には出さない
// - 匿名の質問：生徒には「匿名」、先生には「匿名（本名）」を薄く出す（user はサーバーが先生にだけ含める）
// - 先生のときは投稿フォームを出さない
import { useMemo, useState } from 'react';
import { QUESTION_STATUS } from '@sotsuken/shared/constants';
import Avatar from './Avatar.jsx';
import { formatTime } from './format.js';

function byOldest(a, b) {
  return a.id - b.id;
}

export default function QuestionBox({ questions = [], onPost, onMarkAnswered, isTeacher = false }) {
  const [draft, setDraft] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const hands = useMemo(
    () => questions.filter((q) => q.body == null && q.status === QUESTION_STATUS.OPEN).sort(byOldest),
    [questions]
  );
  const posts = useMemo(() => questions.filter((q) => q.body != null).sort(byOldest), [questions]);

  function post() {
    const body = draft.trim();
    if (!body || !onPost) return;
    onPost(body, anonymous);
    setDraft('');
  }

  return (
    <section className={`question-box${isTeacher ? ' is-teacher' : ''}`}>
      {isTeacher && (
        <div className="hands">
          <h6 className="section-label">
            挙手中 <span className="count">{hands.length}人</span>
          </h6>
          <div className="chips">
            {hands.length === 0 && <span className="none">いま挙手している生徒はいません</span>}
            {hands.map((q) => (
              <button
                key={q.id}
                type="button"
                className="hand-chip"
                title="押すと挙手を下ろす"
                onClick={() => onMarkAnswered && onMarkAnswered(q.id)}
                disabled={!onMarkAnswered}
              >
                <Avatar user={q.user} size={22} />
                {q.user ? q.user.name : '生徒'}
                <span aria-hidden="true">✋</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="q-list">
        {posts.length === 0 && <p className="q-empty">まだ質問はありません</p>}
        {posts.map((q) => {
          const answered = q.status === QUESTION_STATUS.ANSWERED;
          const showUser = !q.is_anonymous && q.user;
          return (
            <div key={q.id} className={`q${answered ? ' is-answered' : ''}`}>
              <div className="q-head">
                <Avatar user={showUser ? q.user : null} size={22} />
                <span>
                  {showUser ? q.user.name : '匿名'}
                  {q.is_anonymous && isTeacher && q.user && <span className="real">（{q.user.name}）</span>}
                </span>
                <time className="time" dateTime={q.created_at}>{formatTime(q.created_at)}</time>
                {answered && <span className="tag tag-accent">回答済み</span>}
              </div>
              <div className="q-body">{q.body}</div>
              {isTeacher && !answered && onMarkAnswered && (
                <div className="q-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMarkAnswered(q.id)}>
                    ✓ 回答済みにする
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isTeacher && (
        <div className="compose">
          <textarea
            className="input"
            placeholder="先生に質問する"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="compose-row">
            <label className="switch">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
              <span className="track" />
              匿名で投稿
            </label>
            <button type="button" className="btn btn-primary" onClick={post} disabled={!draft.trim() || !onPost}>
              投稿
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
