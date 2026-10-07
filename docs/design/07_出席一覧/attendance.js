/* ==========================================================================
   07_attendance.js — 出席一覧・修正（デモ用ロジック）
   実装時は fetch('/api/lessons/:id/attendance') の結果を students に入れる。
   ========================================================================== */
(function () {
  'use strict';
  const esc = Demo.esc, personHtml = Demo.personHtml, mmss = Demo.mmss;

  // ---- モックデータ（30人）----
  const NAMES = [
    '田中 ひなた', '佐藤 みお', '山田 そら', '高橋 れん', '伊藤 ゆい',
    '渡辺 はる', '中村 あおい', '小林 りく', '加藤 めい', '吉田 ゆうと',
    '山本 さくら', '松本 かい', '井上 ひまり', '木村 そうた', '林 ことは',
    '斎藤 はると', '清水 つむぎ', '山口 みなと', '森 いちか', '池田 あさひ',
    '橋本 えま', '阿部 りつ', '石川 すみれ', '前田 だいち', '藤田 のあ',
    '後藤 いおり', '岡田 りょう', '長谷川 ゆな', '村上 しゅん', '近藤 あかり'
  ];
  const STATUS_LABEL = { present: '出席', away: '一時退出', absent: '欠課' };
  const STATUS_ORDER = { away: 0, absent: 1, present: 2 };

  /** 授業開始 10:45 を基準に入室時刻を作る */
  function time(h, m) { return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }

  function buildStudents() {
    return NAMES.map(function (name, i) {
      const s = {
        id: 2409001 + i,
        name: name,
        status: 'present',
        original: 'present',      // サーバー上の自動判定
        entered: time(10, 38 + (i % 9)),
        awayAt: null,
        awayRemainSec: null,     // 一時退出中の残り秒（閾値 − 累積）
        awayTotalSec: 0,         // 累積退出秒数（v4）。退出中は今回の経過も含めて増えていく
        ack: i % 7 !== 3,        // 確認ボタンの応答
        memo: '',
        manual: false
      };
      return s;
    });
  }

  let students = [];
  let timeoutMin = 15;
  let mode = 'normal';           // normal | editing | ended
  let editingId = null;
  let filter = 'all';
  let sortKey = 'name';
  let ticker = null;

  function resetData() {
    students = buildStudents();
    // 一時退出 2人（高橋 れん・清水 つむぎ）
    const away1 = students[3], away2 = students[16];
    // 累積方式：残り ＝ 閾値 − 累積退出時間（清水は2回目の退出で、前回までの分が効いている）
    away1.status = away1.original = 'away'; away1.awayAt = '11:02'; away1.awayTotalSec = 2 * 60 + 26;
    away2.status = away2.original = 'away'; away2.awayAt = '11:09'; away2.awayTotalSec = 11 * 60 + 55;
    away1.awayRemainSec = remainOf(away1); away2.awayRemainSec = remainOf(away2);
    // 出席中だが、過去に退出していた生徒（累積だけ残っている）
    students[5].awayTotalSec = 4 * 60 + 10;
    students[11].awayTotalSec = 1 * 60 + 30;
    students[20].awayTotalSec = 8 * 60 + 45;
    // 欠課 2人（小林 りく＝未入室、前田 だいち＝累積が閾値を超えた）
    const ab1 = students[7], ab2 = students[23];
    ab1.status = ab1.original = 'absent'; ab1.entered = '—'; ab1.ack = false;
    ab2.status = ab2.original = 'absent'; ab2.awayAt = '10:51'; ab2.ack = false; ab2.awayTotalSec = timeoutMin * 60;
    // 手動修正済みが 1 人（山口 みなと：欠課→出席、メモあり）
    const fixed = students[17];
    fixed.original = 'absent'; fixed.status = 'present'; fixed.awayAt = '10:49'; fixed.awayTotalSec = timeoutMin * 60;
    fixed.manual = true; fixed.memo = '回線トラブルのため出席扱い';
  }

  /** 欠課までの残り秒 ＝ 閾値 − 累積退出時間 */
  function remainOf(s) { return Math.max(0, timeoutMin * 60 - s.awayTotalSec); }

  /** 累積退出時間のセル（閾値の2/3を超えたら色を変える） */
  function totalHtml(s) {
    if (!s.awayTotalSec) return '<span class="muted">—</span>';
    const near = s.status !== 'absent' && s.awayTotalSec >= timeoutMin * 60 * 2 / 3;
    return '<span class="total' + (near ? ' is-soon' : '') + '">' + mmss(s.awayTotalSec) + '</span>';
  }

  // ---- 集計 ----
  function renderSummary() {
    const c = { present: 0, away: 0, absent: 0 };
    students.forEach(function (s) { c[s.status]++; });
    document.getElementById('sumPresent').textContent = c.present;
    document.getElementById('sumAway').textContent = c.away;
    document.getElementById('sumAbsent').textContent = c.absent;
  }

  // ---- 一覧 ----
  function statusTag(s) {
    if (s.status === 'present') return '<span class="tag tag-accent">出席</span>';
    if (s.status === 'absent')  return '<span class="tag tag-accent-2">欠課</span>';
    let remain = '';
    if (mode !== 'ended' && s.awayRemainSec != null) {
      const soon = s.awayRemainSec <= 5 * 60;
      remain = '<span class="remain' + (soon ? ' is-soon' : '') + '">残り ' + mmss(s.awayRemainSec) + '</span>';
    }
    return '<span class="tag tag-neutral">一時退出</span>' + remain;
  }

  function manualMark(s) {
    if (!s.manual) return '';
    return '<span class="manual" title="先生が手動で修正しました">' +
      '<svg class="ph" width="12" height="12" viewBox="0 0 256 256" fill="currentColor"><path class="duo" d="M221.7 73.4L182.6 34.3a8 8 0 0 0-11.3 0L48 157.7V208h50.3L221.7 84.7a8 8 0 0 0 0-11.3z"/><path d="M227.3 67.7l-39-39a16.1 16.1 0 0 0-22.6 0L42.3 152a15.9 15.9 0 0 0-4.7 11.3V208a16 16 0 0 0 16 16h44.7a15.9 15.9 0 0 0 11.3-4.7L233 96.3a16.1 16.1 0 0 0 0-22.6zM98.3 208H53.7v-44.6L136 81.1 178.9 124zM190.2 112.7L147.3 69.9 176 41.1 218.9 84z"/></svg>手動修正</span>';
  }

  function ackHtml(s) {
    if (s.status === 'absent' && s.entered === '—') return '<span class="ack ack-no">—</span>';
    return s.ack
      ? '<span class="ack ack-yes"><span class="dot"></span>応答済</span>'
      : '<span class="ack ack-no"><span class="dot dot-neutral"></span>未応答</span>';
  }

  function visibleStudents() {
    let list = students.filter(function (s) { return filter === 'all' || s.status === filter; });
    list.sort(function (a, b) {
      if (sortKey === 'status') return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || a.name.localeCompare(b.name, 'ja');
      if (sortKey === 'total') return (b.awayTotalSec - a.awayTotalSec) || a.name.localeCompare(b.name, 'ja');
      if (sortKey === 'entered') return a.entered.localeCompare(b.entered) || a.name.localeCompare(b.name, 'ja');
      return a.name.localeCompare(b.name, 'ja');
    });
    return list;
  }

  function renderRows() {
    const tbody = document.getElementById('rows');
    const list = visibleStudents();
    tbody.innerHTML = list.map(function (s) {
      return '<tr data-id="' + s.id + '"' + (s.id === editingId ? ' class="is-editing"' : '') + '>' +
        '<td>' + personHtml({ name: s.name, role: 'student' }) + '</td>' +
        '<td><span class="status-cell">' + statusTag(s) + manualMark(s) + '</span></td>' +
        '<td class="num">' + esc(s.entered) + '</td>' +
        '<td class="num">' + esc(s.status === 'away' ? (s.awayAt || '—') : '—') + '</td>' +
        '<td class="num total-cell">' + totalHtml(s) + '</td>' +
        '<td>' + ackHtml(s) + '</td>' +
        '<td class="memo" title="' + esc(s.memo) + '">' + (s.memo ? esc(s.memo) : '<span class="muted">—</span>') + '</td>' +
        '<td><button type="button" class="btn btn-ghost js-edit">' + (s.id === editingId ? '編集中' : '修正') + '</button></td>' +
      '</tr>';
    }).join('');

    document.getElementById('emptyNote').hidden = list.length > 0;

    // 編集行を差し込む
    if (editingId != null) {
      const row = tbody.querySelector('tr[data-id="' + editingId + '"]');
      const s = students.find(function (x) { return x.id === editingId; });
      if (row && s) {
        const frag = document.getElementById('editorTpl').content.cloneNode(true);
        const form = frag.querySelector('form');
        form.querySelector('.editor-status').value = s.status;
        form.querySelector('.editor-memo').value = s.draftMemo != null ? s.draftMemo : s.memo;
        form.addEventListener('submit', function (e) { e.preventDefault(); saveEdit(s, form); });
        form.querySelector('.editor-cancel').addEventListener('click', function () { closeEdit(); });
        row.after(frag);
        if (mode === 'editing') {
          const memoInput = tbody.querySelector('.editor-memo');
          if (memoInput) memoInput.focus();
        }
      }
    }
  }

  /** 一時退出の残り時間だけ描き直す（毎秒） */
  function tickRemain() {
    if (mode === 'ended') return;
    students.forEach(function (s) {
      if (s.status === 'away' && s.awayRemainSec != null) {
        s.awayTotalSec += 1;                 // 退出中は累積が増え続ける
        s.awayRemainSec = remainOf(s);
        if (s.awayRemainSec <= 0) {          // 自動判定：累積が閾値を超えたら欠課
          s.status = s.original = 'absent';
          s.awayRemainSec = null;
          renderSummary();
          renderRows();
          return;
        }
        const row = document.querySelector('tr[data-id="' + s.id + '"] .status-cell');
        if (row) row.innerHTML = statusTag(s) + manualMark(s);
        const total = document.querySelector('tr[data-id="' + s.id + '"] .total-cell');
        if (total) total.innerHTML = totalHtml(s);
      }
    });
  }

  // ---- 編集 ----
  function openEdit(id) {
    editingId = id;
    renderRows();
  }
  function closeEdit() {
    const s = students.find(function (x) { return x.id === editingId; });
    if (s) delete s.draftMemo;
    editingId = null;
    renderRows();
  }
  function saveEdit(s, form) {
    const status = form.querySelector('.editor-status').value;
    const memo = form.querySelector('.editor-memo').value.trim();
    // 実装時：PATCH /api/lessons/:id/attendance/:user_id  { status, memo }
    s.status = status;
    s.memo = memo;
    s.manual = status !== s.original || memo.length > 0;
    if (status !== 'away') s.awayRemainSec = null;
    else if (s.awayRemainSec == null) s.awayRemainSec = remainOf(s);
    delete s.draftMemo;
    editingId = null;
    renderSummary();
    renderRows();
    Demo.toast(s.name + ' を「' + STATUS_LABEL[status] + '」に保存しました');
  }

  // ---- 設定 ----
  document.getElementById('settingsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const v = parseInt(document.getElementById('timeoutMin').value, 10);
    if (!(v >= 1 && v <= 60)) { Demo.toast('1〜60 の数字を入れてください'); return; }
    // 実装時：PATCH /api/lessons/:id  { away_timeout_min: v }
    timeoutMin = v;
    // 閾値を変えたら、以降の判定（残り時間）に反映する
    students.forEach(function (s) { if (s.status === 'away') s.awayRemainSec = remainOf(s); });
    renderRows();
    const saved = document.getElementById('timeoutSaved');
    saved.hidden = false;
    setTimeout(function () { saved.hidden = true; }, 2000);
  });

  // ---- 絞り込み・並び替え ----
  document.querySelectorAll('input[name="filter"]').forEach(function (r) {
    r.addEventListener('change', function () { filter = r.value; renderRows(); });
  });
  document.getElementById('sortSelect').addEventListener('change', function (e) {
    sortKey = e.target.value; renderRows();
  });

  // 行の「修正」ボタン（イベント委譲）
  document.getElementById('rows').addEventListener('click', function (e) {
    const btn = e.target.closest('.js-edit');
    if (!btn) return;
    const id = Number(btn.closest('tr').dataset.id);
    if (id === editingId) closeEdit(); else openEdit(id);
  });

  // ---- 状態切替（デモ）----
  function applyMode(key) {
    mode = key;
    editingId = null;
    resetData();
    const badge = document.getElementById('lessonBadge');
    const note = document.getElementById('endedNote');

    if (key === 'ended') {
      // 授業終了時に出席／欠課の2値に確定する（v4.1）：
      // 退出中だった生徒は、累積が閾値以上なら欠課・未満なら出席。一時退出のままの行は残らない
      students.forEach(function (s) {
        if (s.status === 'away') {
          s.status = s.original = (s.awayTotalSec >= timeoutMin * 60) ? 'absent' : 'present';
          s.awayRemainSec = null;
          s.awayAt = null;
        }
      });
      // 終了間際に退出して、累積が閾値を超えたまま終わった例（近藤 あかり）
      const late = students[29];
      late.status = late.original = 'absent'; late.awayTotalSec = 16 * 60 + 12; late.ack = false;
      badge.innerHTML = '<span class="dot dot-neutral"></span>終了';
      note.hidden = false;
    } else {
      badge.innerHTML = '<span class="dot"></span>授業中';
      note.hidden = true;
    }

    if (key === 'editing') {
      const s = students[3];              // 高橋 れん（一時退出中）を修正中
      s.draftMemo = '回線トラブルのため出席扱い';
      editingId = s.id;
    }

    renderSummary();
    renderRows();
    clearInterval(ticker);
    if (key !== 'ended') ticker = setInterval(tickRemain, 1000);
  }

  Demo.stateBar({
    states: [
      { key: 'normal', label: '通常（授業中）' },
      { key: 'editing', label: '修正中' },
      { key: 'ended', label: '授業終了後' }
    ],
    initial: 'normal',
    onChange: applyMode
  });
})();
