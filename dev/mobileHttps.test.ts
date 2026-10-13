import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSecureContext } from 'node:tls';
import { mobileHttps } from './mobileHttps';
vi.mock('node:fs', () => ({ readFileSync: vi.fn() }));
vi.mock('node:tls', () => ({ createSecureContext: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); });
describe('opt-in mobile HTTPS', () => {
  it('keeps normal development unchanged and ignores HTTPS in production builds', () => {
    expect(mobileHttps('serve', {})).toEqual({});
    expect(mobileHttps('build', { MACHI_DEV_HTTPS_CERT: 'private-cert' })).toEqual({});
    expect(readFileSync).not.toHaveBeenCalled();
  });
  it('requires both files without silent HTTP fallback', () => {
    expect(() => mobileHttps('serve', { MACHI_DEV_HTTPS_KEY: 'secret-key-path' })).toThrow('両方');
    expect(readFileSync).not.toHaveBeenCalled();
  });
  it('loads and validates a matching pair before LAN binding', () => {
    const cert = Buffer.from('test-cert'), key = Buffer.from('test-key');
    vi.mocked(readFileSync).mockReturnValueOnce(cert).mockReturnValueOnce(key);
    expect(mobileHttps('serve', { MACHI_DEV_HTTPS_CERT: 'cert', MACHI_DEV_HTTPS_KEY: 'key' })).toEqual({ host: '0.0.0.0', https: { cert, key } });
    expect(createSecureContext).toHaveBeenCalledWith({ cert, key });
  });
  it('rejects invalid certificates without leaking paths or keys', () => {
    vi.mocked(readFileSync).mockReturnValue(Buffer.from('test'));
    vi.mocked(createSecureContext).mockImplementation(() => { throw new Error('secret-key-path'); });
    expect(() => mobileHttps('serve', { MACHI_DEV_HTTPS_CERT: 'cert', MACHI_DEV_HTTPS_KEY: 'key' })).toThrow('HTTPへ自動切替しません');
    try { mobileHttps('serve', { MACHI_DEV_HTTPS_CERT: 'cert', MACHI_DEV_HTTPS_KEY: 'key' }); } catch (error) { expect(String(error)).not.toContain('secret-key-path'); }
  });
});
