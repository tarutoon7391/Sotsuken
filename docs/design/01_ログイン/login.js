/* ============================================================
   01 ログイン /login
   状態：normal（通常）／error（入力エラー）／submitting（送信中）
   送信先：POST /api/login（このモックでは送信せず、状態だけ切り替える）
   ============================================================ */
(function () {
  'use strict';

  const form = document.getElementById('loginForm');
  const alertBox = document.getElementById('formAlert');
  const submitBtn = document.getElementById('submitBtn');
  const loginId = document.getElementById('loginId');
  const password = document.getElementById('password');

  const DEMO_ID = 'hinata';
  const DEMO_PASSWORD = 'password123';
  let state = 'normal';
  let timer = null;

  App.renderIcons();
  App.initPasswordToggles();

  /* 状態を画面に反映する */
  function apply(next) {
    state = next;
    clearTimeout(timer);

    const busy = state === 'submitting';
    const error = state === 'error';

    // 入力エラー：フォームの上に表示。入力欄は消さない
    alertBox.hidden = !error;
    loginId.setAttribute('aria-invalid', String(error));
    password.setAttribute('aria-invalid', String(error));
    if (error && !loginId.value) loginId.value = DEMO_ID;          // デモ用：空なら入力例を入れて「消えない」ことを見せる
    if (error && !password.value) password.value = DEMO_PASSWORD;

    // 送信中：ボタンがスピナー付きで押せない
    submitBtn.disabled = busy;
    submitBtn.classList.toggle('is-busy', busy);
    submitBtn.innerHTML = busy ? '<span class="spinner"></span><span>ログイン中…</span>' : 'ログイン';
    loginId.readOnly = busy;
    password.readOnly = busy;

    bar.set(0, state);
  }

  /* 送信（モック）：1.2秒の送信中のあと、エラー表示にする */
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (state === 'submitting') return;
    apply('submitting');
    timer = setTimeout(() => apply('error'), 1200);
  });

  // 入力を直したらエラー表示を消す
  [loginId, password].forEach(el => el.addEventListener('input', () => { if (state === 'error') apply('normal'); }));

  /* デモ用 状態切替バー */
  const bar = App.createDemoBar([
    {
      label: '状態',
      value: 'normal',
      items: [
        { key: 'normal', label: '通常' },
        { key: 'error', label: '入力エラー' },
        { key: 'submitting', label: '送信中' },
      ],
      onChange: apply,
    },
  ]);

  apply('normal');
})();
