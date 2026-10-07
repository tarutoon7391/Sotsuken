/* ==========================================================================
   09_waiting.js — 授業待機（開始前）デモ用ロジック
   実装時：
     ・Socket の「授業開始」イベントを受けたら showStarted() → 生徒画面（授業中）へ遷移
     ・カメラは navigator.mediaDevices.getUserMedia で取得し、拒否されたら setCamDenied(true)
   ========================================================================== */
(function () {
  'use strict';

  const camPanel = document.getElementById('camPanel');
  const camOff = document.getElementById('camOff');
  const camOn = document.getElementById('camOn');
  const camDenied = document.getElementById('camDenied');
  const camToggle = document.getElementById('camToggle');
  const camLabel = document.getElementById('camLabel');
  const startedOverlay = document.getElementById('startedOverlay');
  const myStatus = document.getElementById('myStatus');

  let camIsOn = false;
  let denied = false;
  let startedTimer = null;

  // ---- カメラ ----
  function renderCam() {
    camDenied.hidden = !denied;
    camOff.hidden = denied || camIsOn;
    camOn.hidden = denied || !camIsOn;
    camToggle.classList.toggle('is-on', camIsOn && !denied);
    camToggle.setAttribute('aria-pressed', String(camIsOn && !denied));
    camLabel.textContent = camIsOn && !denied ? 'カメラ ON' : 'カメラ OFF';
    camToggle.disabled = denied;
  }
  camToggle.addEventListener('click', function () {
    if (denied) return;
    camIsOn = !camIsOn;
    renderCam();
  });
  document.getElementById('camRetry').addEventListener('click', function () {
    // 実装時：getUserMedia を再実行。デモでは許可されたことにする
    denied = false;
    camIsOn = true;
    renderCam();
    Demo.toast('カメラを使えるようになりました');
  });

  // ---- 開始された ----
  function showStarted() {
    myStatus.innerHTML = '<span class="dot"></span>出席中';
    startedOverlay.hidden = false;
    clearTimeout(startedTimer);
    startedTimer = setTimeout(function () {
      // 実装時：location.href = '/lessons/:id/learn'（生徒画面・授業中）
      startedOverlay.hidden = true;
      Demo.toast('ここで生徒画面（授業中）に切り替わります', 2600);
    }, 1800);
  }

  // ---- 退出ダイアログ ----
  const leaveDialog = document.getElementById('leaveDialog');
  document.getElementById('leaveBtn').addEventListener('click', function () { leaveDialog.hidden = false; });
  document.getElementById('leaveCancel').addEventListener('click', function () { leaveDialog.hidden = true; });
  document.getElementById('leaveConfirm').addEventListener('click', function () {
    leaveDialog.hidden = true;
    // 実装時：location.href = '/classes/:id'（クラス詳細）
    Demo.toast('クラス詳細へ戻ります');
  });
  leaveDialog.addEventListener('click', function (e) { if (e.target === leaveDialog) leaveDialog.hidden = true; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') leaveDialog.hidden = true; });

  // ---- 状態切替（デモ）----
  function applyMode(key) {
    clearTimeout(startedTimer);
    startedOverlay.hidden = true;
    leaveDialog.hidden = true;
    myStatus.innerHTML = '<span class="dot dot-neutral"></span>開始前';
    denied = key === 'denied';
    if (key === 'denied') camIsOn = false;
    renderCam();
    if (key === 'started') showStarted();
  }

  Demo.stateBar({
    states: [
      { key: 'waiting', label: '待機中' },
      { key: 'started', label: '開始された' },
      { key: 'denied', label: 'カメラの許可がない' }
    ],
    initial: 'waiting',
    onChange: applyMode,
    mobileToggle: true
  });
})();
