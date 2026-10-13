import { readFileSync } from 'node:fs';
import { createSecureContext } from 'node:tls';
// Explicit opt-in only. Certificates and keys are never VITE_ variables or browser assets.
export function mobileHttps(command: string, env = process.env) {
  if (command !== 'serve') return {};
  const certPath = env.MACHI_DEV_HTTPS_CERT, keyPath = env.MACHI_DEV_HTTPS_KEY;
  if (!certPath && !keyPath) return {};
  if (!certPath || !keyPath) throw new Error('スマホHTTPSには証明書と秘密鍵の両方を設定してください。HTTPへ自動切替しません。');
  try {
    const cert = readFileSync(certPath), key = readFileSync(keyPath);
    createSecureContext({ cert, key });
    return { host: '0.0.0.0', https: { cert, key } };
  } catch { throw new Error('スマホHTTPS証明書を読み込めません。ファイルと鍵の対応を確認してください。HTTPへ自動切替しません。'); }
}
