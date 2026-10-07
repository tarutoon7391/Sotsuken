/* ============================================================
   screens-01-03.js — 01 ログイン / 02 会員登録 / 03 プロフィール設定 の共通スクリプト
   ・Phosphor duotone 風アイコン
   ・パスワードの表示／非表示
   ・トースト
   ・デモ用 状態切替バー（スマホ表示／PC表示の切替つき）
   使い方：各画面の JS（login.js / register.js / me.js）から window.App.* を呼ぶ
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- アイコン（viewBox 0 0 256 256、Phosphor duotone 風） ---------- */
  const DUO = 'fill="currentColor" opacity=".2"';
  const ICONS = {
    eye:
      `<path ${DUO} d="M128,56C48,56,16,128,16,128s32,72,112,72,112-72,112-72S208,56,128,56Zm0,112a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"/>` +
      `<path fill="currentColor" d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/>`,
    'eye-slash':
      `<path ${DUO} d="M128,56C48,56,16,128,16,128s32,72,112,72,112-72,112-72S208,56,128,56Z"/>` +
      `<path fill="currentColor" d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48a134.2,134.2,0,0,0-31.6,3.75,8,8,0,1,0,3.8,15.54A118.13,118.13,0,0,1,128,64c30.78,0,57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128c-4.36,8.15-12.78,21.5-26.2,34.09a8,8,0,0,0,11,11.63c18.35-17.17,26.9-34.76,27.47-36.05A8,8,0,0,0,247.31,124.76ZM53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25.38,88.5,9.35,123.29,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a129.13,129.13,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Z"/>`,
    'warning-circle':
      `<path ${DUO} d="M128,32a96,96,0,1,0,96,96A96,96,0,0,0,128,32Z"/>` +
      `<path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"/>`,
    'check-circle':
      `<path ${DUO} d="M128,32a96,96,0,1,0,96,96A96,96,0,0,0,128,32Z"/>` +
      `<path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm45.66-109.66a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,156.69l50.34-50.35A8,8,0,0,1,173.66,106.34Z"/>`,
    'arrow-left':
      `<path fill="currentColor" d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/>`,
    image:
      `<path ${DUO} d="M216,48H40a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H216a8,8,0,0,0,8-8V56A8,8,0,0,0,216,48Z"/>` +
      `<path fill="currentColor" d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z"/>`,
    'sign-out':
      `<path ${DUO} d="M48,40h64V216H48Z"/>` +
      `<path fill="currentColor" d="M120,216a8,8,0,0,1-8,8H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h64a8,8,0,0,1,0,16H48V208h64A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z"/>`,
    /* 先生：黒板（chalkboard） */
    chalkboard:
      `<path ${DUO} d="M40,56H216V184H40Z"/>` +
      `<path fill="currentColor" d="M216,40H40A16,16,0,0,0,24,56V184a16,16,0,0,0,16,16h48v16a8,8,0,0,0,16,0V200h48v16a8,8,0,0,0,16,0V200h48a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,144H40V56H216ZM64,88h72a8,8,0,0,1,0,16H64a8,8,0,0,1,0-16Zm0,40h112a8,8,0,0,1,0,16H64a8,8,0,0,1,0-16Z"/>`,
    /* 生徒：角帽（graduation cap） */
    'graduation-cap':
      `<path ${DUO} d="M128,48,8,104l120,56,120-56Z"/>` +
      `<path fill="none" stroke="currentColor" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" d="M128,48,8,104l120,56,120-56ZM56,126.4V176c0,0,24,32,72,32s72-32,72-32V126.4M248,104v56"/>`,
    lock:
      `<path ${DUO} d="M208,96H48a8,8,0,0,0-8,8V208a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V104A8,8,0,0,0,208,96Z"/>` +
      `<path fill="currentColor" d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208ZM128,132a12,12,0,1,0,12,12A12,12,0,0,0,128,132Z"/>`,
  };

  function icon(name, size) {
    const s = size || 18;
    const body = ICONS[name] || '';
    return `<svg width="${s}" height="${s}" viewBox="0 0 256 256" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  /* <i data-icon="eye" data-size="20"></i> を SVG に置き換える */
  function renderIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(el => {
      el.innerHTML = icon(el.dataset.icon, el.dataset.size);
      el.style.display = 'inline-flex';
    });
  }

  /* ---------- パスワードの表示／非表示 ---------- */
  function initPasswordToggles(root) {
    (root || document).querySelectorAll('[data-pw-toggle]').forEach(btn => {
      const input = document.getElementById(btn.dataset.pwToggle);
      if (!input) return;
      const render = () => {
        const shown = input.type === 'text';
        btn.innerHTML = icon(shown ? 'eye-slash' : 'eye', 20);
        btn.setAttribute('aria-label', shown ? 'パスワードを隠す' : 'パスワードを表示');
        btn.setAttribute('aria-pressed', String(shown));
      };
      btn.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
        render();
        input.focus({ preventScroll: true });
      });
      render();
    });
  }

  /* ---------- トースト ---------- */
  let toastTimer = null;
  function showToast(text, kind, ms) {
    hideToast();
    const host = document.getElementById('app') || document.body;
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' toast-error' : '');
    el.setAttribute('role', 'status');
    el.innerHTML = icon(kind === 'error' ? 'warning-circle' : 'check-circle', 16) + '<span></span>';
    el.querySelector('span').textContent = text;
    host.appendChild(el);
    toastTimer = setTimeout(hideToast, ms || 3000);
    return el;
  }
  function hideToast() {
    clearTimeout(toastTimer);
    document.querySelectorAll('.toast').forEach(t => t.remove());
  }

  /* ---------- スマホ表示／PC表示 ---------- */
  function isMobile() { return document.body.classList.contains('device-mobile'); }
  function setDevice(mode) {
    document.body.classList.toggle('device-mobile', mode === 'mobile');
    document.querySelectorAll('[data-demo-device]').forEach(b => {
      b.textContent = mode === 'mobile' ? 'PC表示へ' : 'スマホ表示';
      b.classList.toggle('is-on', mode === 'mobile');
    });
  }

  /* ---------- デモ用 状態切替バー ----------
     groups: [{ label:'状態', items:[{key,label}], value:'normal', onChange(key) }, ...]
     戻り値: { set(groupIndex, key) } */
  function createDemoBar(groups) {
    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.setAttribute('aria-label', 'デザイン確認用の状態切替');
    const btnMap = [];

    groups.forEach((g, gi) => {
      if (gi > 0) bar.appendChild(sep());
      const label = document.createElement('span');
      label.className = 'demo-label';
      label.textContent = g.label || '状態';
      bar.appendChild(label);
      btnMap[gi] = {};
      g.items.forEach(it => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = it.label;
        b.classList.toggle('is-on', it.key === g.value);
        b.addEventListener('click', () => { api.set(gi, it.key); g.onChange && g.onChange(it.key); });
        btnMap[gi][it.key] = b;
        bar.appendChild(b);
      });
    });

    bar.appendChild(sep());
    const dev = document.createElement('button');
    dev.type = 'button';
    dev.dataset.demoDevice = '1';
    dev.addEventListener('click', () => setDevice(isMobile() ? 'pc' : 'mobile'));
    bar.appendChild(dev);
    document.body.appendChild(bar);

    // 初期表示：画面が狭ければスマホ表示（生徒画面と同じ判定）
    setDevice(window.innerWidth < 700 ? 'mobile' : 'pc');

    const api = {
      set(gi, key) {
        Object.entries(btnMap[gi] || {}).forEach(([k, b]) => b.classList.toggle('is-on', k === key));
      },
    };
    return api;

    function sep() { const s = document.createElement('span'); s.className = 'demo-sep'; return s; }
  }

  global.App = { icon, renderIcons, initPasswordToggles, showToast, hideToast, createDemoBar, setDevice, isMobile };
})(window);
