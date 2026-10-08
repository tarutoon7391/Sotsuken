// クラス詳細 — 担当：W5（デザイン：docs/design/05_クラス詳細）
// API：GET /classes/:id, /classes/:id/lessons(?tag=), /classes/:id/tags, /classes/:id/members（先生）,
//      POST /classes/:id/lessons, PATCH /lessons/:id, GET /lessons/:id/files?kind=material, DELETE /files/:id
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FILE_KINDS, LESSON_STATUS, LIMITS, ROLES } from '@sotsuken/shared/constants';
import { del, get, patch, post } from '../../api/client.js';
import MaterialPreview from '../../components/shared/MaterialPreview.jsx';
import RequireLogin, { useCurrentUser } from '../../components/shared/RequireLogin.jsx';
import Avatar from '../../components/shared/Avatar.jsx';
import RoleBadge from '../../components/shared/RoleBadge.jsx';
import useToast from '../../components/shared/useToast.jsx';
import useEscape from '../../components/shared/useEscape.js';
import { formatDateTime, formatBytes, formatJoinCode } from '../../components/shared/format.js';
import { lessonPath } from './ClassListPage.jsx';
import './classes.css';

export default function ClassDetailPage() {
  return (
    <RequireLogin>
      <ClassDetailBody />
    </RequireLogin>
  );
}

