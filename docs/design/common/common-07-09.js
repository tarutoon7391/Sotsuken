/* ==========================================================================
   common-07-09.js — 07 出席一覧／08 授業結果／09 授業待機 のデモ用共通処理
   ・状態切替バー（画面下の暗いバー）を組み立てる
   ・スマホ表示／PC表示の切替
   ・簡単なユーティリティ（エスケープ・トースト・時刻表示・名前セット）
   ========================================================================== */
(function (global) {
  'use strict';

  /** HTML に埋め込む文字列は必ずエスケープする（チャット・メモ・名前など） */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  /** 画面上部に短いメッセージを出す */
  function toast(message, ms) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, ms || 2200);
  }

  /**
   * 状態切替バーを作る
   * @param {Object} opts
   * @param {Array<{key:string,label:string}>} opts.states  状態の一覧
   * @param {string} opts.initial   最初に選ぶ状態の key
   * @param {(key:string)=>void} opts.onChange  状態が変わったときに呼ぶ
   * @param {boolean} [opts.mobileToggle]  「スマホ表示／PC表示」ボタンを付けるか
   * @param {(isMobile:boolean)=>void} [opts.onLayout]  表示切替時に呼ぶ
   */
  function stateBar(opts) {
    const bar = document.createElement('div');
    bar.className = 'state-bar';
    bar.setAttribute('aria-label', 'デザイン確認用の状態切替');

    const label = document.createElement('span');
    label.className = 'state-bar-label';
    label.textContent = '状態';
    bar.appendChild(label);

    const buttons = new Map();
    let current = opts.initial;

    function select(key) {
      current = key;
      buttons.forEach(function (btn, k) { btn.classList.toggle('is-on', k === key); });
      opts.onChange(key);
    }

    opts.states.forEach(function (s) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = s.label;
      btn.addEventListener('click', function () { select(s.key); });
      buttons.set(s.key, btn);
      bar.appendChild(btn);
    });

    if (opts.mobileToggle) {
      const sep = document.createElement('span');
      sep.className = 'state-bar-sep';
      bar.appendChild(sep);

      const mob = document.createElement('button');
      mob.type = 'button';
      const sync = function () {
        const on = document.body.classList.contains('is-mobile');
        mob.textContent = on ? 'PC表示へ' : 'スマホ表示';
        mob.classList.toggle('is-on', on);
      };
      mob.addEventListener('click', function () {
        document.body.classList.toggle('is-mobile');
        sync();
        if (typeof opts.onLayout === 'function') opts.onLayout(document.body.classList.contains('is-mobile'));
      });
      // 幅が狭い端末で開いたら最初からスマホ表示にする
      if (window.innerWidth < 640) document.body.classList.add('is-mobile');
      sync();
      bar.appendChild(mob);
    }

    document.body.appendChild(bar);
    select(current);
    return { select: select, get current() { return current; } };
  }

  /** 秒 → "m:ss" */
  function mmss(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /** 名前セット（丸アイコン＋名前＋ロールバッジ）の HTML を返す */
  function personHtml(p, opts) {
    opts = opts || {};
    const role = p.role || 'student';
    const avatarClass = role === 'teacher' ? 'avatar-teacher' : role === 'anon' ? 'avatar-anon' : 'avatar-student';
    const initial = role === 'anon' ? '？' : String(p.name || '').trim().charAt(0);
    const size = opts.size === 'sm' ? ' avatar-sm' : opts.size === 'lg' ? ' avatar-lg' : '';
    let badge = '';
    if (role === 'teacher') badge = '<span class="tag tag-accent">先生</span>';
    else if (role === 'student') badge = '<span class="tag tag-neutral">生徒</span>';
    if (opts.noBadge) badge = '';
    return '<span class="person">' +
      '<span class="avatar ' + avatarClass + size + '" aria-hidden="true">' + esc(initial) + '</span>' +
      '<span class="person-name">' + esc(p.name) + '</span>' + badge + '</span>';
  }

  global.Demo = { esc: esc, toast: toast, stateBar: stateBar, mmss: mmss, personHtml: personHtml };
})(window);
