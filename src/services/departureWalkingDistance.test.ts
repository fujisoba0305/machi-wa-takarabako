import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDepartureWalkingDistance } from './departureWalkingDistance';
const departure = { latitude: 35, longitude: 139, accuracy: 10, timestamp: Date.now() };
const target = { kind: 'normal' as const, id: 'node:1', latitude: 35.01, longitude: 139 };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('departure walking route', () => {
  it('requests the route from the new departure and keeps meters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ id: 'destination', status: 'OK', distanceMeters: 1234 }] }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await getDepartureWalkingDistance(departure, target)).toBe(1234);
    expect(fetchMock).toHaveBeenCalledWith('/api/walking-distance', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ origin: departure, destinations: [{ latitude: target.latitude, longitude: target.longitude }] });
  });
  it.each([null, -1, '1234'])('uses no guessed straight-line distance for invalid route %s', async distanceMeters => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ id: 'destination', status: 'OK', distanceMeters }] }) }));
    expect(await getDepartureWalkingDistance(departure, target)).toBeNull();
  });
  it('aborts a slow route request after ten seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    })));
    const request = getDepartureWalkingDistance(departure, target);
    await vi.advanceTimersByTimeAsync(10000);
    expect(await request).toBeNull();
  });
});
