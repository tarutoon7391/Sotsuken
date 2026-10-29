// useLiveKitRoom の接続状態を、同じ画面の部品（StudentCamera など）から読むための小さなストア（担当：W3）
// 部品は room が null のときに「待機画面（まだ接続しない）」と「配信が未設定」を見分けられないため、
// 画面側（pages）の props を増やさずに、hook が状態をここへ書いて部品が読む形にしている。
import { useSyncExternalStore } from 'react';

let current = 'idle';
const listeners = new Set();

/** useLiveKitRoom が状態を変えるたびに呼ぶ */
export function publishLiveKitStatus(status) {
  if (current === status) return;
  current = status;
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @returns {import('./useLiveKitRoom').LiveKitStatus} 直近の LiveKit 接続状態 */
export function useLiveKitStatus() {
  return useSyncExternalStore(subscribe, () => current);
}
