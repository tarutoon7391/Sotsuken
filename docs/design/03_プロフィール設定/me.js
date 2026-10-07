/* ============================================================
   03 プロフィール設定 /me
   状態：normal（通常）／saved（保存成功：トースト）／tooLarge（画像サイズ超過エラー）
   送信先：PUT /api/me（表示名）、POST /api/me/icon（画像）
   （このモックでは送信せず、状態だけ切り替える）
   ============================================================ */
(function () {
  'use strict';

  /* 画像の上限（仕様書に未記載のため仮置き。決まったらここだけ直す） */
  const ICON_MAX_MB = 2;

  const form = document.getElementById('meForm');
  const saveBtn = document.getElementById('saveBtn');
  const nameInput = document.getElementById('name');
  const nameError = document.getElementById('nameError');
  const iconFile = document.getElementById('iconFile');
  const pickIconBtn = document.getElementById('pickIconBtn');
  const iconPreview = document.getElementById('iconPreview');
  const iconError = document.getElementById('iconError');
  const iconLimitText = document.getElementById('iconLimitText');
  const roleBadge = document.getElementById('roleBadge');
  const headerAvatar = document.getElementById('headerAvatar');
  const headerName = document.getElementById('headerName');
  const headerBadge = document.getElementById('headerBadge');

  /* モックの自分（ロールはデモバーで切り替えて見比べられる） */
  const USERS = {
    student: { name: '田中 ひなた', role: 'student', roleLabel: '生徒', avatarClass: 'avatar-student', tagClass: 'tag-neutral' },
    teacher: { name: '鈴木先生',   role: 'teacher', roleLabel: '先生', avatarClass: 'avatar-teacher', tagClass: 'tag-accent' },
  };
  let me = USERS.student;
  let iconUrl = '';       // 選んだ画像（DataURL）。空なら名前の1文字目
  let state = 'normal';
  let timer = null;

  App.renderIcons();
  iconLimitText.textContent = ICON_MAX_MB + 'MB';

  /* ---------- 表示の更新 ---------- */
  function initialOf(name) { return (name.trim() || '？').charAt(0); }

  function renderAvatar(el, sizeClass) {
    el.className = 'avatar ' + me.avatarClass + (sizeClass ? ' ' + sizeClass : '');
    if (iconUrl) {
      el.innerHTML = '';
      const img = document.createElement('img');
      img.src = iconUrl;
      img.alt = '';
      el.appendChild(img);
    } else {
      el.textContent = initialOf(nameInput.value);
    }
  }
  function renderAll() {
    renderAvatar(iconPreview, 'avatar-xl');
    renderAvatar(headerAvatar);
    headerName.textContent = nameInput.value.trim() || me.name;
    roleBadge.className = 'tag ' + me.tagClass;
    roleBadge.textContent = me.roleLabel;
    headerBadge.className = 'tag ' + me.tagClass;
    headerBadge.textContent = me.roleLabel;
  }
  function setIconError(message) {
    iconError.innerHTML = message ? App.icon('warning-circle', 14) + '<span></span>' : '';
    if (message) iconError.querySelector('span').textContent = message;
  }
  function setNameError(message) {
    nameError.innerHTML = message ? App.icon('warning-circle', 14) + '<span></span>' : '';
    if (message) nameError.querySelector('span').textContent = message;
    nameInput.setAttribute('aria-invalid', String(!!message));
  }

  /* ---------- 状態を画面に反映 ---------- */
  function apply(next) {
    state = next;
    clearTimeout(timer);
    App.hideToast();
    setIconError('');

    switch (state) {
      case 'saved':
        App.showToast('保存しました', 'ok', 8000);
        break;
      case 'tooLarge':
        setIconError('画像は' + ICON_MAX_MB + 'MBまでです');
        break;
    }
    bar.set(0, state);
  }

  /* ---------- アイコン（画像を選ぶ → プレビュー差し替え） ---------- */
  pickIconBtn.addEventListener('click', () => iconFile.click());
  iconFile.addEventListener('change', () => {
    const file = iconFile.files && iconFile.files[0];
    if (!file) return;
    if (file.size > ICON_MAX_MB * 1024 * 1024) {
      iconFile.value = '';
      apply('tooLarge');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { iconUrl = String(reader.result); apply('normal'); renderAll(); };
    reader.readAsDataURL(file);
  });

  /* ---------- 表示名（打つとアイコンの1文字目とヘッダーも追従） ---------- */
  nameInput.addEventListener('input', () => { setNameError(''); renderAll(); });

  /* ---------- 保存（モック：PUT /api/me） ---------- */
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (saveBtn.disabled) return;
    if (!nameInput.value.trim()) { setNameError('表示名を入力してください'); nameInput.focus(); return; }
    saveBtn.disabled = true;
    saveBtn.classList.add('is-busy');
    saveBtn.innerHTML = '<span class="spinner"></span><span>保存中…</span>';
    timer = setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.classList.remove('is-busy');
      saveBtn.textContent = '保存';
      me = Object.assign({}, me, { name: nameInput.value.trim() });
      apply('saved');
    }, 700);
  });

  /* ---------- デモ用 状態切替バー ---------- */
  const bar = App.createDemoBar([
    {
      label: '状態',
      value: 'normal',
      items: [
        { key: 'normal', label: '通常' },
        { key: 'saved', label: '保存成功' },
        { key: 'tooLarge', label: '画像サイズ超過' },
      ],
      onChange: apply,
    },
    {
      label: '見る人',
      value: 'student',
      items: [
        { key: 'student', label: '生徒' },
        { key: 'teacher', label: '先生' },
      ],
      onChange: key => { me = USERS[key]; nameInput.value = me.name; iconUrl = ''; renderAll(); apply('normal'); },
    },
  ]);

  renderAll();
  apply('normal');
})();
