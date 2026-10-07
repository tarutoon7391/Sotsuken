// 雑談チャット（先生画面・生徒画面で共通）— 担当：W5。W4 は props の形だけ合わせて使う。
//
// props:
//   messages:    ChatMessage[]（shared/api-types の ChatMessage。{ id, user, body, file?, created_at }）
//   onSend:      (body: string) => void           テキスト送信（Socket の chat:message）
//   onAttach:    (file: File) => void              添付送信（POST files(kind=attachment) → chat:message に file_id）
//   currentUser: { id, name, role, icon_url? }     自分（自分の発言を右寄せにする等）
//   onLoadMore?: () => void                        過去分の読み込み（GET /chat?before=）
export default function ChatPanel({ messages = [], onSend, onAttach, currentUser, onLoadMore }) {
  return (
    <section className="chat-panel">
      <p className="placeholder-note">ChatPanel（未実装・W5）{messages.length} 件</p>
    </section>
  );
}
