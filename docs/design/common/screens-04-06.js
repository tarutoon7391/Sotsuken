/* ============================================================
   screens-04-06.js — 04 クラス一覧 / 05 クラス詳細 / 06 先生画面 の共通スクリプト
   ・Phosphor duotone 風アイコン（<i data-icon="plus"></i> → SVG）
   ・名前セット（丸アイコン＋名前＋ロールバッジ）
   ・トースト
   ・デモ用「状態」切替バー（状態／ロール／スマホ表示の切替）
   使い方：各画面の JS から window.S46.* を呼ぶ
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- アイコン（viewBox 0 0 256 256、Phosphor duotone 風） ---------- */
  var ST = 'fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"';
  var DUO = 'class="duo" fill="currentColor"';
  var ICONS = {
    plus: '<path ' + ST + ' d="M128 40v176M40 128h176"/>',
    copy: '<rect ' + DUO + ' x="88" y="88" width="128" height="128" rx="8"/><rect ' + ST + ' x="88" y="88" width="128" height="128" rx="8"/><path ' + ST + ' d="M168 88V40H40v128h48"/>',
    key: '<circle ' + DUO + ' cx="88" cy="168" r="48"/><circle ' + ST + ' cx="88" cy="168" r="48"/><path ' + ST + ' d="M122 134l94-94M192 64l24 24M168 88l24 24"/>',
    'sign-in': '<rect ' + DUO + ' x="136" y="24" width="80" height="208" rx="8"/><path ' + ST + ' d="M136 24h72a8 8 0 0 1 8 8v192a8 8 0 0 1-8 8h-72M24 128h112M96 88l40 40-40 40"/>',
    users: '<circle ' + DUO + ' cx="88" cy="108" r="40"/><circle ' + ST + ' cx="88" cy="108" r="40"/><path ' + ST + ' d="M16 208c8-40 40-60 72-60s64 20 72 60M176 68a32 32 0 1 1-8 63M184 148c34 0 52 24 56 52"/>',
    chalkboard: '<rect ' + DUO + ' x="24" y="48" width="208" height="144" rx="8"/><rect ' + ST + ' x="24" y="48" width="208" height="144" rx="8"/><path ' + ST + ' d="M80 216l16-24M176 216l-16-24M64 96h72M64 136h112"/>',
    'graduation-cap': '<path ' + DUO + ' d="M8 104l120-56 120 56-120 56z"/><path ' + ST + ' d="M8 104l120-56 120 56-120 56zM56 126v50s24 32 72 32 72-32 72-32v-50M248 104v56"/>',
    play: '<path ' + DUO + ' d="M72 40l144 88-144 88z"/><path ' + ST + ' d="M72 40l144 88-144 88z"/>',
    check: '<path ' + ST + ' d="M40 136l48 48 128-128"/>',
    'check-circle': '<circle ' + DUO + ' cx="128" cy="128" r="96"/><circle ' + ST + ' cx="128" cy="128" r="96"/><path ' + ST + ' d="M88 128l28 28 52-52"/>',
    x: '<path ' + ST + ' d="M56 56l144 144M200 56L56 200"/>',
    upload: '<path ' + DUO + ' d="M40 160h176v48H40z"/><path ' + ST + ' d="M80 96l48-48 48 48M128 48v128M216 160v48H40v-48"/>',
    camera: '<rect ' + DUO + ' x="24" y="64" width="160" height="128" rx="12"/><rect ' + ST + ' x="24" y="64" width="160" height="128" rx="12"/><path ' + ST + ' d="M184 112l48-24v80l-48-24"/>',
    mic: '<rect ' + DUO + ' x="96" y="24" width="64" height="120" rx="32"/><rect ' + ST + ' x="96" y="24" width="64" height="120" rx="32"/><path ' + ST + ' d="M56 120a72 72 0 0 0 144 0M128 192v40"/>',
    'mic-slash': '<rect ' + DUO + ' x="96" y="24" width="64" height="120" rx="32"/><rect ' + ST + ' x="96" y="24" width="64" height="120" rx="32"/><path ' + ST + ' d="M56 120a72 72 0 0 0 144 0M128 192v40M48 40l160 176"/>',
    monitor: '<rect ' + DUO + ' x="24" y="48" width="208" height="136" rx="12"/><rect ' + ST + ' x="24" y="48" width="208" height="136" rx="12"/><path ' + ST + ' d="M96 224h64M128 184v40"/>',
    hand: '<path fill="currentColor" d="M188 48a27.8 27.8 0 0 0-12 2.7V44a28 28 0 0 0-54.6-8.6A28 28 0 0 0 80 60v52.3l-8.1-11.6a28 28 0 0 0-49.4 26.4l38.1 68.4A88 88 0 0 0 216 156v-80a28 28 0 0 0-28-28z"/>',
    star: '<path ' + DUO + ' d="M128 24l30 62 68 10-49 48 12 68-61-32-61 32 12-68-49-48 68-10z"/><path ' + ST + ' d="M128 24l30 62 68 10-49 48 12 68-61-32-61 32 12-68-49-48 68-10z"/>',
    question: '<circle ' + DUO + ' cx="128" cy="128" r="96"/><circle ' + ST + ' cx="128" cy="128" r="96"/><path ' + ST + ' d="M96 100a32 32 0 1 1 44 30c-8 4-12 10-12 18v4"/><circle fill="currentColor" cx="128" cy="184" r="10"/>',
    chat: '<path ' + DUO + ' d="M32 48h192v128h-96l-48 40v-40H32z"/><path ' + ST + ' d="M32 48h192v128h-96l-48 40v-40H32z"/>',
    warning: '<path ' + DUO + ' d="M128 32l104 176H24z"/><path ' + ST + ' d="M128 32l104 176H24z"/><path ' + ST + ' d="M128 104v48"/><circle fill="currentColor" cx="128" cy="180" r="10"/>',
    'arrow-left': '<path ' + ST + ' d="M216 128H40M104 64l-64 64 64 64"/>',
    'arrow-right': '<path ' + ST + ' d="M40 128h176M152 64l64 64-64 64"/>',
    'file-pdf': '<path ' + DUO + ' d="M56 24h96l48 48v160H56z"/><path ' + ST + ' d="M56 24h96l48 48v160H56zM152 24v48h48"/>',
    image: '<rect ' + DUO + ' x="32" y="48" width="192" height="160" rx="8"/><rect ' + ST + ' x="32" y="48" width="192" height="160" rx="8"/><path ' + ST + ' d="M32 176l56-56 40 40 32-32 64 48"/><circle fill="currentColor" cx="168" cy="96" r="14"/>',
    clock: '<circle ' + DUO + ' cx="128" cy="128" r="96"/><circle ' + ST + ' cx="128" cy="128" r="96"/><path ' + ST + ' d="M128 72v56l40 24"/>',
    'sign-out': '<rect ' + DUO + ' x="48" y="32" width="64" height="192"/><path ' + ST + ' d="M112 224H48V32h64M224 128h-112M176 80l48 48-48 48"/>',
    'caret-left': '<path ' + ST + ' d="M160 48l-80 80 80 80"/>',
    'caret-right': '<path ' + ST + ' d="M96 48l80 80-80 80"/>',
    'caret-down': '<path ' + ST + ' d="M48 96l80 80 80-80"/>',
    'caret-up': '<path ' + ST + ' d="M48 160l80-80 80 80"/>',
    'arrows-in': '<path ' + ST + ' d="M24 128h96M80 88l40 40-40 40M232 128h-96M176 88l-40 40 40 40"/>',
    'arrows-out': '<path ' + ST + ' d="M120 128H24M64 88l-40 40 40 40M136 128h96M192 88l40 40-40 40"/>',
    paperclip: '<path fill="currentColor" d="M209.7 122.3l-82.4 82.4a56 56 0 0 1-79.2-79.2l99.3-99.3a40 40 0 0 1 56.6 56.6l-99.3 99.3a24 24 0 0 1-33.9-33.9l82.4-82.4 11.3 11.3-82.4 82.4a8 8 0 0 0 11.3 11.3l99.3-99.3a24 24 0 0 0-33.9-33.9L59.4 136.8a40 40 0 0 0 56.6 56.6l82.4-82.4z"/>',
    reset: '<path ' + ST + ' d="M40 128a88 88 0 1 0 26-62M40 56v56h56"/>',
    bell: '<path ' + DUO + ' d="M56 104a72 72 0 0 1 144 0v56l24 24H32l24-24z"/><path ' + ST + ' d="M56 104a72 72 0 0 1 144 0v56l24 24H32l24-24zM104 224a24 24 0 0 0 48 0"/>',
    'door-open': '<rect ' + DUO + ' x="56" y="40" width="96" height="176"/><path ' + ST + ' d="M40 216h176M56 216V40h96v176M152 216V72l48-16v160"/><circle fill="currentColor" cx="128" cy="136" r="10"/>',
    'wifi-slash': '<path ' + ST + ' d="M92 164a52 52 0 0 1 72 0M60 132a96 96 0 0 1 136 0M28 100a140 140 0 0 1 200 0M40 40l176 176"/><circle fill="currentColor" cx="128" cy="200" r="12"/>',
    eye: '<path ' + DUO + ' d="M16 128s40-72 112-72 112 72 112 72-40 72-112 72S16 128 16 128z"/><path ' + ST + ' d="M16 128s40-72 112-72 112 72 112 72-40 72-112 72S16 128 16 128z"/><circle ' + ST + ' cx="128" cy="128" r="36"/>',
    calendar: '<rect ' + DUO + ' x="40" y="48" width="176" height="168" rx="8"/><rect ' + ST + ' x="40" y="48" width="176" height="168" rx="8"/><path ' + ST + ' d="M40 96h176M88 24v40M168 24v40"/>',
    'list-checks': '<path ' + ST + ' d="M128 80h96M128 176h96M32 80l16 16 32-32M32 176l16 16 32-32"/>',
    'chart-bar': '<path ' + DUO + ' d="M48 120h40v88H48zM108 64h40v144h-40zM168 96h40v112h-40z"/><path ' + ST + ' d="M48 120h40v88H48zM108 64h40v144h-40zM168 96h40v112h-40zM24 208h208"/>',
    'stop': '<rect ' + DUO + ' x="56" y="56" width="144" height="144" rx="12"/><rect ' + ST + ' x="56" y="56" width="144" height="144" rx="12"/>',
    'broadcast': '<circle ' + DUO + ' cx="128" cy="128" r="28"/><circle ' + ST + ' cx="128" cy="128" r="28"/><path ' + ST + ' d="M80 176a68 68 0 0 1 0-96M176 80a68 68 0 0 1 0 96M48 208a112 112 0 0 1 0-160M208 48a112 112 0 0 1 0 160"/>',
    'dots-three': '<circle fill="currentColor" cx="64" cy="128" r="14"/><circle fill="currentColor" cx="128" cy="128" r="14"/><circle fill="currentColor" cx="192" cy="128" r="14"/>'
  };

  function icon(name, size) {
    var s = size || 18;
    return '<svg class="ph" width="' + s + '" height="' + s + '" viewBox="0 0 256 256" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  }
  function renderIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      el.innerHTML = icon(el.dataset.icon, el.dataset.size);
      el.style.display = 'inline-flex';
      el.style.flex = 'none';
    });
  }

  /* ---------- 文字列 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 名前セット ---------- */
  var ROLE_LABEL = { teacher: '先生', student: '生徒', anon: '？' };
  function avatar(name, role, sizeClass) {
    var ch = role === 'anon' ? '？' : String(name || '').trim().charAt(0);
    return '<span class="avatar avatar-' + (role || 'student') + (sizeClass ? ' ' + sizeClass : '') + '">' + esc(ch) + '</span>';
  }
  function roleTag(role) {
    if (role === 'anon') return '';
    return '<span class="tag ' + (role === 'teacher' ? 'tag-accent' : 'tag-neutral') + '">' + ROLE_LABEL[role] + '</span>';
  }
  function person(name, role, opts) {
    opts = opts || {};
    return '<span class="person">' + avatar(name, role, opts.size) +
      '<span class="person-name">' + esc(name) + '</span>' +
      (opts.noTag ? '' : roleTag(role)) + '</span>';
  }

  /* ---------- トースト ---------- */
  var toastTimer = null;
  function toast(text, iconName) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = (iconName ? icon(iconName, 16) : '') + esc(text);
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 2600);
  }

  /* ---------- デモ用「状態」切替バー ----------
     demoBar({
       states: [{ key, label }],        // 必須：画面の状態
       roles:  [{ key, label }] | null,  // 任意：先生／生徒の切替
       device: true | false,             // 任意：スマホ表示／PC表示の切替
       onChange: function (ctx) {}       // 状態が変わるたびに呼ばれる
     })
     ctx = { state, role, mobile, set(key, value) }
     HTML 側は data-show="state1 state2" / data-role="teacher" で出し分けもできる
  */
  function demoBar(opts) {
    var params = new URLSearchParams(location.search);
    var ctx = {
      state: params.get('state') || opts.states[0].key,
      role: opts.roles ? (params.get('role') || opts.roles[0].key) : null,
      forced: params.get('mobile') === '1' ? true : null,
      mobile: false,
      set: function (k, v) { ctx[k] = v; apply(); }
    };
    if (!opts.states.some(function (s) { return s.key === ctx.state; })) ctx.state = opts.states[0].key;

    var bar = document.createElement('div');
    bar.className = 'state-bar';
    var html = '<span class="state-bar-label">状態</span>';
    opts.states.forEach(function (s) { html += '<button type="button" data-st="' + s.key + '">' + esc(s.label) + '</button>'; });
    if (opts.roles) {
      html += '<span class="state-bar-sep"></span>';
      opts.roles.forEach(function (r) { html += '<button type="button" data-rl="' + r.key + '">' + esc(r.label) + '</button>'; });
    }
    if (opts.device) {
      html += '<span class="state-bar-sep"></span><button type="button" data-dev>スマホ表示</button>';
    }
    bar.innerHTML = html;
    document.body.appendChild(bar);

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.st) ctx.set('state', b.dataset.st);
      else if (b.dataset.rl) ctx.set('role', b.dataset.rl);
      else if (b.hasAttribute('data-dev')) { ctx.forced = !ctx.mobile; apply(); }
    });
    window.addEventListener('resize', function () { if (ctx.forced === null) apply(); });

    function apply() {
      ctx.mobile = opts.device ? (ctx.forced === null ? window.innerWidth < 700 : ctx.forced) : false;
      document.body.classList.toggle('is-mobile', ctx.mobile);
      document.body.dataset.state = ctx.state;
      if (ctx.role) document.body.dataset.role = ctx.role;
      bar.querySelectorAll('[data-st]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.st === ctx.state); });
      bar.querySelectorAll('[data-rl]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.rl === ctx.role); });
      var dev = bar.querySelector('[data-dev]');
      if (dev) { dev.textContent = ctx.mobile ? 'PC表示へ' : 'スマホ表示'; dev.classList.toggle('is-on', ctx.mobile); }
      document.querySelectorAll('[data-show]').forEach(function (el) {
        el.hidden = el.dataset.show.split(/\s+/).indexOf(ctx.state) === -1;
      });
      if (ctx.role) document.querySelectorAll('[data-role]').forEach(function (el) {
        el.hidden = el.dataset.role.split(/\s+/).indexOf(ctx.role) === -1;
      });
      if (opts.onChange) opts.onChange(ctx);
    }
    apply();
    return ctx;
  }

  /* ---------- 秒 → mm:ss ---------- */
  function mmss(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function hhmmss(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    return (h < 10 ? '0' : '') + h + ':' + mmss(sec % 3600);
  }

  /* ---------- モック：生徒 30 人（全画面共通） ---------- */
  var STUDENTS = ['田中 ひなた', '佐藤 みお', '山田 そら', '高橋 れん', '伊藤 ゆい', '渡辺 あおい', '中村 はると', '小林 りこ', '加藤 ゆうと', '吉田 さくら',
    '山本 みなと', '松本 ひまり', '井上 そうた', '木村 いちか', '林 りく', '斎藤 えま', '清水 あさひ', '山口 つむぎ', '森 かいと', '池田 あかり',
    '橋本 ゆいと', '阿部 めい', '石川 はやと', '前田 ことは', '藤田 りん', '岡田 あおと', '後藤 ひな', '長谷川 しゅん', '村上 のあ', '近藤 ゆうき'];

  global.S46 = { STUDENTS: STUDENTS, TEACHER: '鈴木先生', icon: icon, renderIcons: renderIcons, esc: esc, avatar: avatar, roleTag: roleTag, person: person, toast: toast, demoBar: demoBar, mmss: mmss, hhmmss: hhmmss };
})(window);
