// 質問箱（先生画面・生徒画面で共通）— 担当：W5。W4 は props の形だけ合わせて使う。
//
// props:
//   questions:       Question[]（shared/api-types の Question。{ id, user?, body, is_anonymous, status, created_at }）
//   onPost:          (body: string, isAnonymous: boolean) => void   生徒の投稿（POST questions）
//   onMarkAnswered?: (id: number) => void                          先生の「回答済み」（PATCH questions/:id）
//   onLowerHand?:    (id: number) => void                          先生が挙手を下ろす（1人分）
//   onLowerAll?:     (ids: number[]) => void                       先生が挙手を全員下ろす（open の挙手すべて）
//   isTeacher:       boolean                                        先生なら回答済み操作と匿名の投稿者を表示
//
// - body が null の質問は「挙手のみ」。先生には最上段の「挙手中」セクション（status=open のもの）に一覧で出し、
//   各行の「下ろす」で onLowerHand(id)、「全員下ろす」で onLowerAll(ids) を呼ぶ。生徒側の一覧には出さない
// - 匿名の質問：生徒には「匿名」、先生には「匿名（本名）」を薄く出す（user はサーバーが先生にだけ含める）
// - 先生のときは投稿フォームを出さない
import { useMemo, useState } from 'react';
import { LIMITS, QUESTION_STATUS } from '@sotsuken/shared/constants';
import Avatar from './Avatar.jsx';
import { formatTime } from './format.js';

function byOldest(a, b) {
  return a.id - b.id;
}

export default function QuestionBox({ questions = [], onPost, onMarkAnswered, onLowerHand, onLowerAll, isTeacher = false }) {
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

  function handleKeyDown(e) {
    // Enter＝送信／Shift+Enter＝改行（ChatPanel と同じ）。日本語変換中の Enter は送信しない
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      post();
    }
  }

  return (
    <section className={`question-box${isTeacher ? ' is-teacher' : ''}`}>
      {isTeacher && (
        <div className="hands">
          <div className="hands-head">
            <h6 className="section-label">
              挙手中 <span className="count">{hands.length}人</span>
            </h6>
            {hands.length > 1 && onLowerAll && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onLowerAll(hands.map((q) => q.id))}>
                全員下ろす
              </button>
            )}
          </div>
          <ul className="hand-list">
            {hands.length === 0 && <li className="none">いま挙手している生徒はいません</li>}
            {hands.map((q) => (
              <li key={q.id} className="hand-row">
                <Avatar user={q.user} size={22} />
                <span className="hand-name">{q.user ? q.user.name : '生徒'}</span>
                <span aria-hidden="true">✋</span>
                {onLowerHand && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onLowerHand(q.id)}>
                    下ろす
                  </button>
                )}
              </li>
            ))}
          </ul>
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
                  {/* 生徒側で匿名なのに user があるのは自分の投稿だけ（POST のレスポンスは本人に user を含む） */}
                  {q.is_anonymous && !isTeacher && q.user && <span className="real">（自分）</span>}
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
            maxLength={LIMITS.BODY_MAX}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
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
