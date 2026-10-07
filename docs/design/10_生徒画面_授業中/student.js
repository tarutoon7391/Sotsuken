// 10 生徒画面（授業中）v2 — デザイン確認用の動き
// 状態を1か所（state）に持ち、render() で PC・スマホ両方の表示を更新する。
(function () {
  'use strict';

  // ---------- モックデータ ----------
  var MATERIALS = [
    { kind: 'PDF', name: '第3章 二次関数.pdf', pages: 12 },
    { kind: 'PDF', name: '練習問題02.pdf', pages: 3 },
    { kind: 'IMG', name: '板書_平行移動.png', pages: 1 }
  ];
  var TEACHER   = { initial: '鈴', caption: '鈴木先生（画面共有）', short: '先生' };
  var PRESENTER = { initial: '佐', caption: '佐藤 みお（カメラ）', short: '佐藤' };

  var state = {
    mode: 'normal',          // normal | spotlight | reconnect
    forceMobile: null,       // null=画面幅で自動 / true / false
    vw: window.innerWidth,
    hand: false, reaction: null, feedback: '',
    swap: false, cam: false,
    tab: 'qa', mTab: 'material',
    unread: { qa: 0, chat: 2 },
    matIdx: 0, page: 1, cols: 1,
    weights: { video: 3, material: 1.5, chat: 1.3 }, dragging: false,
    zoomPage: null,
    leaveOpen: false, checkOpen: false, checkSec: 60,
    toast: null,
    questions: [
      { name: '匿名', initial: '？', anon: true, time: '10:12', answered: true, body: '平行移動で符号が逆になる理由がよくわかりません' },
      { name: '山田 そら', initial: '山', time: '10:18', answered: false, body: '頂点の座標は式のどこを見ればいいですか？' }
    ],
    messages: [
      { name: '鈴木先生', initial: '鈴', role: '先生', time: '10:05', body: '今日は p.24 から始めます。資料を開いておいてください。' },
      { name: '佐藤 みお', initial: '佐', role: '生徒', time: '10:09', body: 'ノート撮ったので共有します', file: 'note_0912.jpg', thumb: 'assets/page-1.png' },
      { name: '鈴木先生', initial: '鈴', role: '先生', time: '10:20', body: '練習問題はこのPDFです', file: 'practice_02.pdf', pdf: true }
    ]
  };

  var root = document.getElementById('lesson');
  var $  = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var timers = {};

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function avatarClass(name) {
    if (name === '匿名' || name === '？' || name.indexOf('匿名') === 0) return 'avatar-anon';
    return name.indexOf('先生') >= 0 ? 'avatar-teacher' : 'avatar-student';
  }
  function isMobile() {
    if (state.forceMobile !== null) return state.forceMobile;
    return state.vw < 700;
  }
  function set(patch) { Object.assign(state, patch); render(); }

  // ---------- 動き ----------
  function react(type, label) {
    clearTimeout(timers.flash);
    set({ reaction: type, feedback: '「' + label + '」を送りました' });
    timers.flash = setTimeout(function () { set({ reaction: null, feedback: '' }); }, 1400);
  }
  function toast(text, kind) {
    clearTimeout(timers.toast);
    set({ toast: { text: text, kind: kind } });
    timers.toast = setTimeout(function () { set({ toast: null }); }, 4000);
  }
  function startCheck() {
    clearInterval(timers.check);
    set({ checkOpen: true, checkSec: 60 });
    timers.check = setInterval(function () {
      if (state.checkSec <= 1) {
        clearInterval(timers.check);
        set({ checkOpen: false, checkSec: 0 });
        toast('確認に応答できませんでした', 'miss');
      } else {
        set({ checkSec: state.checkSec - 1 });
      }
    }, 1000);
  }
  function pageCount() { return MATERIALS[state.matIdx].pages; }
  function visibleCols() { return isMobile() ? 1 : state.cols; }
  function prevPage() { set({ page: Math.max(1, state.page - visibleCols()) }); }
  function nextPage() { if (state.page + visibleCols() <= pageCount()) set({ page: state.page + visibleCols() }); }
  function selectMaterial(i) {
    var m = MATERIALS[i];
    set({ matIdx: i, page: 1, cols: Math.min(state.cols, m.pages >= 4 ? 4 : m.pages >= 2 ? 2 : 1) });
  }
  function setCols(n) {
    set({ cols: n, page: Math.max(1, Math.min(state.page, pageCount() - n + 1)) });
  }
  function postQuestion(src) {
    var ta = $('[data-qa-draft]', src);
    var anon = $('[data-anon]', src).checked;
    var text = ta.value.trim();
    if (!text) return;
    state.questions.push({ name: anon ? '匿名（自分）' : '田中 ひなた', initial: anon ? '？' : '田', time: '今', answered: false, body: text });
    $$('[data-qa-draft]').forEach(function (el) { el.value = ''; });
    render();
  }
  function sendChat(src) {
    var input = $('[data-chat-draft]', src);
    var text = input.value.trim();
    if (!text) return;
    state.messages.push({ name: '田中 ひなた', initial: '田', role: '生徒', time: '今', body: text });
    $$('[data-chat-draft]').forEach(function (el) { el.value = ''; });
    render();
  }
  function attach() {
    state.messages.push({ name: '田中 ひなた', initial: '田', role: '生徒', time: '今', body: '', file: 'screenshot.png', thumb: 'assets/page-2.png' });
    render();
  }

  // ---------- 列幅ドラッグ（PC） ----------
  function startDrag(pos, e) {
    e.preventDefault();
    var main = $('[data-main]');
    var order = ['video', 'material', 'chat'], a = order[pos], b = order[pos + 1];
    var w0 = Object.assign({}, state.weights);
    var total = w0.video + w0.material + w0.chat;
    var pxPerFr = (main.clientWidth - 48 - 40) / total;
    var x0 = e.clientX;
    set({ dragging: true });
    function onMove(ev) {
      var d = (ev.clientX - x0) / pxPerFr, sum = w0[a] + w0[b];
      var na = Math.min(sum - 0.6, Math.max(0.6, w0[a] + d));
      var w = Object.assign({}, w0); w[a] = na; w[b] = sum - na;
      set({ weights: w });
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      set({ dragging: false });
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // ---------- 描画 ----------
  function videoHtml() {
    var spot = state.mode === 'spotlight';
    var main = spot ? (state.swap ? TEACHER : PRESENTER) : TEACHER;
    var pip  = state.swap ? PRESENTER : TEACHER;
    var h = '';
    h += '<div class="video-bg"></div>';
    h += '<div class="video-who"><div class="video-face">' + main.initial + '</div>' + esc(main.caption) + '</div>';
    if (state.mode === 'reconnect') {
      h += '<div class="video-reconnect"><div><div class="spinner-dark"></div>再接続中…映像は自動で復帰します</div></div>';
    }
    h += '<div class="video-labels">';
    h += spot ? '<span class="video-label is-spot">佐藤 みおさんが発表中</span>' : '<span class="video-label">先生の画面</span>';
    h += '</div>';
    if (state.toast) {
      h += '<div class="video-toast' + (state.toast.kind === 'miss' ? ' is-miss' : '') + '">' + esc(state.toast.text) + '</div>';
    }
    if (spot) {
      h += '<button type="button" class="video-pip" data-action="swapPip" aria-label="映像を入れ替える">' +
           '<div class="pip-face">' + pip.initial + '</div><span class="pip-label">' + esc(pip.caption) + '</span></button>';
    }
    h += '<div class="video-foot">' +
         '<button type="button" class="btn-cam' + (state.cam ? ' is-on' : '') + '" data-action="toggleCam" title="ONにしても映像は先生にだけ届きます">' +
         '<svg><use href="#i-cam"/></svg>' + (state.cam ? 'カメラ ON' : 'カメラ OFF') + '</button>' +
         '<span class="video-note">ONにしても映像は先生にだけ届きます</span></div>';
    return h;
  }
  function pagesHtml(mobile) {
    var N = mobile ? 1 : state.cols;
    var last = Math.min(pageCount(), state.page + N - 1);
    var h = '';
    for (var p = state.page; p <= last; p++) {
      h += '<button type="button" class="page" data-zoom-page="' + p + '" aria-label="p.' + p + ' を拡大">' +
           '<span class="page-spin"><span></span></span>' +
           '<img src="assets/page-' + p + '.png" alt="p.' + p + '" onload="this.parentNode.classList.add(\'is-loaded\')">' +
           (mobile ? '' : '<span class="page-label">p.' + p + '</span>') +
           '</button>';
    }
    return h;
  }
  function postHtml(q) {
    return '<div class="post">' +
      '<div class="post-head"><span class="avatar-sm ' + avatarClass(q.name) + '">' + q.initial + '</span>' +
      '<span>' + esc(q.name) + '</span><span class="time">' + esc(q.time) + '</span>' +
      (q.answered ? '<span class="tag tag-accent">回答済み</span>' : '') + '</div>' +
      '<div class="post-body">' + esc(q.body) + '</div></div>';
  }
  function messageHtml(m) {
    var t = m.role === '先生';
    var h = '<div class="post' + (t ? ' is-teacher' : '') + '">' +
      '<div class="post-head"><span class="avatar-sm ' + avatarClass(m.name) + '">' + m.initial + '</span>' +
      '<span class="who">' + esc(m.name) + '</span>' +
      '<span class="tag ' + (t ? 'tag-accent' : 'tag-neutral') + '">' + m.role + '</span>' +
      '<span class="time">' + esc(m.time) + '</span></div>';
    if (m.body) h += '<div class="post-body">' + esc(m.body) + '</div>';
    if (m.thumb) h += '<img class="post-thumb" src="' + m.thumb + '" alt="' + esc(m.file) + '">';
    if (m.pdf)   h += '<div class="post-file"><svg><use href="#i-pdf"/></svg>' + esc(m.file) + '</div>';
    return h + '</div>';
  }

  function render() {
    var mobile = isMobile();
    var framed = mobile && state.vw >= 700;
    root.classList.toggle('is-mobile', mobile);
    root.classList.toggle('is-framed', framed);
    root.classList.toggle('is-dragging', state.dragging);
    document.body.classList.toggle('is-framed', framed);

    // PC 列幅
    var w = state.weights;
    $('[data-main]').style.gridTemplateColumns =
      'minmax(320px,' + w.video + 'fr) 20px minmax(220px,' + w.material + 'fr) 20px minmax(260px,' + w.chat + 'fr)';

    // 映像
    $$('[data-video]').forEach(function (el) { el.innerHTML = videoHtml(); });

    // リアクション・挙手
    $$('[data-react]').forEach(function (b) {
      var on = b.dataset.react === state.reaction;
      b.classList.toggle('is-active', on);
      if (on && !b.classList.contains('is-flash')) {
        b.classList.add('is-flash');
        setTimeout(function () { b.classList.remove('is-flash'); }, 300);
      }
    });
    $$('[data-hand]').forEach(function (b) { b.classList.toggle('is-on', state.hand); });
    $$('[data-hand-label]').forEach(function (el) { el.textContent = state.hand ? '挙手中' : '質問する'; });
    $$('[data-hand-help]').forEach(function (el) { el.textContent = state.hand ? '先生に伝わっています' : '先生に手を挙げる'; });
    var fb = state.feedback || (state.hand ? '挙手中です。もう一度押すと取り下げます' : '');
    $$('[data-feedback]').forEach(function (el) { el.textContent = fb; });

    // 資料
    var mat = MATERIALS[state.matIdx];
    $('[data-mat-list]').innerHTML = MATERIALS.map(function (m, i) {
      return '<button type="button" class="mat' + (i === state.matIdx ? ' is-active' : '') + '" data-mat="' + i + '">' +
        '<span class="mat-kind' + (m.kind === 'IMG' ? ' is-img' : '') + '">' + m.kind + '</span>' +
        '<span class="mat-name">' + esc(m.name) + '</span><span class="mat-pages">' + m.pages + 'p</span></button>';
    }).join('');
    $('[data-mat-chips]').innerHTML = MATERIALS.map(function (m, i) {
      return '<button type="button" class="chip' + (i === state.matIdx ? ' is-active' : '') + '" data-mat="' + i + '">' +
        '<span class="mat-kind' + (m.kind === 'IMG' ? ' is-img' : '') + '">' + m.kind + '</span>' + esc(m.name) + '</button>';
    }).join('');
    var pcPages = $('.layout-pc [data-pages]');
    pcPages.innerHTML = pagesHtml(false);
    pcPages.style.gridTemplateColumns = 'repeat(' + (state.cols === 1 ? 1 : 2) + ',minmax(0,1fr))';
    $('.layout-mobile [data-pages]').innerHTML = pagesHtml(true);
    var N = visibleCols(), last = Math.min(mat.pages, state.page + N - 1);
    var range = (last > state.page ? state.page + '–' + last : String(state.page)) + ' / ' + mat.pages;
    $$('[data-range]').forEach(function (el) { el.textContent = range; });
    $$('[data-cols]').forEach(function (b) {
      var n = Number(b.dataset.cols);
      b.disabled = mat.pages < n;
      b.classList.toggle('is-active', state.cols === n);
    });

    // タブ・未読
    $$('[data-tab]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === state.tab); });
    $$('.layout-pc [data-panel]').forEach(function (el) { el.hidden = el.dataset.panel !== state.tab; });
    $$('[data-mtab]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.mtab === state.mTab); });
    $$('[data-mpanel]').forEach(function (el) { el.hidden = el.dataset.mpanel !== state.mTab; });
    $$('[data-unread]').forEach(function (el) {
      var n = state.unread[el.dataset.unread];
      el.textContent = n > 0 ? n : '';
    });

    // 質問箱・チャット
    var qaHtml = state.questions.map(postHtml).join('');
    var chatHtml = state.messages.map(messageHtml).join('');
    $$('[data-qa-list]').forEach(function (el) { el.innerHTML = qaHtml; el.scrollTop = el.scrollHeight; });
    $$('[data-chat-list]').forEach(function (el) { el.innerHTML = chatHtml; el.scrollTop = el.scrollHeight; });

    // 拡大
    var z = state.zoomPage;
    var zoom = $('[data-zoom]');
    zoom.hidden = !z;
    if (z) {
      $('[data-zoom-name]').textContent = mat.name;
      $('[data-zoom-pos]').textContent = 'p.' + z + ' / ' + mat.pages;
      var img = $('[data-zoom-img]');
      var src = 'assets/page-' + z + '.png';
      if (img.getAttribute('src') !== src) img.src = src;
      img.alt = 'p.' + z;
      $('[data-action="zoomPrev"]').disabled = z <= 1;
      $('[data-action="zoomNext"]').disabled = z >= mat.pages;
    }

    // ダイアログ
    $('[data-leave]').hidden = !state.leaveOpen;
    $('[data-check]').hidden = !state.checkOpen;
    var sec = $('[data-check-sec]');
    sec.textContent = state.checkSec;
    sec.classList.toggle('is-low', state.checkSec <= 10);

    // 状態バー
    $$('[data-mode]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.mode === state.mode); });
    var mb = $('[data-mobile-btn]');
    mb.textContent = mobile ? 'PC表示へ' : 'スマホ表示';
    mb.classList.toggle('is-active', mobile);
  }

  // ---------- イベント（委譲） ----------
  var actions = {
    openLeave:   function () { set({ leaveOpen: true }); },
    closeLeave:  function () { set({ leaveOpen: false }); },
    confirmLeave: function () { set({ leaveOpen: false, feedback: '→ 12 一時退出中 画面へ遷移（別画面）' }); },
    startCheck:  startCheck,
    ackCheck:    function () { clearInterval(timers.check); set({ checkOpen: false }); toast('確認しました', 'ok'); },
    toggleCam:   function () { set({ cam: !state.cam }); },
    swapPip:     function () { set({ swap: !state.swap }); },
    prevPage:    prevPage,
    nextPage:    nextPage,
    closeZoom:   function () { set({ zoomPage: null }); },
    zoomPrev:    function () { if (state.zoomPage > 1) set({ zoomPage: state.zoomPage - 1 }); },
    zoomNext:    function () { if (state.zoomPage < pageCount()) set({ zoomPage: state.zoomPage + 1 }); },
    postQuestion: function (btn) { postQuestion(btn.closest('.compose').parentNode); },
    sendChat:    function (btn) { sendChat(btn.closest('.chat-row').parentNode); },
    attach:      attach,
    toggleMobile: function () { set({ forceMobile: !isMobile() }); }
  };

  document.addEventListener('click', function (e) {
    var t = e.target;
    var el;
    if ((el = t.closest('[data-action]'))) {
      e.stopPropagation();
      var fn = actions[el.dataset.action];
      if (fn) fn(el);
      return;
    }
    if ((el = t.closest('[data-react]'))) {
      var labels = { got: 'わかった', lost: 'わからない', again: 'もう一度' };
      react(el.dataset.react, labels[el.dataset.react]);
      return;
    }
    if (t.closest('[data-hand]')) {
      set({ hand: !state.hand, feedback: state.hand ? '挙手を取り下げました' : '' });
      return;
    }
    if ((el = t.closest('[data-mat]')))   { selectMaterial(Number(el.dataset.mat)); return; }
    if ((el = t.closest('[data-cols]')))  { if (!el.disabled) setCols(Number(el.dataset.cols)); return; }
    if ((el = t.closest('[data-tab]')))   { var u = Object.assign({}, state.unread); u[el.dataset.tab] = 0; set({ tab: el.dataset.tab, unread: u }); return; }
    if ((el = t.closest('[data-mtab]')))  { var u2 = Object.assign({}, state.unread); if (u2[el.dataset.mtab] !== undefined) u2[el.dataset.mtab] = 0; set({ mTab: el.dataset.mtab, unread: u2 }); return; }
    if ((el = t.closest('[data-zoom-page]'))) { set({ zoomPage: Number(el.dataset.zoomPage) }); return; }
    if ((el = t.closest('[data-mode]')))  { set({ mode: el.dataset.mode, swap: false }); return; }
    if (t.closest('[data-stop]')) { return; }                       // 拡大画像の上はそのまま
    if (t.closest('[data-zoom]')) { set({ zoomPage: null }); return; } // 背景クリックで閉じる
  });

  // Enter で送信（チャット）
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && e.target.matches('[data-chat-draft]')) {
      e.preventDefault();
      sendChat(e.target.closest('.chat-row').parentNode);
    }
    if (e.key === 'Escape') {
      if (state.zoomPage) set({ zoomPage: null });
      else if (state.leaveOpen) set({ leaveOpen: false });
    }
  });

  // 列幅ドラッグ
  $$('[data-drag]').forEach(function (g) {
    g.addEventListener('pointerdown', function (e) { startDrag(Number(g.dataset.drag), e); });
  });

  // スマホ：資料のスワイプでページ送り
  var swipeX = 0;
  var swipeEl = $('[data-swipe]');
  swipeEl.addEventListener('touchstart', function (e) { swipeX = e.changedTouches[0].clientX; }, { passive: true });
  swipeEl.addEventListener('touchend', function (e) {
    var d = e.changedTouches[0].clientX - swipeX;
    if (d < -50) nextPage(); else if (d > 50) prevPage();
  });

  // 画面幅
  window.addEventListener('resize', function () { set({ vw: window.innerWidth }); });

  // URL の ?state=spotlight&mobile=1 でも指定できる（共有・確認用）
  var params = new URLSearchParams(location.search);
  var initMode = params.get('state');
  if (initMode === 'spotlight' || initMode === 'reconnect') state.mode = initMode;
  if (params.get('mobile') === '1') state.forceMobile = true;

  render();
})();
