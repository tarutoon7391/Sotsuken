/* class-list.js — 04 クラス一覧 /classes
   取得：GET /api/classes ／ 作成：POST /api/classes ／ 参加：POST /api/classes/join（すべてモック） */
(function () {
  'use strict';
  var S = window.S46;

  /* ---------- モックデータ（全画面共通の架空データ） ---------- */
  var CLASSES = [
    { id: 1, name: '2年A組・数学', teacher: '鈴木先生', members: 31, code: 'K7Q-4MP', live: true, lesson: '二次関数のグラフと平行移動', started: '10:00' },
    { id: 2, name: '2年A組・英語', teacher: '鈴木先生', members: 31, code: 'B3X-9RT', live: false },
    { id: 3, name: '3年B組・情報', teacher: '鈴木先生', members: 28, code: 'M8D-2QL', live: false }
  ];
  var ME = { teacher: { name: '鈴木先生', role: 'teacher' }, student: { name: '田中 ひなた', role: 'student' } };

  var ctx; /* デモの状態（state / role / mobile） */

  /* ---------- 描画 ---------- */
  function classCard(c) {
    return '<button type="button" class="card class-card" data-go="' + c.id + '">' +
      '<div class="card-top"><div class="card-title">' + S.esc(c.name) + '</div>' +
      (c.live ? '<span class="live-tag"><span class="dot"></span>授業中</span>' : '') + '</div>' +
      S.person(c.teacher, 'teacher', { size: 'avatar-md' }) +
      '<div class="card-meta">' + S.icon('users', 14) + c.members + '人</div>' +
      '</button>';
  }
  function liveCard(c) {
    var enter = ctx.role === 'teacher' ? '../06_先生画面_授業中/index.html' : '../10_生徒画面_授業中/index.html';
    return '<div class="card live-card">' +
      '<div class="card-top"><div class="card-title">' + S.esc(c.name) + '</div><span class="live-tag"><span class="dot dot-live"></span>授業中</span></div>' +
      '<p class="live-lesson strong">' + S.esc(c.lesson) + '</p>' +
      '<div class="card-meta">' + S.icon('clock', 14) + c.started + ' 開始 ・ ' + S.person(c.teacher, 'teacher', { size: 'avatar-sm', noTag: true }) + '</div>' +
      '<div class="live-actions"><a class="btn btn-primary" href="' + enter + '">' + S.icon('sign-in', 18) + '入室する</a>' +
      '<a class="btn btn-ghost" href="../05_クラス詳細/index.html?class=' + c.id + '">クラス詳細</a></div>' +
      '</div>';
  }

  function render() {
    var me = ME[ctx.role];
    document.getElementById('me').innerHTML = S.avatar(me.name, me.role) + '<span class="person-name">' + S.esc(me.name) + '</span>' + S.roleTag(me.role);

    var empty = ctx.state === 'empty';
    var hasLive = ctx.state === 'live' || ctx.state.indexOf('dlg-') === 0;
    var list = empty ? [] : CLASSES.map(function (c) { return Object.assign({}, c, { live: hasLive && c.live }); });
    var lives = list.filter(function (c) { return c.live; });
    var rest = list.filter(function (c) { return !c.live; });

    document.getElementById('liveSection').hidden = lives.length === 0;
    document.getElementById('liveGrid').innerHTML = lives.map(liveCard).join('');

    document.getElementById('allSection').hidden = empty;
    document.getElementById('allCount').textContent = list.length + '件';
    /* 授業中のクラスは一覧の先頭にも出す */
    document.getElementById('classGrid').innerHTML = lives.concat(rest).map(classCard).join('');

    document.getElementById('emptyTeacher').hidden = !(empty && ctx.role === 'teacher');
    document.getElementById('emptyStudent').hidden = !(empty && ctx.role === 'student');
    document.getElementById('headSub').textContent = ctx.role === 'teacher'
      ? (empty ? 'まだクラスがありません' : '授業を始めるクラスを選んでください')
      : (empty ? 'まだクラスに参加していません' : '授業中のクラスがあれば、ここからすぐ入れます');

    /* ダイアログ */
    document.getElementById('dlgCreate').hidden = ctx.state !== 'dlg-create';
    document.getElementById('dlgCreated').hidden = ctx.state !== 'dlg-created';
    document.getElementById('dlgJoin').hidden = !(ctx.state === 'dlg-join' || ctx.state === 'dlg-join-error');
    var joinErr = ctx.state === 'dlg-join-error';
    document.getElementById('joinError').hidden = !joinErr;
    document.getElementById('joinCode').classList.toggle('is-error', joinErr);
    if (joinErr && !document.getElementById('joinCode').value) document.getElementById('joinCode').value = 'K7Q-4MQ';
    if (ctx.state === 'dlg-create') setTimeout(function () { document.getElementById('className').focus(); }, 0);
    if (ctx.state === 'dlg-join') setTimeout(function () { document.getElementById('joinCode').focus(); }, 0);
    S.renderIcons();
  }

  /* ---------- 状態切替バー ---------- */
  ctx = S.demoBar({
    states: [
      { key: 'live', label: '通常（授業中あり）' },
      { key: 'nolive', label: '通常（授業中なし）' },
      { key: 'empty', label: 'クラス0件' },
      { key: 'dlg-create', label: '作成ダイアログ' },
      { key: 'dlg-created', label: '作成完了' },
      { key: 'dlg-join', label: '参加コード入力' },
      { key: 'dlg-join-error', label: 'コードが違う' }
    ],
    roles: [{ key: 'teacher', label: '先生' }, { key: 'student', label: '生徒' }],
    device: true,
    onChange: function (c) {
      ctx = c;
      /* ダイアログはロールに合わせる（作成＝先生／参加＝生徒） */
      if ((c.state === 'dlg-create' || c.state === 'dlg-created') && c.role !== 'teacher') { c.role = 'teacher'; c.set('role', 'teacher'); return; }
      if ((c.state === 'dlg-join' || c.state === 'dlg-join-error') && c.role !== 'student') { c.role = 'student'; c.set('role', 'student'); return; }
      render();
    }
  });

  /* ---------- 操作 ---------- */
  var prevState = 'live';
  function openDialog(kind) {
    if (ctx.state.indexOf('dlg-') !== 0) prevState = ctx.state;
    document.getElementById('joinCode').value = '';
    document.getElementById('className').value = '';
    document.getElementById('classNameError').hidden = true;
    ctx.set('state', kind === 'create' ? 'dlg-create' : 'dlg-join');
  }
  function closeDialog() { ctx.set('state', prevState === 'empty' ? 'empty' : prevState); }

  document.getElementById('btnCreate').addEventListener('click', function () { openDialog('create'); });
  document.getElementById('btnJoin').addEventListener('click', function () { openDialog('join'); });
  document.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { openDialog(b.dataset.open); }); });
  document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeDialog); });
  document.querySelectorAll('.dialog-backdrop').forEach(function (bd) {
    bd.addEventListener('click', function (e) { if (e.target === bd) closeDialog(); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ctx.state.indexOf('dlg-') === 0) closeDialog(); });

  /* 送信中：ボタンがスピナー付きで押せない */
  function sending(btn, label, done) {
    var orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>' + label;
    setTimeout(function () { btn.disabled = false; btn.innerHTML = orig; done(); }, 800);
  }

  /* クラスを作成 → POST /api/classes → 参加コードを表示 */
  document.getElementById('formCreate').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('className').value.trim();
    var err = document.getElementById('classNameError');
    if (!name) { err.hidden = false; document.getElementById('className').focus(); return; }
    err.hidden = true;
    sending(document.getElementById('btnCreateSubmit'), '作成中', function () {
      document.querySelector('[data-created-name]').textContent = name;
      ctx.set('state', 'dlg-created');
    });
  });

  /* 参加コードで参加 → POST /api/classes/join */
  document.getElementById('formJoin').addEventListener('submit', function (e) {
    e.preventDefault();
    var code = document.getElementById('joinCode').value.trim().toUpperCase();
    sending(document.getElementById('btnJoinSubmit'), '確認中', function () {
      var hit = CLASSES.filter(function (c) { return c.code === code; })[0];
      if (!hit) { ctx.set('state', 'dlg-join-error'); return; }
      ctx.set('state', 'live');
      S.toast(hit.name + ' に参加しました', 'check-circle');
    });
  });
  document.getElementById('joinCode').addEventListener('input', function () {
    if (ctx.state === 'dlg-join-error') { ctx.state = 'dlg-join'; document.getElementById('joinError').hidden = true; this.classList.remove('is-error'); }
  });

  /* コピー */
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = document.getElementById('createdCode').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(v).catch(function () {});
      S.toast('コピーしました', 'check-circle');
    });
  });

  /* カードを押すとクラス詳細へ */
  document.getElementById('classGrid').addEventListener('click', function (e) {
    var card = e.target.closest('[data-go]');
    if (card) location.href = '../05_クラス詳細/index.html?class=' + card.dataset.go;
  });
})();
