// Persist tokens only in the existing SDK-owned key; never copy or print them.
export const ACCOUNT_STORAGE_KEY = 'machiAccountAuth.v1';
export const ACCOUNT_AUDIT_KEY = 'machiAccountPersistenceAudit.v1';
const kinds = ['client-created', 'session-write-verified', 'session-write-failed', 'session-read-failed', 'sdk-session-removed', 'logout-requested', 'oauth-return-success', 'oauth-persistence-confirmed', 'oauth-persistence-failed'] as const;
type Kind = typeof kinds[number];
let pageClients = 0;
let lastOperation: Kind | undefined;
function store() { return window.localStorage; }
function events(): Kind[] {
  try { const value = JSON.parse(store().getItem(ACCOUNT_AUDIT_KEY) || '[]'); return Array.isArray(value) ? value.filter((x: unknown): x is Kind => typeof x === 'string' && kinds.includes(x as Kind)).slice(-12) : []; } catch { return []; }
}
export function recordAccountPersistence(kind: Kind) {
  lastOperation = kind;
  try { store().setItem(ACCOUNT_AUDIT_KEY, JSON.stringify([...events(), kind].slice(-12))); } catch { /* Diagnostics must not replace an auth failure. */ }
}
export function createAccountSessionStorage() {
  pageClients++; recordAccountPersistence('client-created');
  return {
    getItem(key: string): string | null {
      try { return store().getItem(key); }
      catch { if (key === ACCOUNT_STORAGE_KEY) recordAccountPersistence('session-read-failed'); throw new Error('認証の保存領域を読み取れません。Safariの保存設定を確認してください。'); }
    },
    setItem(key: string, value: string) {
      try {
        store().setItem(key, value);
        if (store().getItem(key) !== value) throw new Error('write-not-retained');
      } catch {
        if (key === ACCOUNT_STORAGE_KEY) recordAccountPersistence('session-write-failed');
        throw new Error('ログイン情報を端末に保存できませんでした。再起動後の保持は確認できません。Safariの保存設定を確認してください。');
      }
      if (key === ACCOUNT_STORAGE_KEY) recordAccountPersistence('session-write-verified');
    },
    removeItem(key: string) {
      try { store().removeItem(key); }
      catch { throw new Error('認証情報の削除を確認できません。Safariの保存設定を確認してください。'); }
      if (key === ACCOUNT_STORAGE_KEY) recordAccountPersistence('sdk-session-removed');
    },
  };
}
export function accountPersistenceReport() {
  let presence = '読み取り不可';
  try { presence = store().getItem(ACCOUNT_STORAGE_KEY) === null ? 'なし' : 'あり（内容は記録しません）'; } catch {}
  const history = events();
  const labels: Record<Kind, string> = {
    'client-created': '認証クライアント作成', 'session-write-verified': 'セッション保存・読み戻し一致',
    'session-write-failed': 'セッション保存失敗', 'session-read-failed': 'セッション読込失敗',
    'sdk-session-removed': 'SDKからセッション削除', 'logout-requested': '利用者のログアウト操作',
    'oauth-return-success': 'Google認証の戻り処理成功',
    'oauth-persistence-confirmed': 'Google認証後の永続セッション一致確認',
    'oauth-persistence-failed': 'Google認証後の永続セッション未確認',
  };
  const standalone = (navigator as Navigator & {standalone?: boolean}).standalone === true || Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
  return ['認証保存の診断（トークン・UID・氏名・座標なし）',
    '実行環境：' + (standalone ? 'ホーム画面アプリ' : '通常ブラウザ形式（Safari・アプリ内ブラウザの区別は未判定）'),
    'サイト：' + (window.location.hostname === 'machi-wa-takarabako.vercel.app' ? '正式URL' : '正式URL以外（保存領域が異なります）'),
    '認証保存先：localStorage（メモリ保存へ自動切替しません）', '現在の認証保存データ：' + presence,
    'このページの認証クライアント作成回数：' + pageClients,
    'このページの最終保存操作：' + (lastOperation ? labels[lastOperation] : '未記録'),
    '同じ保存領域の直近履歴（古い順）：' + (history.length ? history.map(x=>labels[x]).join(' → ') : 'なし（未計測・領域変更・消去は区別できません）'),
    '保存直後の一致は、Safari再起動後の保持を保証しません。通常タブとホーム画面アプリで保存領域が異なる場合があります。'].join('\n');
}

/** Internal equality check only: never expose session contents or change saved data. */
export function assertPersistedAccountSession(session: {access_token:string;refresh_token:string;user:{id:string}} | null | undefined) {
  try {
    const raw = store().getItem(ACCOUNT_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (!session?.access_token || !session.refresh_token || !session.user?.id ||
        saved?.access_token !== session.access_token || saved?.refresh_token !== session.refresh_token || saved?.user?.id !== session.user.id) throw new Error('not-persisted');
  } catch {
    recordAccountPersistence('oauth-persistence-failed');
    throw new Error('Googleログインは戻りましたが、端末へのログイン情報の保存を確認できません。登録をやり直さず、認証保存の診断を確認してください。');
  }
  recordAccountPersistence('oauth-persistence-confirmed');
}
