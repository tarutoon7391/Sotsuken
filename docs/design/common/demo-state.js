// demo-state.js — デザイン確認用の「状態」切替バー（12 / 13 / 14 共通）
// 使い方：
//   <body data-state="student">
//   状態で出し分けたい要素に data-show="student teacher" のように状態名を書く（空白区切り）
//   バーのボタンは data-state="xxx"、スマホ/PC切替は data-toggle-mobile
//   URL に ?state=xxx&mobile=1 を付けても指定できる
(function () {
  var body = document.body;
  var bar = document.querySelector('[data-demo-bar]');
  if (!bar) return;

  var stateButtons = bar.querySelectorAll('button[data-state]');
  var mobileButton = bar.querySelector('[data-toggle-mobile]');
  var conditional = document.querySelectorAll('[data-show]');

  function applyState(state) {
    body.setAttribute('data-state', state);
    conditional.forEach(function (el) {
      var allowed = el.getAttribute('data-show').split(/\s+/);
      el.hidden = allowed.indexOf(state) === -1;
    });
    stateButtons.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-state') === state);
    });
    // <title> に状態名を添える（タブで見分けやすくする）
    var active = bar.querySelector('button[data-state="' + state + '"]');
    if (active) {
      var base = document.title.replace(/ - .*$/, '');
      document.title = base + ' - ' + active.textContent.trim();
    }
  }

  function applyMobile(on) {
    body.classList.toggle('is-mobile', on);
    if (mobileButton) {
      mobileButton.textContent = on ? 'PC表示へ' : 'スマホ表示';
      mobileButton.classList.toggle('is-active', on);
    }
  }

  stateButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { applyState(btn.getAttribute('data-state')); });
  });
  if (mobileButton) {
    mobileButton.addEventListener('click', function () {
      applyMobile(!body.classList.contains('is-mobile'));
    });
  }

  var params = new URLSearchParams(location.search);
  applyState(params.get('state') || body.getAttribute('data-state') || stateButtons[0].getAttribute('data-state'));
  applyMobile(params.get('mobile') === '1');
})();
