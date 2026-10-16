import { ACCOUNT_STORAGE_KEY, createAccountSessionStorage, recordAccountPersistence, assertPersistedAccountSession } from './accountSessionStorage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Account sessions must never be consumed by the legacy guest data client.
export { ACCOUNT_STORAGE_KEY } from './accountSessionStorage';
let accountClient: SupabaseClient | undefined;
let initialization: Promise<void> | undefined;
export function getAccountClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('認証設定を確認できません。時間をおいてお試しください。');
  return accountClient ??= createClient(url, key, { auth: {
    storageKey: ACCOUNT_STORAGE_KEY, flowType: 'pkce', detectSessionInUrl: false,
    persistSession: true, autoRefreshToken: true, storage: createAccountSessionStorage(),
  } });
}
export function isAccountPage() {
  return new URLSearchParams(window.location.search).get('account') === '1';
}
export function initializeAccount() {
  if (initialization) return initialization;
  const task = (async () => {
    const client = getAccountClient();
    const url = new URL(window.location.href);
    if (url.searchParams.get('auth_callback') !== '1') return;
    const code = url.searchParams.get('code');
    const hash = new URLSearchParams(url.hash.slice(1));
    const failed = url.searchParams.has('error') || hash.has('error');
    // Remove credentials and provider error details before rendering profile images.
    for (const key of ['code', 'auth_callback', 'error', 'error_code', 'error_description']) url.searchParams.delete(key);
    url.hash = '';
    window.history.replaceState(null, '', url.pathname + url.search);
    if (failed || !code) throw new Error('ログインが完了しませんでした。もう一度お試しください。');
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new Error('ログインを確認できませんでした。ログインを始めたブラウザで、もう一度お試しください。');
    recordAccountPersistence('oauth-return-success');
    assertPersistedAccountSession(data?.session);
  })();
  initialization = task;
  // A consumed callback must not poison every later restoration retry.
  void task.catch(() => { if (initialization === task) initialization = undefined; });
  return task;
}
export async function loginWithGoogle() {
  const client = getAccountClient();
  const redirectTo = new URL(window.location.pathname, window.location.origin);
  redirectTo.search = '?account=1&auth_callback=1';
  // Allow a new attempt after a cancelled/expired callback without touching guest storage.
  initialization = undefined;
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: {
    redirectTo: redirectTo.href, queryParams: { prompt: 'select_account' },
  } });
  if (error) throw new Error('Googleログインを開始できませんでした。通信状態やログイン設定を確認して、もう一度お試しください。');
}
export async function logoutAccount() {
  recordAccountPersistence('logout-requested');
  const { error } = await getAccountClient().auth.signOut({ scope: 'local' });
  if (error) throw new Error('ログアウトできませんでした。通信状態を確認して、もう一度お試しください。');
}
export function googleAvatar(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))) return url.href;
  } catch { /* Untrusted profile URLs use the local fallback. */ }
}
