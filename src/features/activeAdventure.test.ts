import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_ADVENTURE_KEY, AdventureSession, arrivalDistanceMeters, loadActiveAdventure,
  type AdventureResult, type AdventureTarget } from './activeAdventure';
import { claimNormalArrivalOnce, getNormalArrivalRewardExp } from './normalArrivalReward';
import { recordArrivedTreasure } from './adventureHistory';
import { canRateTreasure } from './treasureRatings';

const target: AdventureTarget = { kind: 'normal', id: 'node:1', latitude: 35, longitude: 139 };
const result: AdventureResult = { spot: { type: 'node', id: 1, lat: 35, lon: 139, tags: { name: '公園' } },
  treasure: null, choices: { mood: '自然', distance: '1km' }, distanceKm: 1 };
function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
}
let requests: { success: PositionCallback; failure: PositionErrorCallback | null; options?: PositionOptions }[];
function position(latitude = 35, accuracy = 10, timestamp = Date.now()): GeolocationPosition {
  return { coords: { latitude, longitude: 139, accuracy }, timestamp } as GeolocationPosition;
}
function respond(latitude = 35, accuracy = 10, timestamp = Date.now()) {
  requests[requests.length - 1]!.success(position(latitude, accuracy, timestamp));
}
async function started(storage = memoryStorage()) {
  const session = new AdventureSession(storage);
  const pending = session.start(target, result);
  respond(34.99);
  await pending;
  return { session, storage };
}
function rewardHarness() {
  const state = { exp: 0, count: 0, discoveryCount: 0, firstDiscoveredAt: '', ratingUnlocked: false };
  const claimed = { current: false };
  const reward = vi.fn((a: NonNullable<AdventureSession['current']>) => {
    if (!claimNormalArrivalOnce(claimed)) return;
    state.exp += getNormalArrivalRewardExp(a.target.kind === 'treasure');
    state.count++;
    if (a.target.kind === 'treasure') {
      state.discoveryCount++;
      state.firstDiscoveredAt = recordArrivedTreasure([], a.result.treasure, true)[0].firstDiscoveredAt;
      state.ratingUnlocked = canRateTreasure(a.result.treasure, true);
    }
  });
  return { state, reward };
}
beforeEach(() => {
  requests = [];
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn((success, failure, options) => {
    requests.push({ success, failure, options });
  }) } });
});
afterEach(() => vi.unstubAllGlobals());

