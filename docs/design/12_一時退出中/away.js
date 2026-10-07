// 12 一時退出中 — カウントダウンと「授業に戻る」の動き（デザイン確認用）
// 状態の切替そのものは ../js/demo-state.js（body の data-state）に任せる。
(function () {
  var LIMIT_LOW = 3 * 60;          // 残り3分未満で「わずか」に切り替える
  var START = { normal: 12 * 60 + 34, low: 2 * 60 + 59 };

  var body = document.body;
  var timeEl = document.querySelector('[data-countdown]');
  var returnBtn = document.querySelector('[data-return]');
  var returnNote = document.querySelector('[data-return-note]');
  var absentBtn = document.querySelector('[data-return-absent]');
  var remain = START.normal;
  var timer = null;

  function format(sec) {
    var s = Math.max(0, sec);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function setDemoState(state) {
    var btn = document.querySelector('.demo-bar button[data-state="' + state + '"]');
    if (btn) btn.click();
  }

  // 累積ベース（v4）：退出時間の合計 ＝ 閾値 − 残り。前回までの分はデモ用の固定値
  var LIMIT = 15 * 60;             // 欠課判定の閾値（lessons.away_timeout_min）
  var PREV = { normal: 2 * 60, low: 9 * 60 + 30 };   // 前回までの退出の合計（away_total_sec）
  var usedEl = document.querySelector('[data-used]');
  var prevEl = document.querySelector('[data-prev]');
  var meterEl = document.querySelector('[data-meter]');
  document.querySelector('[data-limit]').textContent = format(LIMIT);

  function renderTotal(state) {
    var used = LIMIT - Math.max(0, remain);
    usedEl.textContent = format(used);
    meterEl.style.width = Math.min(100, used / LIMIT * 100) + '%';
    if (state) prevEl.textContent = format(PREV[state] || PREV.normal);
  }

  function tick() {
    remain -= 1;
    timeEl.textContent = format(remain);
    renderTotal();
    var state = body.getAttribute('data-state');
    if (remain <= 0) {
      stop();
      setDemoState('expired');           // 0 になったら欠課確定の表示へ
    } else if (state === 'normal' && remain < LIMIT_LOW) {
      setDemoState('low');               // 3分を切ったら「わずか」へ
    }
  }

  function stop() { clearInterval(timer); timer = null; }

  function start(state) {
    stop();
    if (state === 'expired') { timeEl.textContent = '0:00'; return; }
    remain = START[state] || START.normal;
    timeEl.textContent = format(remain);
    renderTotal(state);
    timer = setInterval(tick, 1000);
  }

  // 「授業に戻る」ボタンの元の表示（押したあとに戻すため）
  var returnLabel = returnBtn.innerHTML;
  function resetReturn() {
    returnBtn.disabled = false;
    returnBtn.innerHTML = returnLabel;
    returnNote.textContent = '';
  }

  // 状態バーで data-state が変わったらカウントダウンを入れ直す
  var last = null;
  function onStateChange() {
    var state = body.getAttribute('data-state');
    if (state === last) return;
    last = state;
    resetReturn();
    start(state);
  }
  new MutationObserver(onStateChange).observe(body, { attributes: true, attributeFilter: ['data-state'] });
  onStateChange();

  // 「授業に戻る」：POST /api/lessons/:id/attendance/return を送る想定
  returnBtn.addEventListener('click', function () {
    returnBtn.disabled = true;
    returnBtn.innerHTML = '<span class="spinner"></span> 戻っています…';
    stop();
    setTimeout(function () {
      returnNote.textContent = '→ 生徒画面（授業中）へ遷移（デモ）';
    }, 900);
  });
  absentBtn.addEventListener('click', function () {
    absentBtn.disabled = true;
    absentBtn.textContent = '→ 生徒画面（授業中）へ遷移（デモ・欠課のまま）';
  });
})();
