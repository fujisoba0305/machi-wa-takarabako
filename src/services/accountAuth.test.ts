// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ create: vi.fn(), exchange: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mock.create }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); localStorage.clear(); window.history.replaceState(null, '', '/');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-test');
  mock.exchange.mockResolvedValue({ error: null }); mock.login.mockResolvedValue({ error: null }); mock.logout.mockResolvedValue({ error: null });
  mock.create.mockReturnValue({ auth: { exchangeCodeForSession: mock.exchange, signInWithOAuth: mock.login, signOut: mock.logout } });
});
describe('isolated account auth', () => {
  it('separates persistent PKCE account storage from guest transport', async () => {
    const account = await import('./accountAuth'); const guest = await import('./supabase');
    account.getAccountClient(); guest.getSupabaseClient();
    expect(mock.create.mock.calls[0][2].auth).toMatchObject({ storageKey: 'machiAccountAuth.v1', flowType: 'pkce', detectSessionInUrl: false });
    expect(mock.create.mock.calls[1][2].auth).toMatchObject({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
    expect(mock.create.mock.calls[0][2].auth.storageKey).not.toBe(mock.create.mock.calls[1][2].auth.storageKey);
  });
  it('exchanges a callback once, removes sensitive URL parameters and preserves guest data', async () => {
    localStorage.setItem('machiTakarabakoExp', '320');
    window.history.replaceState(null, '', '/?account=1&auth_callback=1&code=test-code');
    const auth = await import('./accountAuth');
    expect(auth.isAccountPage()).toBe(true);
    await Promise.all([auth.initializeAccount(), auth.initializeAccount()]);
    expect(mock.exchange).toHaveBeenCalledExactlyOnceWith('test-code');
    expect(location.search).toBe('?account=1'); expect(localStorage.getItem('machiTakarabakoExp')).toBe('320');
  });
  it('handles cancellation without exchanging or exposing provider messages', async () => {
    window.history.replaceState(null, '', '/?account=1&auth_callback=1&error=access_denied&error_description=private');
    const auth = await import('./accountAuth');
    await expect(auth.initializeAccount()).rejects.toThrow('ログインが完了');
    expect(mock.exchange).not.toHaveBeenCalled(); expect(location.href).not.toContain('private');
  });
  it('handles expired codes and allows starting a new attempt', async () => {
    window.history.replaceState(null, '', '/?account=1&auth_callback=1&code=expired');
    mock.exchange.mockResolvedValue({ error: new Error('secret') });
    const auth = await import('./accountAuth');
    await expect(auth.initializeAccount()).rejects.toThrow('ログインを始めたブラウザ');
    await auth.loginWithGoogle();
    expect(mock.login).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: location.origin+'/?account=1&auth_callback=1', queryParams: { prompt: 'select_account' } } });
  });
  it('reports OAuth start failure and logs out only locally without clearing guest keys', async () => {
    const auth = await import('./accountAuth'); localStorage.setItem('machiTakarabakoActiveAdventure','preserved');
    mock.login.mockResolvedValue({ error: new Error('secret') });
    await expect(auth.loginWithGoogle()).rejects.toThrow('開始できません');
    await auth.logoutAccount(); expect(mock.logout).toHaveBeenCalledWith({ scope: 'local' });
    expect(localStorage.getItem('machiTakarabakoActiveAdventure')).toBe('preserved');
    mock.logout.mockResolvedValue({ error: new Error('offline') });
    await expect(auth.logoutAccount()).rejects.toThrow('ログアウトできません');
  });
  it('only accepts HTTPS Google profile image hosts', async () => {
    const { googleAvatar } = await import('./accountAuth');
    expect(googleAvatar('https://lh3.googleusercontent.com/a')).toBeTruthy();
    for (const url of ['http://lh3.googleusercontent.com/a','https://googleusercontent.com.evil.test/a','javascript:alert(1)',null]) expect(googleAvatar(url)).toBeUndefined();
  });
});
