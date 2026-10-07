// 質問箱（先生画面・生徒画面で共通）— 担当：W5。W4 は props の形だけ合わせて使う。
//
// props:
//   questions:       Question[]（shared/api-types の Question。{ id, user?, body, is_anonymous, status, created_at }）
//   onPost:          (body: string, isAnonymous: boolean) => void   生徒の投稿（POST questions）
//   onMarkAnswered?: (id: number) => void                          先生の「回答済み」（PATCH questions/:id）
//   isTeacher:       boolean                                        先生なら回答済み操作と匿名の投稿者を表示
export default function QuestionBox({ questions = [], onPost, onMarkAnswered, isTeacher = false }) {
  return (
    <section className="question-box">
      <p className="placeholder-note">QuestionBox（未実装・W5）{questions.length} 件</p>
    </section>
  );
}