describe('GPS adventure lifecycle', () => {
  it('does not request GPS or reward an adventure that has not started', async () => {
    const { reward } = rewardHarness();
    expect(await new AdventureSession(memoryStorage()).arrive(target, reward)).toContain('ここへ行く');
    expect(requests).toHaveLength(0); expect(reward).not.toHaveBeenCalled();
  });
  it('records a fresh departure and saves a fixed destination and display snapshot', async () => {
    const { session, storage } = await started();
    expect(requests[0].options).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    expect(session.current).toMatchObject({ target, departure: { latitude: 34.99, accuracy: 10 }, rewardClaimed: false, result });
    expect(loadActiveAdventure(storage)).toEqual(session.current);
  });
  it.each([1, 2, 3])('GPS error %s gives no reward and remains retryable', async code => {
    const { session } = await started(); const { reward } = rewardHarness();
    const pending = session.arrive(target, reward);
    requests[requests.length - 1]!.failure!({ code } as GeolocationPositionError);
    expect(await pending).toContain('取得できません');
    expect(reward).not.toHaveBeenCalled(); expect(session.current?.rewardClaimed).toBe(false);
    const retry = session.arrive(target, reward); respond(); await retry;
    expect(reward).toHaveBeenCalledOnce();
  });
  it('rejects inaccurate GPS without expanding the radius and allows retry', async () => {
    const { session } = await started(); const { reward } = rewardHarness();
    const pending = session.arrive(target, reward); respond(35, 51);
    expect(await pending).toContain('正確に'); expect(reward).not.toHaveBeenCalled();
    const retry = session.arrive(target, reward); respond(35, 50); await retry;
    expect(reward).toHaveBeenCalledOnce();
  });
  it('does not change any reward data beyond 100m', async () => {
    const { session } = await started(); const { reward, state } = rewardHarness();
    const pending = session.arrive(target, reward); respond(35.006);
    expect(await pending).toMatch(/あと約\d+m/); expect(reward).not.toHaveBeenCalled();
    expect(state).toEqual({ exp: 0, count: 0, discoveryCount: 0, firstDiscoveredAt: '', ratingUnlocked: false });
  });
  it.each([99.9, 100.1])('uses meters at the 100m boundary (%s m)', async meters => {
    const { session } = await started(); const { reward } = rewardHarness();
    const latitude = 35 + meters / (6371000 * Math.PI / 180);
    expect(arrivalDistanceMeters({ latitude, longitude: 139 }, target)).toBeCloseTo(meters, 5);
    const pending = session.arrive(target, reward); respond(latitude); await pending;
    expect(reward).toHaveBeenCalledTimes(meters < 100 ? 1 : 0);
  });
  it('awards a normal arrival exactly 20 EXP and one adventure', async () => {
    const { session } = await started(); const { reward, state } = rewardHarness();
    const pending = session.arrive(target, reward); respond(); await pending;
    expect(state.exp).toBe(20); expect(state.count).toBe(1); expect(state.discoveryCount).toBe(0);
    expect(session.current?.rewardClaimed).toBe(true); expect(session.current?.arrival).toBeDefined();
  });
  it('awards a registered treasure 30 EXP and unlocks treasure effects only after success', async () => {
    const session = new AdventureSession(memoryStorage()); const { reward, state } = rewardHarness();
    const treasureTarget: AdventureTarget = { ...target, kind: 'treasure', id: '7' };
    const start = session.start(treasureTarget, { ...result, spot: null, treasure: {
      id: 7, latitude: 35, longitude: 139, name: '宝物', comment: '', category: '💎 その他', image_url: null } });
    respond(34.99); await start;
    const far = session.arrive(treasureTarget, reward); respond(35.01); await far;
    expect(reward).not.toHaveBeenCalled();
    const arrival = session.arrive(treasureTarget, reward); respond(); await arrival;
    expect(state).toMatchObject({ exp: 30, count: 1, discoveryCount: 1, ratingUnlocked: true });
    expect(state.firstDiscoveredAt).not.toBe('');
  });
  it('locks rapid arrival clicks before GPS resolves and after completion', async () => {
    const { session } = await started(); const { reward } = rewardHarness();
    const first = session.arrive(target, reward);
    await session.arrive(target, reward); expect(requests).toHaveLength(2);
    respond(); await first; await session.arrive(target, reward);
    expect(reward).toHaveBeenCalledOnce(); expect(requests).toHaveLength(2);
  });
  it('ignores an old arrival result after a new search/adventure', async () => {
    const { session } = await started(); const { reward } = rewardHarness();
    const old = session.arrive(target, reward); const oldRequest = requests[requests.length - 1]!;
    session.reset(); const next = session.start({ ...target, id: 'node:2' }, { ...result, spot: { ...result.spot!, id: 2 } });
    respond(34.98); await next; const newId = session.current!.id;
    oldRequest.success(position()); expect(await old).toBe('');
    expect(reward).not.toHaveBeenCalled(); expect(session.current?.id).toBe(newId);
    expect(session.current?.rewardClaimed).toBe(false);
  });
  it('ignores departure GPS that resolves after cancellation', async () => {
    const storage = memoryStorage(); const session = new AdventureSession(storage);
    const pending = session.start(target, result); session.reset(); respond();
    expect(await pending).toBeNull(); expect(loadActiveAdventure(storage)).toBeNull();
  });
  it('rejects a mismatched target without requesting arrival GPS', async () => {
    const { session } = await started(); const { reward } = rewardHarness();
    await session.arrive({ ...target, latitude: 36 }, reward);
    expect(reward).not.toHaveBeenCalled(); expect(requests).toHaveLength(1);
  });
  it('restores an active adventure after reload and can finish it', async () => {
    const { session, storage } = await started();
    const reloaded = new AdventureSession(storage); expect(reloaded.current).toEqual(session.current);
    const { reward } = rewardHarness(); const pending = reloaded.arrive(target, reward); respond(); await pending;
    expect(reward).toHaveBeenCalledOnce();
    const completedReload = new AdventureSession(storage);
    await completedReload.arrive(target, reward); expect(reward).toHaveBeenCalledOnce();
  });
  it('reopening Maps preserves the adventure ID, departure, and start time, including after reload', async () => {
    const { session, storage } = await started(); const original = session.current;
    expect(await session.start(target, result)).toEqual(original);
    expect(await new AdventureSession(storage).start(target, result)).toEqual(original);
    expect(requests).toHaveLength(1);
  });
  it('allows a newly drawn visit to the same place after reset', async () => {
    const { session } = await started(); const oldId = session.current!.id;
    session.reset(); const next = session.start(target, result); respond(); await next;
    expect(session.current?.id).not.toBe(oldId); expect(session.current?.rewardClaimed).toBe(false);
  });
  it('does not start an adventure when departure GPS is inaccurate', async () => {
    const storage = memoryStorage(); const session = new AdventureSession(storage);
    const pending = session.start(target, result); respond(35, 70);
    await expect(pending).rejects.toThrow('正確に'); expect(loadActiveAdventure(storage)).toBeNull();
  });
  it('rejects stale position timestamps', async () => {
    const { session } = await started(); const { reward } = rewardHarness();
    const pending = session.arrive(target, reward); respond(35, 10, Date.now() - 60000);
    expect(await pending).toContain('新しい現在地'); expect(reward).not.toHaveBeenCalled();
  });
  it('does not reward if completion cannot be persisted', async () => {
    const { session, storage } = await started(); const { reward } = rewardHarness();
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw Error('quota'); });
    const pending = session.arrive(target, reward); respond();
    expect(await pending).toContain('保存できません'); expect(reward).not.toHaveBeenCalled();
    expect(session.current?.rewardClaimed).toBe(false);
  });

  it('locks rapid departure clicks without replacing the first departure', async () => {
    const session = new AdventureSession(memoryStorage());
    const first = session.start(target, result);
    expect(await session.start(target, result)).toBeNull(); expect(requests).toHaveLength(1);
    respond(34.99); const adventure = await first;
    expect(await session.start(target, result)).toEqual(adventure); expect(requests).toHaveLength(1);
  });
  it('does not save a departure when GPS permission is denied', async () => {
    const storage = memoryStorage(); const session = new AdventureSession(storage);
    const pending = session.start(target, result);
    requests[0].failure!({ code: 1 } as GeolocationPositionError);
    await expect(pending).rejects.toThrow('取得できません'); expect(session.current).toBeNull();
    expect(loadActiveAdventure(storage)).toBeNull();
  });
  it('does not start if storage is unavailable', async () => {
    const storage = memoryStorage(); vi.spyOn(storage, 'setItem').mockImplementation(() => { throw Error('quota'); });
    const session = new AdventureSession(storage); const pending = session.start(target, result); respond();
    await expect(pending).rejects.toThrow('保存できません'); expect(session.current).toBeNull();
  });
  it('rejects GPS without Geolocation support', async () => {
    const { session } = await started(); const { reward } = rewardHarness();
    vi.stubGlobal('navigator', {});
    expect(await session.arrive(target, reward)).toContain('取得できません'); expect(reward).not.toHaveBeenCalled();
  });
  it('ignores arrival GPS when the user leaves the result screen', async () => {
    const { session } = await started(); const { reward } = rewardHarness();
    const pending = session.arrive(target, reward); session.cancelPending(); respond();
    expect(await pending).toBe(''); expect(reward).not.toHaveBeenCalled();
    expect(session.current?.rewardClaimed).toBe(false);
  });
  it('does not overwrite destination snapshots while GPS is pending', async () => {
    const session = new AdventureSession(memoryStorage());
    const mutableTarget = { ...target }; const mutableResult = { ...result, choices: { ...result.choices } };
    const pending = session.start(mutableTarget, mutableResult);
    mutableTarget.latitude = 36; mutableResult.choices.mood = 'デート';
    respond(); await pending;
    expect(session.current?.target.latitude).toBe(35); expect(session.current?.result.choices.mood).toBe('自然');
  });
  it('checks persisted completion before awarding from another restored session', async () => {
    const { session, storage } = await started(); const second = new AdventureSession(storage);
    const { reward } = rewardHarness(); const first = session.arrive(target, reward); respond(); await first;
    const nextReward = vi.fn(); const next = second.arrive(target, nextReward); respond();
    expect(await next).toContain('取得済み'); expect(nextReward).not.toHaveBeenCalled();
  });
  it('rejects corrupted destination data on reload', async () => {
    const { session, storage } = await started();
    storage.setItem(ACTIVE_ADVENTURE_KEY, JSON.stringify({ ...session.current,
      target: { ...target, latitude: 36 } }));
    expect(loadActiveAdventure(storage)).toBeNull();
  });

  it('safely ignores corrupt saved data', () => {
    const storage = memoryStorage(); storage.setItem(ACTIVE_ADVENTURE_KEY, '{bad');
    expect(loadActiveAdventure(storage)).toBeNull();
    storage.setItem(ACTIVE_ADVENTURE_KEY, JSON.stringify({ version: 1 }));
    expect(loadActiveAdventure(storage)).toBeNull();
  });
});