function ClassDetailBody() {
  const { id: classId } = useParams();
  const { user } = useCurrentUser();
  const isTeacher = user.role === ROLES.TEACHER;
  const [cls, setCls] = useState(null);
  const [lessons, setLessons] = useState(null);
  const [tags, setTags] = useState([]);
  const [members, setMembers] = useState([]);
  const [tagFilter, setTagFilter] = useState('');
  const [tab, setTab] = useState('lessons');
  const [dialog, setDialog] = useState(null); // { lesson?: LessonSummary }（lesson があれば編集）
  const [openFiles, setOpenFiles] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [toast, showToast] = useToast();
  const [preview, setPreview] = useState(null); // プレビュー中の資料（FileInfo）
  const fail = useCallback((err) => setLoadError(err.message), []); // 401/403/404 は client.js が遷移させる

  const loadLessons = useCallback(() => {
    get(`/classes/${classId}/lessons`, { tag: tagFilter || undefined })
      .then((rows) => setLessons(rows || []))
      .catch(fail);
  }, [classId, tagFilter, fail]);
  const loadTags = useCallback(() => {
    get(`/classes/${classId}/tags`)
      .then((rows) => setTags(rows || []))
      .catch(fail);
  }, [classId, fail]);

  useEffect(() => {
    get(`/classes/${classId}`).then(setCls).catch(fail);
    loadTags();
    if (isTeacher) {
      get(`/classes/${classId}/members`)
        .then((rows) => setMembers(rows || []))
        .catch(fail);
    }
  }, [classId, isTeacher, loadTags, fail]);
  useEffect(loadLessons, [loadLessons]);

  if (loadError && (!cls || !lessons)) return <div className="page-loading form-alert" role="alert">{loadError}</div>;
  if (!cls || !lessons) return <p className="page-loading">読み込み中…</p>;

  const live = lessons.find((l) => l.status === LESSON_STATUS.LIVE) || null;
  const hasLive = !!cls.live_lesson_id;
  const planned = lessons.filter((l) => l.status === LESSON_STATUS.PREPARING);
  const done = lessons.filter((l) => l.status === LESSON_STATUS.ENDED);
  const students = members.filter((m) => m.role === ROLES.STUDENT);

  function copyCode() {
    if (navigator.clipboard) navigator.clipboard.writeText(formatJoinCode(cls.join_code)).catch(() => {});
    showToast('参加コードをコピーしました');
  }
  // 絞り込みなしで授業が0件なら、見出しの「授業を作成」は出さず空状態の案内だけにする
  const noLessons = !tagFilter && lessons.length === 0;

  return (
    <div className="app classes-page">
      <header className="app-header">
        <Link className="hdr-back" to="/classes">← <span>クラス一覧へ戻る</span></Link>
        <div className="hdr-left">
          <div className="hdr-kicker">クラス</div>
          <div className="hdr-title">{cls.name}</div>
        </div>
        <span className="hdr-spacer" />
        {hasLive && <span className="status"><span className="dot dot-live" />授業中</span>}
        <Link className="person" to="/me" title="プロフィール設定">
          <Avatar user={user} />
          <span className="person-name">{user.name}</span>
          <RoleBadge role={user.role} />
        </Link>
      </header>

      <main className="app-main">
        <div className="tabs tabs-fill detail-tabs" role="tablist">
          <button className={`tab${tab === 'lessons' ? ' is-on' : ''}`} role="tab" onClick={() => setTab('lessons')}>授業</button>
          <button className={`tab${tab === 'members' ? ' is-on' : ''}`} role="tab" onClick={() => setTab('members')}>
            メンバー {isTeacher && <span className="count muted">{students.length + 1}</span>}
          </button>
        </div>

        <div className="detail-wrap">
          <section data-tab-pane="lessons" className={tab === 'lessons' ? 'is-on' : ''}>
            {isTeacher && cls.join_code && (
              <div className="code-block">
                <h6 className="section-label">参加コード</h6>
                <div className="join-code">
                  <span className="join-code-value">{formatJoinCode(cls.join_code)}</span>
                  <button type="button" className="btn btn-secondary" onClick={copyCode}>コピー</button>
                </div>
                <p className="hint small muted">生徒はクラス一覧の「参加コードで参加」からこのコードを入力します</p>
              </div>
            )}

            {hasLive && (
              <div className="card live-hero">
                <div><span className="live-tag"><span className="dot dot-live" />授業中</span></div>
                <h4>{live ? live.title : '開催中の授業'}</h4>
                {live && live.started_at && (
                  <div className="live-meta">🕒 {formatDateTime(live.started_at)} 開始</div>
                )}
                {live && <LessonTags tags={live.tags} />}
                <div className="live-actions">
                  <Link className="btn btn-primary btn-lg" to={lessonPath(cls.live_lesson_id, user.role)}>入室する</Link>
                  <span className="small muted">{isTeacher ? '先生画面が開きます' : '生徒画面が開きます'}</span>
                </div>
              </div>
            )}

            {!noLessons && (
              <div className="lessons-head">
                <h6 className="section-label">授業 <span className="count">{lessons.length}</span></h6>
                {isTeacher && (
                  <button type="button" className="btn btn-secondary" onClick={() => setDialog({})}>＋ 授業を作成</button>
                )}
              </div>
            )}

            {tags.length > 0 && (
              <div className="tag-filter" role="group" aria-label="タグで絞り込み">
                <span className="tag-filter-label">タグ</span>
                <button type="button" className={`chip${tagFilter === '' ? ' is-on' : ''}`} onClick={() => setTagFilter('')}>すべて</button>
                {tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip${tagFilter === t.name ? ' is-on' : ''}`}
                    onClick={() => setTagFilter(t.name)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            {tagFilter && lessons.length === 0 && (
              <p className="small muted filter-empty">このタグが付いた授業はありません。</p>
            )}

            {planned.length > 0 && (
              <div className="lesson-group">
                <h6 className="section-label">予定</h6>
                {planned.map((l) => (
                  <LessonRow
                    key={l.id}
                    lesson={l}
                    user={user}
                    hasLive={hasLive}
                    onEdit={() => setDialog({ lesson: l })}
                  />
                ))}
              </div>
            )}
            {done.length > 0 && (
              <div className="lesson-group">
                <h6 className="section-label">終了済み</h6>
                {done.map((l) => (
                  <div key={l.id}>
                    <LessonRow
                      lesson={l}
                      user={user}
                      hasLive={hasLive}
                      filesOpen={openFiles === l.id}
                      onToggleFiles={() => setOpenFiles(openFiles === l.id ? null : l.id)}
                      onEdit={() => setDialog({ lesson: l })}
                    />
                    {openFiles === l.id && (
                      <LessonFiles
                        lessonId={l.id}
                        user={user}
                        onDeleted={(f) => {
                          loadLessons();
                          if (preview && preview.id === f.id) setPreview(null);
                          showToast(`「${f.file_name}」を削除しました`);
                        }}
                        onError={showToast}
                        onOpen={setPreview}
                        previewId={preview ? preview.id : null}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {noLessons && (
              isTeacher ? (
                <div className="empty">
                  <h4>最初の授業を作成しましょう</h4>
                  <p>授業を作成して「開始する」を押すと、配信が始まり生徒が入室できるようになります。</p>
                  <button type="button" className="btn btn-primary btn-lg" onClick={() => setDialog({})}>＋ 授業を作成</button>
                </div>
              ) : (
                <div className="empty">
                  <h4>まだ授業はありません</h4>
                  <p>先生が授業を始めると、ここに「入室する」ボタンが表示されます。</p>
                </div>
              )
            )}
          </section>

          <aside data-tab-pane="members" className={`members${tab === 'members' ? ' is-on' : ''}`}>
            <h6 className="section-label">メンバー {isTeacher && <span className="count">{students.length + 1}</span>}</h6>
            <div className="member-group">
              <div className="member-list">
                <span className="person">
                  <Avatar user={{ ...cls.teacher, role: ROLES.TEACHER }} />
                  <span className="person-name">{cls.teacher.name}</span>
                  <RoleBadge role={ROLES.TEACHER} />
                  {cls.teacher.id === user.id && <span className="me-mark">（自分）</span>}
                </span>
              </div>
            </div>
            {isTeacher ? (
              <div className="member-group">
                <h6 className="section-label">生徒 <span className="count">{students.length}</span></h6>
                <div className="member-list">
                  {students.length === 0 && <p className="small muted">まだ生徒はいません。参加コードを伝えてください。</p>}
                  {students.map((m) => (
                    <span key={m.id} className="person">
                      <Avatar user={m} />
                      <span className="person-name">{m.name}</span>
                      <RoleBadge role={m.role} />
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              // メンバー一覧 API は先生専用（docs/04）。生徒には自分だけ表示する
              <div className="member-group">
                <h6 className="section-label">生徒</h6>
                <div className="member-list">
                  <span className="person">
                    <Avatar user={user} />
                    <span className="person-name">{user.name}</span>
                    <RoleBadge role={user.role} />
                    <span className="me-mark">（自分）</span>
                  </span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {dialog && (
        <LessonDialog
          classId={classId}
          lesson={dialog.lesson}
          allTags={tags}
          onClose={() => setDialog(null)}
          onSaved={(title) => {
            setDialog(null);
            showToast(dialog.lesson ? `「${title}」を保存しました` : `「${title}」を作成しました`);
            loadLessons();
            loadTags();
          }}
        />
      )}
      <MaterialPreview file={preview} onClose={() => setPreview(null)} />
      {toast}
    </div>
  );
}

function LessonTags({ tags }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="lesson-tags">
      {tags.map((t) => <span key={t} className="tag tag-neutral">{t}</span>)}
    </div>
  );
}

function LessonRow({ lesson, user, hasLive, filesOpen, onToggleFiles, onEdit }) {
  const navigate = useNavigate();
  const isTeacher = user.role === ROLES.TEACHER;
  const isDone = lesson.status === LESSON_STATUS.ENDED;
  const when = isDone
    ? `${formatDateTime(lesson.started_at)} 〜 ${formatDateTime(lesson.ended_at)}`
    : '開始前';

  let action = null;
  if (lesson.status === LESSON_STATUS.PREPARING && isTeacher) {
    // 開始（POST start）は先生画面の「配信開始」で行う。ここでは先生画面（開始前の状態）を開く
    action = (
      <>
        <button type="button" className="btn btn-primary btn-sm" disabled={hasLive} onClick={() => navigate(lessonPath(lesson.id, user.role))}>
          ▶ 開始する
        </button>
        {hasLive && <span className="why">開催中の授業を終了すると開始できます</span>}
      </>
    );
  } else if (lesson.status === LESSON_STATUS.PREPARING) {
    // 生徒：開始前の授業は待機画面（/learn が preparing を見て出し分ける）
    action = <Link className="btn btn-ghost btn-sm" to={lessonPath(lesson.id, user.role)}>入室して待つ</Link>;
  } else if (isDone && isTeacher) {
    action = <Link className="btn btn-ghost btn-sm" to={`/lessons/${lesson.id}/result`}>結果を見る</Link>;
  } else if (isDone) {
    action = <span className="tag tag-neutral">終了</span>;
  }

  return (
    <div className={`lesson-row${isDone ? ' is-done' : ''}`}>
      <div className="lesson-main">
        <div className="lesson-title">{lesson.title}</div>
        <div className="lesson-when">📅 {when}</div>
        <LessonTags tags={lesson.tags} />
      </div>
      <div className="lesson-actions">
        <div className="lesson-links">
          {isDone && (
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={!!filesOpen} onClick={onToggleFiles}>
              📎 資料 {lesson.material_count} {filesOpen ? '▲' : '▼'}
            </button>
          )}
          {isTeacher && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>編集</button>
          )}
          {action}
        </div>
      </div>
    </div>
  );
}

/** 終了済み授業の資料一覧（先生は自分がアップした資料を2回押しで削除） */
function LessonFiles({ lessonId, user, onDeleted, onError, onOpen, previewId }) {
  const [files, setFiles] = useState(null);
  const [armed, setArmed] = useArmed();

  const load = useCallback(() => {
    get(`/lessons/${lessonId}/files`, { kind: FILE_KINDS.MATERIAL })
      .then((rows) => setFiles(rows || []))
      .catch((err) => {
        setFiles([]);
        onError(err.message);
      });
  }, [lessonId, onError]);
  useEffect(load, [load]);

  async function remove(f) {
    if (armed !== f.id) return setArmed(f.id);
    setArmed(null);
    try {
      await del(`/files/${f.id}`, { redirect: false });
      load();
      onDeleted(f);
    } catch (err) {
      onError(err.message);
    }
  }

  if (!files) return <div className="lesson-files"><p className="small muted" style={{ margin: 0 }}>読み込み中…</p></div>;
  return (
    <div className="lesson-files">
      {files.length === 0 && <p className="small muted" style={{ margin: 0 }}>この授業の資料はありません。</p>}
      {files.map((f) => (
        <div key={f.id} className="file-item">
          <span className={`file-kind${f.mime && f.mime.startsWith('image/') ? ' is-img' : ''}`}>
            {fileKindLabel(f.mime)}
          </span>
          <MaterialButton className="mat-open file-name" file={f} onOpen={onOpen} active={previewId === f.id} />
          <span className="file-pages">{formatBytes(f.size)}</span>
          {f.uploader_id === user.id && (
            <button
              type="button"
              className={`file-del${armed === f.id ? ' is-armed' : ''}`}
              aria-label={`${f.file_name} を削除`}
              onClick={() => remove(f)}
            >
              {armed === f.id ? '削除する' : '削除'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function fileKindLabel(mime) {
  if (!mime) return 'FILE';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return '画像';
  return 'DOC';
}

/**
 * 資料名のボタン。押すと右下のプレビューウィンドウ（MaterialPreview）で開く（新しいタブでは開かない・docs/07 §0）
 * active：いまプレビュー中の資料なら true
 */
export function MaterialButton({ file, onOpen, active = false, className = 'mat-open', children }) {
  return (
    <button
      type="button"
      className={`${className}${active ? ' is-active' : ''}`}
      onClick={() => onOpen(file)}
      title={`${file.file_name} をプレビュー`}
      aria-pressed={active}
    >
      {children || file.file_name}
    </button>
  );
}

/** 削除ボタンの2回押し：1回目で「削除する」に変わり、3秒押さなければ元に戻る（モックどおり） */
export function useArmed(ms = 3000) {
  const [armed, setArmed] = useState(null);
  useEffect(() => {
    if (armed === null) return undefined;
    const t = setTimeout(() => setArmed(null), ms);
    return () => clearTimeout(t);
  }, [armed, ms]);
  return [armed, setArmed];
}

/** 授業の作成／編集ダイアログ（lesson があれば編集） */
function LessonDialog({ classId, lesson, allTags, onClose, onSaved }) {
  useEscape(onClose);
  const [title, setTitle] = useState(lesson ? lesson.title : '');
  const [picked, setPicked] = useState(lesson ? [...lesson.tags] : []);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const choices = [...new Set([...allTags.map((t) => t.name), ...picked])];

  const tagsFull = picked.length >= LIMITS.TAGS_PER_LESSON_MAX;
  const tooManyTags = `タグは${LIMITS.TAGS_PER_LESSON_MAX}個までです`;

  function toggle(name) {
    if (!picked.includes(name) && tagsFull) return setError(tooManyTags);
    setError('');
    setPicked((p) => (p.includes(name) ? p.filter((t) => t !== name) : [...p, name]));
  }
  function addTag() {
    const name = newTag.trim();
    if (!name) return;
    if (name.length > LIMITS.TAG_NAME_MAX) return setError(`タグは${LIMITS.TAG_NAME_MAX}文字以内にしてください`);
    if (!picked.includes(name)) {
      if (tagsFull) return setError(tooManyTags);
      setPicked([...picked, name]);
    }
    setNewTag('');
    setError('');
  }

  async function submit(e) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError('タイトルを入力してください');
    if (t.length > LIMITS.LESSON_TITLE_MAX) return setError(`タイトルは${LIMITS.LESSON_TITLE_MAX}文字以内にしてください`);
    if (picked.length > LIMITS.TAGS_PER_LESSON_MAX) return setError(tooManyTags);
    setBusy(true);
    try {
      if (lesson) await patch(`/lessons/${lesson.id}`, { title: t, tags: picked });
      else await post(`/classes/${classId}/lessons`, { title: t, tags: picked });
      onSaved(t);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" role="dialog" aria-labelledby="dlgLessonTitle" onSubmit={submit} noValidate>
        <div className="dialog-title" id="dlgLessonTitle">{lesson ? '授業を編集' : '授業を作成'}</div>
        <div className="field">
          <label htmlFor="lessonTitle">授業タイトル</label>
          <input
            className="input"
            id="lessonTitle"
            placeholder="例：二次関数の最大・最小"
            autoComplete="off"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="tagInput">タグ <span className="muted">（任意・複数可）</span></label>
          <div className="tag-picker">
            {choices.map((name) => (
              <button
                key={name}
                type="button"
                className={`chip${picked.includes(name) ? ' is-on' : ''}`}
                aria-pressed={picked.includes(name)}
                onClick={() => toggle(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="tag-add">
            <input
              className="input"
              id="tagInput"
              maxLength={LIMITS.TAG_NAME_MAX}
              placeholder="新しいタグ（例：二次関数）"
              autoComplete="off"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <button type="button" className="btn btn-secondary" onClick={addTag}>＋ 追加</button>
          </div>
          <div className="small muted">科目や単元を付けておくと、あとで授業を探しやすくなります</div>
        </div>
        {error && <div className="field-error">{error}</div>}
        {!lesson && (
          <p className="small muted" style={{ margin: 0 }}>
            作成した授業は「予定」に入ります。開始するときに「開始する」を押してください。
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>キャンセル</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{lesson ? '保存' : '作成'}</button>
        </div>
      </form>
    </div>
  );
}
