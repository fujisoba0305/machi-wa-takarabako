import { afterEach, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('reproduces the observed 51-second Overpass failure without real communication', async () => {
  vi.useFakeTimers(); vi.resetModules();
  const { default: handler } = await import('../../api/overpass');
  const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Error('timeout')))));
  vi.stubGlobal('fetch', fetchMock);
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() }; res.status.mockReturnValue(res);
  const started = Date.now();
  const pending = handler({ method: 'POST', body: { query: 'test' } } as VercelRequest, res as unknown as VercelResponse);
  await vi.advanceTimersByTimeAsync(50999); expect(res.json).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); await pending;
  expect(Date.now()-started).toBe(51000); expect(fetchMock).toHaveBeenCalledTimes(2); expect(res.status).toHaveBeenCalledWith(500);
});
