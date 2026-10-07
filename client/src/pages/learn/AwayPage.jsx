// 一時退出中 — 担当：W4（デザイン：docs/design/12_一時退出中）
// 残り時間は GET attendance/me の remaining_sec（閾値 − 累積 − 今回の経過）から手元で数える。
// 30秒ごとに取り直して時計のずれを直し、授業が終わっていないかも確かめる（この画面は Socket に繋がない）。
// 「授業に戻る」→ POST attendance/return。409 ALREADY_ABSENT なら欠課確定の表示にする。
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ATTENDANCE_STATUS, DEFAULTS, ERROR_CODES, LESSON_STATUS } from '@sotsuken/shared/constants';
import { get, post } from '../../api/client.js';
import LessonHeader from '../../components/learn/LessonHeader.jsx';
import Icon from '../../components/learn/Icon.jsx';
import useIsMobile from '../../components/learn/useIsMobile.js';
import { formatMmSs } from '../../components/learn/format.js';
import './learn.css';

const LOW_SEC = 3 * 60; // 残り3分未満で「わずか」
const RESYNC_MS = 30 * 1000;

export default function AwayPage() {
  const { id } = useParams();
  const lessonId = Number(id);
  const navigate = useNavigate();
  const mobile = useIsMobile();

  const [me, setMe] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [className, setClassName] = useState('');
  // remaining は「endsAt（端末時刻）までの残り」で持ち、1秒ごとに描き直す
  const [sync, setSync] = useState(null); // { awayTotalSec, endsAt }
  const [now, setNow] = useState(Date.now());
  const [expired, setExpired] = useState(false);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');

  const applyMe = useCallback(
    (att) => {
      if (att.status === ATTENDANCE_STATUS.PRESENT) {
        // 退出していない（直接開いた等）は授業画面へ
        navigate(`/lessons/${lessonId}/learn`, { replace: true });
        return;
      }
      if (att.status === ATTENDANCE_STATUS.ABSENT) setExpired(true);
      setSync({ awayTotalSec: att.away_total_sec, endsAt: Date.now() + att.remaining_sec * 1000 });
    },
    [lessonId, navigate]
  );

  // ---- 初回読み込み
  useEffect(() => {
    let alive = true;
    Promise.all([get('/me'), get(`/lessons/${lessonId}`), get(`/lessons/${lessonId}/attendance/me`)])
      .then(([meRes, lessonRes, att]) => {
        if (!alive) return;
        if (lessonRes.status === LESSON_STATUS.ENDED) {
          navigate(`/lessons/${lessonId}/ended`, { replace: true });
          return;
        }
        setMe(meRes);
        setLesson(lessonRes);
        applyMe(att);
        get(`/classes/${lessonRes.class_id}`)
          .then((c) => alive && setClassName(c.name))
          .catch(() => {});
      })
      .catch((err) => {
        if (alive && ![401, 403, 404].includes(err.status)) setNote(err.message || '読み込みに失敗しました');
      });
    return () => {
      alive = false;
    };
  }, [lessonId, navigate, applyMe]);

  // ---- 1秒ごとの描き直し
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- 定期的に取り直す（残り時間の補正・授業終了の検知）
  useEffect(() => {
    if (!lesson) return undefined;
    const t = setInterval(() => {
      get(`/lessons/${lessonId}`)
        .then((l) => l.status === LESSON_STATUS.ENDED && navigate(`/lessons/${lessonId}/ended`, { replace: true }))
        .catch(() => {});
      if (!expired && !returning) get(`/lessons/${lessonId}/attendance/me`).then(applyMe).catch(() => {});
    }, RESYNC_MS);
    return () => clearInterval(t);
  }, [lesson, lessonId, expired, returning, navigate, applyMe]);

  const limitSec = ((lesson && lesson.away_timeout_min) || DEFAULTS.AWAY_TIMEOUT_MIN) * 60;
  const remaining = sync ? Math.max(0, Math.ceil((sync.endsAt - now) / 1000)) : limitSec;
  // 手元で 0 になったら欠課の表示へ（サーバーの判定は1分間隔。戻るを押しても 409 になる）
  useEffect(() => {
    if (sync && remaining <= 0) setExpired(true);
  }, [sync, remaining]);

  async function handleReturn() {
    setReturning(true);
    setNote('');
    try {
      await post(`/lessons/${lessonId}/attendance/return`);
      navigate(`/lessons/${lessonId}/learn`, { replace: true });
    } catch (err) {
      setReturning(false);
      if (err.code === ERROR_CODES.ALREADY_ABSENT) setExpired(true);
      else setNote(err.message || '戻れませんでした。もう一度お試しください');
    }
  }

  if (!me || !lesson) {
    return (
      <div className="lr-loading">
        {note ? <p>{note}</p> : <span className="lr-spinner" />}
      </div>
    );
  }

  const low = !expired && remaining < LOW_SEC;
  const used = Math.min(limitSec, limitSec - remaining);
  const status = expired ? { label: '欠課', tone: 'absent' } : { label: '一時退出中', tone: 'off' };
  const limitMin = Math.round(limitSec / 60);

  return (
    <div className={`lr-away-page${low ? ' is-low' : ''}${mobile ? ' is-mobile' : ''}`}>
      <LessonHeader className={className} title={lesson.title} status={status} me={me} mobile={mobile} />

      <main className="lr-center">
        <div className="lr-center-col">
          {!expired ? (
            <div className="lr-away">
              <h6>一時退出中</h6>
              <p className="lr-away-lesson">{lesson.title}</p>

              <div className="lr-countdown" aria-live="polite">
                <span className="lr-countdown-pre">あと</span>
                <span className="lr-countdown-time">{formatMmSs(remaining)}</span>
                <span className="lr-countdown-post">で欠課になります</span>
              </div>

              {/* 累積ベース：残り ＝ 閾値 − これまでの退出の合計 − 今回の経過 */}
              <div className="lr-away-total">
                <div className="lr-away-total-row">
                  <span>この授業での退出時間（合計）</span>
                  <span className="lr-away-total-num">
                    <strong>{formatMmSs(used)}</strong> / {formatMmSs(limitSec)}
                  </span>
                </div>
                <div className="lr-away-meter" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (used / limitSec) * 100)}%` }} />
                </div>
                <p className="lr-hint">前回までの退出 {formatMmSs(sync ? sync.awayTotalSec : 0)} を含みます</p>
              </div>

              {low ? (
                <p className="lr-lead is-warn">残り時間がわずかです。今すぐ戻りましょう。</p>
              ) : (
                <p className="lr-lead">
                  退出時間の合計が{limitMin}分を超えると欠課になります。
                  <br />
                  戻っても、退出した時間は元に戻りません。
                </p>
              )}

              <div className="lr-actions">
                <button type="button" className="btn btn-primary lr-btn-return" onClick={handleReturn} disabled={returning}>
                  {returning ? (
                    <>
                      <span className="lr-btn-spinner" /> 戻っています…
                    </>
                  ) : (
                    <>
                      <Icon name="back" size={22} />
                      授業に戻る
                    </>
                  )}
                </button>
                {note && <p className="lr-hint is-error">{note}</p>}
              </div>
            </div>
          ) : (
            <div className="lr-away">
              <span className="lr-away-icon">
                <Icon name="clock" size={56} />
              </span>
              <h6>一時退出中</h6>
              <h2>欠課になりました</h2>
              <p className="lr-lead">
                退出時間の合計が{limitMin}分を超えたため、この授業は欠課になりました。
                <br />
                先生に出席の修正を依頼してください。
              </p>
              <p className="lr-away-lesson is-small">{lesson.title}</p>

              <div className="lr-actions">
                <button
                  type="button"
                  className="btn btn-primary lr-btn-return"
                  onClick={() => navigate(`/lessons/${lessonId}/learn`, { replace: true })}
                >
                  授業に参加する（欠課のまま）
                </button>
                <p className="lr-hint">参加しても出席の記録は変わりません</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
