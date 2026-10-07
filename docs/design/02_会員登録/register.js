/* ============================================================
   02 会員登録 /register
   状態：normal（ロール未選択）／selected（ロール選択済み）／
         idTaken（IDが既に使われている）／invalid（入力不備）／submitting（送信中）
   送信先：POST /api/register {name, login_id, password, role}
   （このモックでは送信せず、状態だけ切り替える）
   ============================================================ */
(function () {
  'use strict';

  const form = document.getElementById('registerForm');
  const roleCards = Array.from(document.querySelectorAll('.role-card'));
  const roleInput = document.getElementById('roleInput');
  const roleHelp = document.getElementById('roleHelp');
  const submitBtn = document.getElementById('submitBtn');

  const fields = {
    name: { input: document.getElementById('name'), error: document.getElementById('nameError') },
    loginId: { input: document.getElementById('loginId'), error: document.getElementById('loginIdError') },
    password: { input: document.getElementById('password'), error: document.getElementById('passwordError') },
    passwordConfirm: { input: document.getElementById('passwordConfirm'), error: document.getElementById('passwordConfirmError') },
  };

  const TAKEN_IDS = ['hinata', 'suzuki'];       // デモ用：既に使われている ID
  const DEMO = { name: '田中 ひなた', loginId: 'hinata', password: 'password123' };

  let role = '';
  let state = 'normal';
  let timer = null;

  App.renderIcons();
  App.initPasswordToggles();

  /* ---------- ロール ---------- */
  function setRole(next) {
    role = next || '';
    roleInput.value = role;
    roleCards.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.role === role)));
    roleHelp.textContent = role
      ? (role === 'teacher' ? '先生として登録します' : '生徒として登録します')
      : '先生か生徒を選んでください';
    submitBtn.disabled = !role || state === 'submitting';
  }
  roleCards.forEach(c => c.addEventListener('click', () => {
    setRole(c.dataset.role);
    if (state === 'normal') apply('selected');
  }));

  /* ---------- エラー表示 ---------- */
  function setError(key, message) {
    const f = fields[key];
    f.error.innerHTML = message ? App.icon('warning-circle', 14) + '<span></span>' : '';
    if (message) f.error.querySelector('span').textContent = message;
    f.input.setAttribute('aria-invalid', String(!!message));
  }
  function clearErrors() { Object.keys(fields).forEach(k => setError(k, '')); }
  function fillDemo(values) {
    Object.entries(values).forEach(([k, v]) => { fields[k].input.value = v; });
  }

  /* 入力チェック（空欄・パスワード不一致を各欄の下に表示） */
  function validate() {
    clearErrors();
    let ok = true;
    const v = k => fields[k].input.value.trim();
    if (!v('name')) { setError('name', '表示名を入力してください'); ok = false; }
    if (!v('loginId')) { setError('loginId', 'ログインIDを入力してください'); ok = false; }
    else if (!/^[a-zA-Z0-9_]+$/.test(v('loginId'))) { setError('loginId', 'ログインIDは半角英数字で入力してください'); ok = false; }
    if (!fields.password.input.value) { setError('password', 'パスワードを入力してください'); ok = false; }
    else if (fields.password.input.value.length < 8) { setError('password', 'パスワードは8文字以上にしてください'); ok = false; }
    if (!fields.passwordConfirm.input.value) { setError('passwordConfirm', '確認用のパスワードを入力してください'); ok = false; }
    else if (fields.password.input.value !== fields.passwordConfirm.input.value) { setError('passwordConfirm', 'パスワードが一致しません'); ok = false; }
    return ok;
  }

  /* ---------- 状態を画面に反映 ---------- */
  function apply(next) {
    state = next;
    clearTimeout(timer);
    const busy = state === 'submitting';

    switch (state) {
      case 'normal':
        setRole('');
        clearErrors();
        break;
      case 'selected':
        if (!role) setRole('student');
        clearErrors();
        break;
      case 'idTaken':
        if (!role) setRole('student');
        fillDemo({ name: DEMO.name, loginId: DEMO.loginId, password: DEMO.password, passwordConfirm: DEMO.password });
        clearErrors();
        setError('loginId', 'このログインIDは既に使われています');
        break;
      case 'invalid':
        if (!role) setRole('student');
        fillDemo({ name: '', loginId: 'hinata-2', password: 'password123', passwordConfirm: 'password12' });
        validate();
        break;
      case 'submitting':
        if (!role) setRole('student');
        if (!fields.name.input.value) fillDemo({ name: DEMO.name, loginId: 'hinata_2', password: DEMO.password, passwordConfirm: DEMO.password });
        clearErrors();
        break;
    }

    // 送信中：ボタンがスピナー付きで押せない
    submitBtn.classList.toggle('is-busy', busy);
    submitBtn.innerHTML = busy ? '<span class="spinner"></span><span>登録中…</span>' : '登録してはじめる';
    submitBtn.disabled = !role || busy;
    Object.values(fields).forEach(f => { f.input.readOnly = busy; });
    roleCards.forEach(c => { c.disabled = busy; });

    bar.set(0, state);
  }

  /* ---------- 送信（モック） ---------- */
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!role || state === 'submitting') return;
    if (!validate()) { state = 'invalid'; bar.set(0, state); return; }
    apply('submitting');
    timer = setTimeout(() => {
      const id = fields.loginId.input.value.trim().toLowerCase();
      if (TAKEN_IDS.includes(id)) {
        apply('selected');
        setError('loginId', 'このログインIDは既に使われています');
        state = 'idTaken'; bar.set(0, state);
        fields.loginId.input.focus();
      } else {
        apply('selected');
        App.showToast('登録しました（デモ）');
      }
    }, 1200);
  });

  // 入力を直したらその欄のエラーを消す
  Object.entries(fields).forEach(([k, f]) => f.input.addEventListener('input', () => setError(k, '')));

  /* ---------- デモ用 状態切替バー ---------- */
  const bar = App.createDemoBar([
    {
      label: '状態',
      value: 'normal',
      items: [
        { key: 'normal', label: '通常（未選択）' },
        { key: 'selected', label: 'ロール選択済み' },
        { key: 'idTaken', label: 'ID重複' },
        { key: 'invalid', label: '入力不備' },
        { key: 'submitting', label: '送信中' },
      ],
      onChange: apply,
    },
  ]);

  apply('normal');
})();
