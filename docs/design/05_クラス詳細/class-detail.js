/* class-detail.js — 05 クラス詳細 /classes/:id
   取得：GET /api/classes/:id/lessons(?tag=) ／ GET /api/classes/:id/tags ／ GET /api/classes/:id/members ／ 作成：POST /api/classes/:id/lessons {title, tags} ／ 編集：PATCH /api/lessons/:id {title, tags}
   終了済み授業の資料：GET /api/lessons/:id/files?kind=material ／ 削除：DELETE /api/files/:id（すべてモック） */
(function () {
  'use strict';
  var S = window.S46;

  /* ---------- モックデータ ---------- */
  var LESSONS = [
    { id: 1, title: '二次関数のグラフと平行移動', when: '今日 10:00', status: 'planned', tags: ['数学', '二次関数'] },
    { id: 2, title: '二次関数の最大・最小', when: '10月2日（金） 10:00', status: 'planned', tags: ['数学', '二次関数'] },
    { id: 3, title: '二次関数とは', when: '9月26日（金） 10:00', status: 'done', tags: ['数学', '二次関数'],
      files: [{ kind: 'PDF', name: '第3章 二次関数.pdf', pages: 12 }, { kind: '画像', name: '板書_二次関数とは.png', pages: 1 }, { kind: 'PDF', name: '練習問題01.pdf', pages: 2 }] },
    { id: 4, title: '一次関数の復習', when: '9月24日（水） 10:00', status: 'done', tags: ['数学', '一次関数', '復習'],
      files: [{ kind: 'PDF', name: '一次関数_復習プリント.pdf', pages: 4 }] }
  ];
  var openFiles = null;          // 資料一覧を開いている終了済み授業の id
  var editId = null;             // 編集中の授業 id（null＝新規作成）
  var fileArmed = null;          // 削除の確認中（"授業id:番号"）
  var fileArmTimer = null;
  /* クラスのタグ一覧（GET /api/classes/:id/tags）。タグはクラスごとに管理 */
  var TAGS = ['数学', '二次関数', '一次関数', '復習'];
  var tagFilter = null;          // 絞り込み中のタグ（null＝すべて）
  var draftTags = [];            // 作成ダイアログで選択中のタグ
  var ME = { teacher: { name: S.TEACHER, role: 'teacher' }, student: { name: '田中 ひなた', role: 'student' } };
  var ctx;

  /* ---------- 描画 ---------- */
  function tagsHtml(tags) {
    return (tags || []).map(function (t) { return '<span class="tag tag-neutral">' + S.esc(t) + '</span>'; }).join('');
  }

  /* タグで絞り込み（1つ選択。もう一度押すと解除） */
  function renderTagFilter(lessons) {
    var used = TAGS.filter(function (t) { return lessons.some(function (l) { return (l.tags || []).indexOf(t) >= 0; }); });
    var el = document.getElementById('tagFilter');
    el.hidden = used.length === 0;
    el.innerHTML = '<span class="tag-filter-label">タグ</span>' +
      '<button type="button" class="chip' + (tagFilter === null ? ' is-on' : '') + '" data-tag="">すべて</button>' +
      used.map(function (t) { return '<button type="button" class="chip' + (tagFilter === t ? ' is-on' : '') + '" data-tag="' + S.esc(t) + '">' + S.esc(t) + '</button>'; }).join('');
  }

  /* 作成ダイアログのタグ選択 */
  function renderTagPicker() {
    var all = TAGS.concat(draftTags.filter(function (t) { return TAGS.indexOf(t) < 0; }));
    document.getElementById('tagPicker').innerHTML = all.map(function (t) {
      var on = draftTags.indexOf(t) >= 0;
      return '<button type="button" class="chip' + (on ? ' is-on' : '') + '" data-pick="' + S.esc(t) + '" aria-pressed="' + on + '">' + S.esc(t) + '</button>';
    }).join('');
  }

  function lessonRow(l, hasLive) {
    var isTeacher = ctx.role === 'teacher';
    var actions = '';
    if (l.status === 'planned' && isTeacher) {
      actions = '<button type="button" class="btn btn-primary btn-sm" data-start="' + l.id + '"' + (hasLive ? ' disabled' : '') + '>' + S.icon('play', 14) + '開始する</button>' +
        (hasLive ? '<span class="why">開催中の授業を終了すると開始できます</span>' : '');
    } else if (l.status === 'done' && isTeacher) {
      actions = '<a class="btn btn-ghost btn-sm" href="../08_授業結果/index.html?lesson=' + l.id + '">' + S.icon('chart-bar', 14) + '結果を見る</a>';
    } else if (l.status === 'done') {
      actions = '<span class="tag tag-neutral">終了</span>';
    }
    /* 終了済み：資料を開く（先生・生徒とも）／先生：編集（タイトル・タグ） */
    var links = '';
    var open = openFiles === l.id;
    if (l.status === 'done') {
      links += '<button type="button" class="btn btn-ghost btn-sm" data-files="' + l.id + '" aria-expanded="' + open + '">' +
        S.icon('paperclip', 14) + '資料 ' + (l.files || []).length + S.icon(open ? 'caret-up' : 'caret-down', 12) + '</button>';
    }
    if (isTeacher) links += '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + l.id + '">編集</button>';
    actions = '<div class="lesson-links">' + links + actions + '</div>';
    var filesPanel = '';
    if (l.status === 'done' && open) {
      var files = l.files || [];
      filesPanel = '<div class="lesson-files">' + (files.length ? files.map(function (f, i) {
        var key = l.id + ':' + i;
        return '<div class="file-item"><span class="file-kind' + (f.kind === 'PDF' ? '' : ' is-img') + '">' + S.esc(f.kind) + '</span>' +
          '<a class="file-name" href="#" onclick="return false">' + S.esc(f.name) + '</a><span class="file-pages">' + f.pages + 'p</span>' +
          (isTeacher ? '<button type="button" class="file-del' + (fileArmed === key ? ' is-armed' : '') + '" data-file-del="' + key + '" aria-label="' + S.esc(f.name) + ' を削除">' + (fileArmed === key ? '削除する' : '削除') + '</button>' : '') +
          '</div>';
      }).join('') : '<p class="small muted" style="margin:0">この授業の資料はありません。</p>') + '</div>';
    }
    return '<div class="lesson-row' + (l.status === 'done' ? ' is-done' : '') + '">' +
      '<div class="lesson-main"><div class="lesson-title">' + S.esc(l.title) + '</div>' +
      '<div class="lesson-when">' + S.icon('calendar', 13) + S.esc(l.when) + '</div>' +
      ((l.tags || []).length ? '<div class="lesson-tags">' + tagsHtml(l.tags) + '</div>' : '') + '</div>' +
      '<div class="lesson-actions">' + actions + '</div></div>' + filesPanel;
  }

  function render() {
    var me = ME[ctx.role];
    var isTeacher = ctx.role === 'teacher';
    document.getElementById('me').innerHTML = S.avatar(me.name, me.role) + '<span class="person-name">' + S.esc(me.name) + '</span>' + S.roleTag(me.role);

    var empty = ctx.state === 'empty';
    var hasLive = ctx.state === 'live';
    var lessons = empty ? [] : LESSONS.map(function (l) { return Object.assign({}, l, { status: (hasLive && l.id === 1) ? 'live' : l.status }); });
    var live = lessons.filter(function (l) { return l.status === 'live'; })[0];
    /* タグ絞り込み（開催中の授業は絞り込みに関係なく常に上に出す） */
    renderTagFilter(lessons);
    var match = function (l) { return tagFilter === null || (l.tags || []).indexOf(tagFilter) >= 0; };
    var planned = lessons.filter(function (l) { return l.status === 'planned' && match(l); });
    var done = lessons.filter(function (l) { return l.status === 'done' && match(l); });
    document.getElementById('filterEmpty').hidden = empty || tagFilter === null || planned.length + done.length > 0;

    /* 開催中の授業 */
    document.getElementById('liveHero').hidden = !live;
    document.getElementById('hdrLive').hidden = !live;
    if (live) {
      document.getElementById('liveTitle').textContent = live.title;
      document.getElementById('liveWhen').textContent = live.when + ' 開始';
      document.getElementById('liveTags').innerHTML = tagsHtml(live.tags);
      document.getElementById('btnEnter').href = isTeacher ? '../06_先生画面_授業中/index.html' : '../10_生徒画面_授業中/index.html';
      document.getElementById('enterHint').textContent = isTeacher ? '先生画面が開きます' : '生徒画面が開きます';
    }

    /* 授業一覧 */
    document.getElementById('lessonCount').textContent = (tagFilter === null ? lessons.length : planned.length + done.length + (live && match(live) ? 1 : 0)) + '件';
    document.getElementById('plannedGroup').hidden = planned.length === 0;
    document.getElementById('plannedList').innerHTML = planned.map(function (l) { return lessonRow(l, !!live); }).join('');
    document.getElementById('doneGroup').hidden = done.length === 0;
    document.getElementById('doneList').innerHTML = done.map(function (l) { return lessonRow(l, !!live); }).join('');
    document.getElementById('emptyTeacher').hidden = !(empty && isTeacher);
    document.getElementById('emptyStudent').hidden = !(empty && !isTeacher);
    document.querySelector('.lessons-head').hidden = empty;

    /* メンバー一覧（先生を先頭に） */
    var students = S.STUDENTS;
    document.getElementById('memberCount').textContent = (students.length + 1) + '人';
    document.getElementById('tabMemberCount').textContent = '(' + (students.length + 1) + ')';
    document.getElementById('studentCount').textContent = students.length + '人';
    document.getElementById('teacherList').innerHTML = S.person(S.TEACHER, 'teacher') + (isTeacher ? '<span class="me-mark">（自分）</span>' : '');
    document.getElementById('studentList').innerHTML = students.map(function (n) {
      return S.person(n, 'student') + (!isTeacher && n === me.name ? '<span class="me-mark">（自分）</span>' : '');
    }).join('');

    /* ダイアログ */
    document.getElementById('dlgCreate').hidden = ctx.state !== 'dlg-create';
    if (ctx.state === 'dlg-create') renderTagPicker();
    document.getElementById('dlgCreateTitle').textContent = editId ? '授業を編集' : '授業を作成';
    document.getElementById('btnCreateSubmit').textContent = editId ? '保存' : '作成';
    document.getElementById('createHint').hidden = !!editId;
    if (ctx.state === 'dlg-create') setTimeout(function () { document.getElementById('lessonTitle').focus(); }, 0);
    S.renderIcons();
  }

  /* ---------- 状態切替バー ---------- */
  ctx = S.demoBar({
    states: [
      { key: 'normal', label: '通常' },
      { key: 'live', label: '開催中の授業あり' },
      { key: 'empty', label: '授業0件' },
      { key: 'dlg-create', label: '授業作成ダイアログ' }
    ],
    roles: [{ key: 'teacher', label: '先生' }, { key: 'student', label: '生徒' }],
    device: true,
    onChange: function (c) {
      ctx = c;
      if (c.state === 'dlg-create' && c.role !== 'teacher') { c.role = 'teacher'; c.set('role', 'teacher'); return; }
      render();
    }
  });

  /* ---------- スマホのタブ ---------- */
  document.querySelectorAll('[data-tab]').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('is-on', x === t); });
      document.querySelectorAll('[data-tab-pane]').forEach(function (p) { p.classList.toggle('is-on', p.dataset.tabPane === t.dataset.tab); });
    });
  });

  /* ---------- 操作 ---------- */
  var prevState = 'normal';
  /* 編集：作成と同じダイアログにタイトル・タグを入れて開く */
  function openEdit(id) {
    var l = LESSONS.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    if (ctx.state !== 'dlg-create') prevState = ctx.state;
    editId = id;
    document.getElementById('lessonTitle').value = l.title;
    document.getElementById('lessonTitleError').hidden = true;
    document.getElementById('tagInput').value = '';
    draftTags = (l.tags || []).slice();
    ctx.set('state', 'dlg-create');
  }
  function openCreate() { editId = null; if (ctx.state !== 'dlg-create') prevState = ctx.state; document.getElementById('lessonTitle').value = ''; document.getElementById('lessonTitleError').hidden = true; draftTags = []; document.getElementById('tagInput').value = ''; ctx.set('state', 'dlg-create'); }
  function closeDialog() { editId = null; ctx.set('state', prevState); }

  /* 授業一覧の中のボタン：資料を開く／編集／資料の削除（2回押し） */
  document.querySelector('[data-tab-pane="lessons"]').addEventListener('click', function (e) {
    var f = e.target.closest('[data-files]');
    if (f) { var id = Number(f.dataset.files); openFiles = (openFiles === id) ? null : id; fileArmed = null; render(); return; }
    var ed = e.target.closest('[data-edit]');
    if (ed) { openEdit(Number(ed.dataset.edit)); return; }
    var del = e.target.closest('[data-file-del]');
    if (del) {
      var key = del.dataset.fileDel;
      clearTimeout(fileArmTimer);
      if (fileArmed === key) {
        var p = key.split(':');
        var l = LESSONS.filter(function (x) { return x.id === Number(p[0]); })[0];
        var name = l.files[Number(p[1])].name;
        l.files.splice(Number(p[1]), 1);
        fileArmed = null; render();
        S.toast('「' + name + '」を削除しました', 'check-circle');
      } else {
        fileArmed = key; render();
        fileArmTimer = setTimeout(function () { fileArmed = null; render(); }, 3000);
      }
    }
  });
  document.getElementById('btnCreateLesson').addEventListener('click', openCreate);
  document.querySelectorAll('[data-open-create]').forEach(function (b) { b.addEventListener('click', openCreate); });
  document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeDialog); });
  document.getElementById('dlgCreate').addEventListener('click', function (e) { if (e.target === this) closeDialog(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ctx.state === 'dlg-create') closeDialog(); });

  /* タグで絞り込み */
  document.getElementById('tagFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tag]');
    if (!b) return;
    var t = b.dataset.tag || null;
    tagFilter = (t === tagFilter) ? null : t;
    render();
  });

  /* 作成ダイアログ：既存タグの選択／新しいタグの追加 */
  document.getElementById('tagPicker').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick]');
    if (!b) return;
    var i = draftTags.indexOf(b.dataset.pick);
    if (i >= 0) draftTags.splice(i, 1); else draftTags.push(b.dataset.pick);
    renderTagPicker();
  });
  function addDraftTag() {
    var input = document.getElementById('tagInput');
    var t = input.value.trim();
    if (!t) return;
    if (draftTags.indexOf(t) < 0) draftTags.push(t);
    input.value = '';
    renderTagPicker();
    input.focus();
  }
  document.getElementById('btnTagAdd').addEventListener('click', addDraftTag);
  document.getElementById('tagInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addDraftTag(); }   // Enter はタグ追加（フォーム送信しない）
  });

  /* 授業を作成 → POST /api/classes/:id/lessons {title, tags} → 予定に追加 */
  document.getElementById('formCreate').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = document.getElementById('lessonTitle').value.trim();
    var err = document.getElementById('lessonTitleError');
    if (!title) { err.hidden = false; return; }
    var btn = document.getElementById('btnCreateSubmit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>' + (editId ? '保存中' : '作成中');
    setTimeout(function () {
      btn.disabled = false; btn.textContent = '作成';
      var tags = draftTags.slice();
      tags.forEach(function (t) { if (TAGS.indexOf(t) < 0) TAGS.push(t); });   // 新しいタグはクラスのタグ一覧に加わる
      if (editId) {
        /* 編集 → PATCH /api/lessons/:id {title, tags} */
        var target = LESSONS.filter(function (x) { return x.id === editId; })[0];
        target.title = title; target.tags = tags;
        editId = null;
        ctx.set('state', prevState);
        S.toast('「' + title + '」を保存しました', 'check-circle');
        return;
      }
      LESSONS.splice(2, 0, { id: Date.now(), title: title, when: '未定', status: 'planned', tags: tags });
      ctx.set('state', prevState === 'empty' ? 'normal' : prevState);
      S.toast('「' + title + '」を作成しました', 'check-circle');
    }, 700);
  });

  /* 開始する → 開催中にして先生画面へ */
  document.getElementById('plannedList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-start]');
    if (!b || b.disabled) return;
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>開始中';
    setTimeout(function () { location.href = '../06_先生画面_授業中/index.html?state=before'; }, 600);
  });

  /* 参加コードをコピー */
  document.getElementById('btnCopy').addEventListener('click', function () {
    var v = document.getElementById('joinCode').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(v).catch(function () {});
    S.toast('コピーしました', 'check-circle');
  });
})();
