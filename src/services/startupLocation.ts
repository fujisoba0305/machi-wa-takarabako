export function locationFailureMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 1) return '位置情報が許可されていません。Safariのサイト設定とiPhoneの「設定 → プライバシーとセキュリティ → 位置情報サービス」を確認して、再取得してください。';
  if (code === 2) return '現在地を確認できませんでした。通信状態を確認し、位置情報を取得できる場所で再取得してください。';
  if (code === 3) return '現在地の取得に時間がかかりました。古い位置は使っていません。少し待って再取得してください。';
  return error instanceof Error ? error.message : '現在地を取得できませんでした。位置情報の設定を確認して、再取得してください。';
}
/** No server request, persisted position, approximate-location fallback or cached fix. */
export function requestFreshSearchPosition(): Promise<{ latitude: number; longitude: number; accuracy: number; timestamp: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(Error('このブラウザでは位置情報を利用できません。HTTPSで開いているか確認してください。')); return; }
    let settled = false;
    const finish = (fn: () => void) => { if (settled) return; settled = true; clearTimeout(timer); fn(); };
    // Some Safari interruptions never call either callback. Leave a retryable UI.
    const timer = setTimeout(() => finish(() => reject(Error(locationFailureMessage({ code: 3 })))), 12000);
    try { navigator.geolocation.getCurrentPosition(position => finish(() => {
      const { latitude, longitude, accuracy } = position.coords, timestamp = position.timestamp;
      if (![latitude, longitude, accuracy, timestamp].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0 || Date.now() - timestamp > 30000 || timestamp > Date.now() + 5000) {
        reject(Error('新しい現在地を確認できませんでした。以前の位置は使わず、再取得してください。')); return;
      }
      resolve({ latitude, longitude, accuracy, timestamp });
    }), error => finish(() => reject(Error(locationFailureMessage(error)))), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }); }
    catch (error) { finish(() => reject(Error(locationFailureMessage(error)))); }
  });
}
