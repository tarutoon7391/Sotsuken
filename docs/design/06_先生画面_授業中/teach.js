/* teach.js — 06 先生画面（授業中） /lessons/:id/teach（PC のみ）
   すべてモック。配信・理解度・出席・確認・質問箱・チャット・資料は画面内の状態で動く。 */
(function () {
  'use strict';
  var S = window.S46;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- モックデータ ---------- */
  var ME = { name: S.TEACHER, role: 'teacher' };
  var TOTAL = 30;

  /* 生徒 30 人の状態：cam（カメラON）・hand（挙手）・r（反応 got/lost/again/null）・away（一時退出の残り秒） */
  function makeStudents(profile) {
    var camOn = [0, 1, 2, 4, 5, 7, 8, 10, 11, 13, 15, 16, 17, 20, 22, 24, 26, 28];
    var reactions = profile === 'lost'
      ? 'got,lost,got,lost,again,lost,got,lost,got,lost,again,got,lost,got,lost,got,lost,again,got,lost,got,lost,got,got,lost,again,got,lost,,'.split(',')
      : 'got,lost,got,got,lost,got,again,got,got,lost,got,got,got,again,got,lost,got,got,got,lost,got,got,lost,got,again,got,got,lost,,'.split(',');
    return S.STUDENTS.map(function (n, i) {
      return { name: n, cam: camOn.indexOf(i) >= 0, hand: (i === 2 || i === 3), r: profile === 'before' ? null : (reactions[i] || null), away: 0 };
    });
  }
  var students = makeStudents('live');
  /* 一時退出中：森 かいと（残り 12:34）・池田 あかり（残り 3:10） */
  function setAway() { students[18].away = 12 * 60 + 34; students[19].away = 3 * 60 + 10; students[18].r = null; students[19].r = null; students[18].hand = false; students[19].hand = false; }
  setAway();

  var questions = [
    { name: '匿名', real: '田中 ひなた', anon: true, time: '10:12', answered: true, body: '平行移動で符号が逆になる理由がよくわかりません' },
    { name: '山田 そら', anon: false, time: '10:18', answered: false, body: '頂点の座標は式のどこを見ればいいですか？' },
    { name: '匿名', real: '佐藤 みお', anon: true, time: '10:21', answered: false, body: 'y=(x-2)^2+3 のグラフを書くとき、先に頂点を打っていいですか？' }
  ];
  var messages = [
    { name: '鈴木先生', role: 'teacher', time: '10:05', body: '今日は p.24 から始めます。資料を開いておいてください。' },
    { name: '佐藤 みお', role: 'student', time: '10:09', body: 'ノート撮ったので共有します', file: 'note_0930.jpg', img: true },
    { name: '鈴木先生', role: 'teacher', time: '10:20', body: '練習問題はこのPDFです', file: 'practice_02.pdf', pdf: true }
  ];
  var materials = [
    { kind: 'PDF', name: '第3章 二次関数.pdf', pages: 12 },
    { kind: 'PDF', name: '練習問題02.pdf', pages: 3 },
    { kind: 'IMG', name: '板書_平行移動.png', pages: 1 }
  ];

  /* 画面の動的状態 */
  var ui = {
    spot: null,            /* スポットライト中の生徒名 */
    elapsed: 23 * 60 + 14, /* 配信の経過秒 */
    since: 4 * 60 + 12,    /* 最終リセットからの秒 */
    mic: true, src: 'screen', rtab: 'qa', unread: { qa: 0, chat: 2 },
    check: { phase: 'idle', sec: 60, resp: 0, noresp: [] },
    autoMin: 0
  };
  var ctx;
  var isBefore = function () { return ctx.state === 'before'; };

  /* ---------- 描画 ---------- */
  function renderHeader() {
    $('me').innerHTML = S.avatar(ME.name, 'teacher') + '<span class="person-name">' + S.esc(ME.name) + '</span>' + S.roleTag('teacher');
    var before = isBefore(), rc = ctx.state === 'reconnect';
    $('liveDot').className = 'dot ' + (before ? 'dot-neutral' : rc ? 'dot-accent-2' : 'dot-live');
    $('liveLabel').textContent = before ? '配信前' : rc ? '再接続中' : '配信中';
    $('elapsed').hidden = before;
    $('elapsed').textContent = S.hhmmss(ui.elapsed);
    $('reconnectBand').hidden = !rc;
    $('conn').innerHTML = rc ? '<span class="dot dot-accent-2"></span>再接続中' : before ? '<span class="dot dot-neutral"></span>未配信' : '<span class="dot"></span>接続良好';
  }

  function renderPreview() {
    var before = isBefore();
    $('previewBefore').hidden = !before;
    $('previewLive').hidden = before;
    $('previewLabel').textContent = before ? 'プレビュー' : '配信中の画面';
    $('previewSrc').textContent = ui.src === 'screen' ? '画面共有' : 'カメラ';
    $('previewLive').querySelector('[data-icon]').dataset.icon = ui.src === 'screen' ? 'monitor' : 'camera';
    $('btnStop').hidden = before;
    $('btnMic').classList.toggle('is-off', !ui.mic);
    $('btnMic').querySelector('[data-icon]').dataset.icon = ui.mic ? 'mic' : 'mic-slash';
    $('btnMic').title = ui.mic ? 'マイク ON（押すとOFF）' : 'マイク OFF（押すとON）';
  }

  function renderAttendance() {
    var before = isBefore();
    var away = students.filter(function (s) { return s.away > 0; }).length;
    $('attPresent').textContent = before ? 24 : TOTAL - away - 1;
    $('attAway').textContent = before ? 0 : away;
    $('attAbsent').textContent = before ? '—' : 1;
  }

  function renderUnderstand() {
    var got = 0, lost = 0, again = 0;
    students.forEach(function (s) { if (s.r === 'got') got++; else if (s.r === 'lost') lost++; else if (s.r === 'again') again++; });
    var resp = got + lost + again;
    var pct = function (n) { return resp ? Math.round(n / resp * 100) : 0; };
    $('uResp').textContent = resp + '/' + TOTAL + ' 人が回答';
    $('barGot').style.width = pct(got) + '%'; $('cntGot').textContent = got; $('pctGot').textContent = pct(got) + '%';
    $('barLost').style.width = pct(lost) + '%'; $('cntLost').textContent = lost; $('pctLost').textContent = pct(lost) + '%';
    $('barAgain').style.width = pct(again) + '%'; $('cntAgain').textContent = again; $('pctAgain').textContent = pct(again) + '%';
    var alert = resp > 0 && lost / resp > 0.3;
    $('understand').classList.toggle('is-alert', alert);
    $('uAlert').hidden = !alert;
    $('uSince').textContent = '最終リセットから ' + S.mmss(ui.since).replace(/^0/, '');
  }

  function tile(s) {
    var cls = 'tile' + (s.cam ? ' is-cam' : '') + (s.hand ? ' is-hand' : '') + (s.r === 'lost' ? ' is-lost' : '') + (s.away > 0 ? ' is-away' : '') + (ui.spot === s.name ? ' is-spot' : '');
    return '<div class="' + cls + '" data-name="' + S.esc(s.name) + '" tabindex="0">' +
      '<span class="tile-face">' + S.esc(s.name.charAt(0)) + '</span>' +
      '<span class="tile-lost" title="わからない"></span>' +
      '<span class="tile-hand" title="挙手中">' + S.icon('hand', 14) + '</span>' +
      '<span class="tile-spotmark">' + S.icon('star', 10) + 'スポットライト</span>' +
      '<span class="tile-away">一時退出中<br>残り ' + S.mmss(s.away) + '</span>' +
      '<span class="tile-name">' + S.esc(s.name) + '</span>' +
      (ui.spot === s.name ? '' : '<button type="button" class="tile-spot" data-spot="' + S.esc(s.name) + '">' + S.icon('star', 12) + 'スポットライト</button>') +
      '</div>';
  }
  function renderTiles() {
    var list = isBefore() ? students.slice(0, 24) : students;
    /* 挙手中の生徒を先頭に */
    var sorted = list.slice().sort(function (a, b) { return (b.hand ? 1 : 0) - (a.hand ? 1 : 0); });
    $('tileCount').textContent = list.length + '/' + TOTAL + ' 人入室';
    $('tiles').innerHTML = sorted.map(tile).join('');
    $('spotBanner').hidden = !ui.spot;
    if (ui.spot) $('spotName').textContent = ui.spot;
  }

  function renderCheck() {
    var c = ui.check;
    $('checkIdle').hidden = c.phase !== 'idle';
    $('checkRunning').hidden = c.phase !== 'running';
    $('checkDone').hidden = c.phase !== 'done';
    $('btnCheck').disabled = isBefore();
    if (c.phase === 'running') {
      $('checkSec').textContent = c.sec;
      $('checkSec').classList.toggle('is-low', c.sec <= 10);
      $('checkResp').innerHTML = c.resp + '<span class="muted" style="font-size:14px">/' + TOTAL + '</span>';
      $('checkBar').style.width = (c.sec / 60 * 100) + '%';
    }
    if (c.phase === 'done') {
      $('noRespCount').textContent = c.noresp.length;
      $('noRespList').innerHTML = c.noresp.map(function (n) { return '<span class="chip">' + S.avatar(n, 'student', 'avatar-sm') + S.esc(n) + '</span>'; }).join('');
    }
  }

  /* 資料の削除は2回押し（1回目で「削除する」に変わり、もう一度押すと削除。3秒で元に戻る） */
  var matArmed = -1, matArmTimer = null;
  function renderMaterials() {
    $('matList').innerHTML = materials.length ? materials.map(function (m, i) {
      var armed = matArmed === i;
      return '<div class="mat-item' + (m.kind === 'IMG' ? ' is-img' : '') + '">' + S.icon(m.kind === 'IMG' ? 'image' : 'file-pdf', 16) +
        '<span class="name">' + S.esc(m.name) + '</span><span class="pages">' + m.pages + 'p</span>' +
        '<button type="button" class="mat-del' + (armed ? ' is-armed' : '') + '" data-mat-del="' + i + '" title="資料を削除" aria-label="' + S.esc(m.name) + ' を削除">' +
        (armed ? '削除する' : S.icon('x', 12)) + '</button></div>';
    }).join('') : '<p class="small muted" style="margin:0">資料はまだありません</p>';
  }

  function renderRight() {
    $('paneQa').hidden = ui.rtab !== 'qa';
    $('paneChat').hidden = ui.rtab !== 'chat';
    document.querySelectorAll('.tab[data-rtab]').forEach(function (t) { t.classList.toggle('is-on', t.dataset.rtab === ui.rtab); });
    ['qa', 'chat'].forEach(function (k) {
      var n = ui.unread[k];
      [$(k + 'Unread'), $(k + 'UnreadRail')].forEach(function (el) { el.hidden = n === 0; el.textContent = n; });
    });
    /* 挙手中 */
    var hands = students.filter(function (s) { return s.hand; });
    $('handCount').textContent = hands.length + '人';
    $('handChips').innerHTML = hands.length
      ? hands.map(function (s) { return '<button type="button" class="hand-chip" data-lower="' + S.esc(s.name) + '" title="押すと挙手を下ろす">' + S.avatar(s.name, 'student', 'avatar-sm') + S.esc(s.name) + S.icon('hand', 12) + '</button>'; }).join('')
      : '<span class="none">いま挙手している生徒はいません</span>';
    /* 質問一覧（匿名でも先生には投稿者名が薄く見える） */
    $('qaList').innerHTML = questions.map(function (q, i) {
      return '<div class="q"><div class="q-head">' + S.avatar(q.anon ? '' : q.name, q.anon ? 'anon' : 'student', 'avatar-sm') +
        '<span>' + S.esc(q.name) + (q.anon ? '<span class="real">（' + S.esc(q.real) + '）</span>' : '') + '</span>' +
        '<span class="time">' + q.time + '</span>' + (q.answered ? '<span class="tag tag-accent">回答済み</span>' : '') + '</div>' +
        '<div class="q-body">' + S.esc(q.body) + '</div>' +
        (q.answered ? '' : '<div class="q-actions"><button type="button" class="btn btn-ghost btn-sm" data-answer="' + i + '">' + S.icon('check', 14) + '回答済みにする</button></div>') +
        '</div>';
    }).join('');
    /* チャット */
    $('chatList').innerHTML = messages.map(function (m) {
      return '<div class="msg' + (m.role === 'teacher' ? ' is-teacher' : '') + '"><div class="msg-head">' + S.avatar(m.name, m.role, 'avatar-sm') +
        '<span class="name">' + S.esc(m.name) + '</span>' + S.roleTag(m.role) + '<span class="time">' + m.time + '</span></div>' +
        (m.body ? '<div class="msg-body">' + S.esc(m.body) + '</div>' : '') +
        (m.file ? '<div class="msg-file">' + S.icon(m.pdf ? 'file-pdf' : 'image', 16) + S.esc(m.file) + '</div>' : '') + '</div>';
    }).join('');
    var sc = $('chatList'); sc.scrollTop = sc.scrollHeight;
  }

  function renderAll() {
    renderHeader(); renderPreview(); renderAttendance(); renderUnderstand(); renderTiles(); renderCheck(); renderMaterials(); renderRight();
    $('dlgEnd').hidden = ctx.state !== 'dlg-end';
    S.renderIcons();
  }

  /* ---------- 状態切替バー ---------- */
  var checkTimer = null;
  function applyDemoState(c) {
    ctx = c;
    clearInterval(checkTimer);
    var st = c.state;
    if (st === 'before') { students = makeStudents('before'); ui.spot = null; ui.check.phase = 'idle'; }
    else if (st === 'lost') { students = makeStudents('lost'); setAway(); ui.spot = null; ui.check.phase = 'idle'; }
    else { students = makeStudents('live'); setAway(); ui.check.phase = 'idle'; ui.spot = null; }
    if (st === 'spotlight') ui.spot = '佐藤 みお';
    if (st === 'check-running') startCheck(37, 24);
    if (st === 'check-done') finishCheck(24);
    renderAll();
  }
  ctx = S.demoBar({
    states: [
      { key: 'live', label: '配信中（通常）' },
      { key: 'before', label: '配信前' },
      { key: 'spotlight', label: 'スポットライト中' },
      { key: 'lost', label: 'わからないが多い' },
      { key: 'check-running', label: '確認発動中' },
      { key: 'check-done', label: '確認終了' },
      { key: 'reconnect', label: '再接続中' },
      { key: 'dlg-end', label: '終了ダイアログ' }
    ],
    onChange: applyDemoState
  });

  /* ---------- タイマー（経過時間・最終リセット・一時退出の残り） ---------- */
  setInterval(function () {
    if (!isBefore() && ctx.state !== 'reconnect') { ui.elapsed++; ui.since++; }
    var changed = false;
    students.forEach(function (s) { if (s.away > 0) { s.away--; changed = true; } });
    $('elapsed').textContent = S.hhmmss(ui.elapsed);
    $('uSince').textContent = '最終リセットから ' + S.mmss(ui.since).replace(/^0/, '');
    if (changed) document.querySelectorAll('.tile.is-away').forEach(function (t) {
      var s = students.filter(function (x) { return x.name === t.dataset.name; })[0];
      if (s) t.querySelector('.tile-away').innerHTML = '一時退出中<br>残り ' + S.mmss(s.away);
    });
  }, 1000);

  /* ---------- 確認（60秒カウントダウン → 未応答者一覧） ---------- */
  function startCheck(sec, resp) {
    clearInterval(checkTimer);
    ui.check = { phase: 'running', sec: sec, resp: resp, noresp: [] };
    renderCheck();
    checkTimer = setInterval(function () {
      var c = ui.check;
      c.sec--;
      if (c.resp < TOTAL - 2 && Math.random() < 0.55) c.resp++;
      if (c.sec <= 0) { clearInterval(checkTimer); finishCheck(c.resp); }
      renderCheck(); S.renderIcons($('checkRunning'));
    }, 1000);
  }
  function finishCheck(resp) {
    var away = students.filter(function (s) { return s.away > 0; }).map(function (s) { return s.name; });
    var pool = students.filter(function (s) { return s.away === 0; }).map(function (s) { return s.name; }).reverse();
    var n = Math.max(0, TOTAL - resp - away.length);
    ui.check = { phase: 'done', sec: 0, resp: resp, noresp: away.concat(pool.slice(0, n)) };
    renderCheck(); S.renderIcons($('checkDone'));
  }
  $('btnCheck').addEventListener('click', function () { startCheck(60, 0); S.toast('全員に確認を送りました', 'bell'); });
  $('btnCheckAgain').addEventListener('click', function () { startCheck(60, 0); S.toast('全員に確認を送りました', 'bell'); });
  document.querySelectorAll('input[name="auto"]').forEach(function (r) {
    r.addEventListener('change', function () { ui.autoMin = +r.value; S.toast(ui.autoMin ? ui.autoMin + '分ごとに自動で確認を送ります' : '自動の確認をオフにしました', 'check-circle'); });
  });

  /* ---------- 配信の操作 ---------- */
  $('btnStart').addEventListener('click', function () { ui.elapsed = 0; ctx.set('state', 'live'); S.toast('配信を開始しました', 'broadcast'); });
  $('btnStop').addEventListener('click', function () { ctx.set('state', 'before'); S.toast('配信を停止しました', 'stop'); });
  $('btnMic').addEventListener('click', function () { ui.mic = !ui.mic; renderPreview(); S.renderIcons($('btnMic')); });
  document.querySelectorAll('input[name="src"]').forEach(function (r) {
    r.addEventListener('change', function () { ui.src = r.value; renderPreview(); S.renderIcons($('previewLive')); });
  });

  /* ---------- 理解度リセット ---------- */
  $('btnReset').addEventListener('click', function () {
    students.forEach(function (s) { s.r = null; });
    ui.since = 0;
    renderUnderstand(); renderTiles(); S.renderIcons($('tiles'));
    S.toast('理解度をリセットしました。生徒はまた押せます', 'reset');
  });

  /* ---------- スポットライト ---------- */
  $('tiles').addEventListener('click', function (e) {
    var b = e.target.closest('[data-spot]');
    if (!b) return;
    ui.spot = b.dataset.spot;
    if (ctx.state !== 'spotlight') { ctx.state = 'spotlight'; document.querySelectorAll('.state-bar [data-st]').forEach(function (x) { x.classList.toggle('is-on', x.dataset.st === 'spotlight'); }); }
    renderTiles(); S.renderIcons($('tiles')); S.renderIcons($('spotBanner'));
    S.toast(ui.spot + ' を全員の画面に表示しています', 'star');
  });
  $('btnUnspot').addEventListener('click', function () {
    ui.spot = null;
    ctx.state = 'live'; document.querySelectorAll('.state-bar [data-st]').forEach(function (x) { x.classList.toggle('is-on', x.dataset.st === 'live'); });
    renderTiles(); S.renderIcons($('tiles'));
    S.toast('スポットライトを解除しました', 'check-circle');
  });

  /* ---------- 質問箱／チャット ---------- */
  function setTab(k) { ui.rtab = k; ui.unread[k] = 0; renderRight(); S.renderIcons($('colRight')); }
  document.querySelectorAll('[data-rtab]').forEach(function (t) {
    t.addEventListener('click', function () { $('colRight').classList.remove('is-collapsed'); $('teach').classList.remove('is-collapsed'); setTab(t.dataset.rtab); });
  });
  $('btnCollapse').addEventListener('click', function () { $('colRight').classList.add('is-collapsed'); $('teach').classList.add('is-collapsed'); });
  $('btnExpand').addEventListener('click', function () { $('colRight').classList.remove('is-collapsed'); $('teach').classList.remove('is-collapsed'); });
  $('handChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lower]');
    if (!b) return;
    students.forEach(function (s) { if (s.name === b.dataset.lower) s.hand = false; });
    renderTiles(); renderRight(); S.renderIcons($('tiles')); S.renderIcons($('colRight'));
    S.toast(b.dataset.lower + ' の挙手を下ろしました', 'hand');
  });
  $('qaList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-answer]');
    if (!b) return;
    questions[+b.dataset.answer].answered = true;
    renderRight(); S.renderIcons($('colRight'));
  });
  function sendChat() {
    var v = $('chatDraft').value.trim();
    if (!v) return;
    messages.push({ name: ME.name, role: 'teacher', time: '今', body: v });
    $('chatDraft').value = '';
    renderRight(); S.renderIcons($('colRight'));
  }
  $('btnSend').addEventListener('click', sendChat);
  $('chatDraft').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendChat(); } });
  $('btnAttach').addEventListener('click', function () {
    messages.push({ name: ME.name, role: 'teacher', time: '今', body: '', file: 'board_03.png', img: true });
    renderRight(); S.renderIcons($('colRight'));
  });

  /* ---------- 資料 ---------- */
  $('btnUpload').addEventListener('click', function () {
    materials.push({ kind: 'PDF', name: '小テスト01.pdf', pages: 2 });
    renderMaterials(); S.toast('資料をアップロードしました', 'upload');
  });
  /* 資料を削除 → DELETE /api/files/:id（自分がアップした資料のみ。ファイル本体も消える） */
  $('matList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mat-del]');
    if (!b) return;
    var i = Number(b.dataset.matDel);
    clearTimeout(matArmTimer);
    if (matArmed === i) {
      var name = materials[i].name;
      materials.splice(i, 1); matArmed = -1;
      renderMaterials(); S.toast('「' + name + '」を削除しました', 'check');
    } else {
      matArmed = i; renderMaterials();
      matArmTimer = setTimeout(function () { matArmed = -1; renderMaterials(); }, 3000);
    }
  });

  /* ---------- 授業を終了 ---------- */
  $('btnEnd').addEventListener('click', function () { ctx.set('state', 'dlg-end'); });
  document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { ctx.set('state', 'live'); }); });
  $('dlgEnd').addEventListener('click', function (e) { if (e.target === this) ctx.set('state', 'live'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ctx.state === 'dlg-end') ctx.set('state', 'live'); });
  $('btnEndConfirm').addEventListener('click', function () {
    this.disabled = true; this.innerHTML = '<span class="spinner"></span>終了しています';
    setTimeout(function () { location.href = '../08_授業結果/index.html'; }, 700);
  });
})();
