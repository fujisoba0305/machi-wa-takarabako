import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DateAdventureSession, DATE_ADVENTURE_KEY, loadDateAdventure, type DateAdventure } from './dateAdventure';

const result: DateAdventure['result'] = {
  waypoint: { type: 'node', id: 1, lat: 35, lon: 139, tags: { name: 'パン屋', shop: 'bakery' } },
  final: { type: 'node', id: 2, lat: 35.005, lon: 139, tags: { name: '喫茶店', amenity: 'cafe' } },
  choices: { mood: 'デート', dateGenre: '食べ歩き', distance: '？km' }, distanceKm: 1, playerName: '検証',
};
function memory() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } };
}
let requests: { success: PositionCallback; failure: PositionErrorCallback; options: PositionOptions }[];
function respond(lat = 35, accuracy = 10, timestamp = Date.now()) {
  requests.at(-1)!.success({ coords: { latitude: lat, longitude: 139, accuracy }, timestamp } as GeolocationPosition);
}
async function start() {
  const storage = memory(), session = new DateAdventureSession(storage);
  const promise = session.start(result); respond(34.99); await promise;
  return { storage, session };
}
async function arrive(session: DateAdventureSession, stage: 'waypoint' | 'final', lat: number, accuracy = 10) {
  const promise = session.arrive(stage, session.current?.id); respond(lat, accuracy); return promise;
}
beforeEach(() => {
  requests = [];
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (success: PositionCallback, failure: PositionErrorCallback, options: PositionOptions) => requests.push({ success, failure, options }) } });
});
afterEach(() => vi.unstubAllGlobals());
it('blocks arrivals before starting and final before verified waypoint', async () => {
  const { session, storage } = await start();
  expect(await new DateAdventureSession(memory()).arrive('waypoint', undefined)).toContain('始めよう');
  expect(await session.arrive('final', session.current?.id)).toContain('先に経由地');
  expect(requests).toHaveLength(1); expect(storage.getItem('machiTakarabakoExp')).toBeNull();
});
it.each(['denied', 'accuracy', 'stale'])('cannot start or save a date when departure GPS is %s', async reason => {
  const storage = memory(), session = new DateAdventureSession(storage);
  const pending = session.start(result);
  const rejection = expect(pending).rejects.toThrow();
  if (reason === 'denied') requests.at(-1)!.failure({ code: 1 } as GeolocationPositionError);
  else respond(35, reason === 'accuracy' ? 51 : 10, reason === 'stale' ? Date.now() - 31_000 : Date.now());
  await rejection; expect(session.current).toBeNull(); expect(storage.getItem(DATE_ADVENTURE_KEY)).toBeNull();
});
it('persists frozen targets and preserves the original departure on navigation restart', async () => {
  const { session, storage } = await start(), before = session.current;
  expect(await session.start(result)).toEqual(before); expect(requests).toHaveLength(1);
  expect(requests[0].options).toEqual({ maximumAge: 0, enableHighAccuracy: true, timeout: 10000 });
  expect(new DateAdventureSession(storage).current).toEqual(before);
});
it.each(['waypoint', 'final'] as const)('unmoved player cannot complete %s', async stage => {
  const { session, storage } = await start();
  if (stage === 'final') await arrive(session, 'waypoint', 35);
  expect(await arrive(session, stage, stage === 'waypoint' ? 34.99 : 35)).toContain('あと約');
  expect(session.current?.rewardClaimed).toBe(false); expect(storage.getItem('machiTakarabakoExp')).toBeNull();
  if (stage === 'waypoint') expect(session.current?.waypointArrival).toBeUndefined();
});
it.each([1, 2, 3])('permission/unavailable/timeout error %s remains retryable', async code => {
  const { session } = await start(); const p = session.arrive('waypoint', session.current?.id);
  requests.at(-1)!.failure({ code } as GeolocationPositionError);
  expect(await p).toContain('位置情報の許可'); expect(session.current?.waypointArrival).toBeUndefined();
  expect(await arrive(session, 'waypoint', 35)).toContain('確認しました');
});
it.each(['waypoint', 'final'] as const)('poor precision never expands %s arrival radius', async stage => {
  const { session } = await start(); if (stage === 'final') await arrive(session, 'waypoint', 35);
  expect(await arrive(session, stage, stage === 'waypoint' ? 35 : 35.005, 51)).toContain('正確');
  expect(session.current?.rewardClaimed).toBe(false);
  expect(await arrive(session, stage, stage === 'waypoint' ? 35 : 35.005, 50)).toContain('確認しました');
});
it('rejects stale GPS results', async () => {
  const { session } = await start(); const p = session.arrive('waypoint', session.current?.id);
  respond(35, 10, Date.now() - 31_000); expect(await p).toContain('新しい現在地');
  expect(session.current?.waypointArrival).toBeUndefined();
});
it('rewards only verified final, once across repeat taps, reloads and Safari return', async () => {
  const { session, storage } = await start();
  await arrive(session, 'waypoint', 35); expect(storage.getItem('machiTakarabakoExp')).toBeNull();
  const restored = new DateAdventureSession(storage);
  expect(restored.current?.waypointArrival).toBeDefined();
  const p = restored.arrive('final', restored.current?.id);
  expect(await restored.arrive('final', restored.current?.id)).toBe(''); respond(35.005); await p;
  expect(storage.getItem('machiTakarabakoExp')).toBe('50'); expect(storage.getItem('machiTakarabakoAdventureCount')).toBe('1');
  const reloaded = new DateAdventureSession(storage);
  expect(await reloaded.arrive('final', reloaded.current?.id)).toContain('取得済み');
  expect(storage.getItem('machiTakarabakoExp')).toBe('50');
  storage.setItem('machiTakarabakoExp', '70'); new DateAdventureSession(storage);
  expect(storage.getItem('machiTakarabakoExp')).toBe('70');
});
it('ignores old GPS after navigation cancellation or a new adventure', async () => {
  const { session, storage } = await start(); const p = session.arrive('waypoint', session.current?.id);
  session.reset(); respond(35); expect(await p).toBe(''); expect(loadDateAdventure(storage)).toBeNull();
});
it('does not persist or reward if the completion journal cannot be written', async () => {
  const { session, storage } = await start(); await arrive(session, 'waypoint', 35);
  vi.spyOn(storage, 'setItem').mockImplementation(() => { throw Error('保存できません'); });
  expect(await arrive(session, 'final', 35.005)).toContain('保存できません');
  expect(session.current?.rewardClaimed).toBe(false); expect(storage.getItem('machiTakarabakoExp')).toBeNull();
});
it('recovers an interrupted legacy reward write without adding another reward', async () => {
  const { session, storage } = await start(); await arrive(session, 'waypoint', 35);
  const original = storage.setItem;
  const spy = vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
    if (key === 'machiTakarabakoAdventureCount') throw Error('保存中断'); original(key, value);
  });
  await arrive(session, 'final', 35.005); expect(session.current?.rewardClaimed).toBe(true);
  expect(storage.getItem('machiTakarabakoExp')).toBe('50'); spy.mockRestore();
  new DateAdventureSession(storage); new DateAdventureSession(storage);
  expect(storage.getItem('machiTakarabakoExp')).toBe('50'); expect(storage.getItem('machiTakarabakoAdventureCount')).toBe('1');
});
it('rejects saved progress without valid GPS proof and does not reuse normal adventure keys', async () => {
  const { session, storage } = await start(); storage.setItem('machiTakarabakoActiveAdventure', 'unchanged');
  storage.setItem(DATE_ADVENTURE_KEY, JSON.stringify({ ...session.current, waypointArrival: { latitude: 34, longitude: 139, accuracy: 10, timestamp: Date.now() } }));
  expect(loadDateAdventure(storage)).toBeNull(); expect(storage.getItem('machiTakarabakoActiveAdventure')).toBe('unchanged');
});
it('rejects a cached claim from another session before applying any new reward', async () => {
  const { session, storage } = await start(); await arrive(session, 'waypoint', 35);
  const other = new DateAdventureSession(storage);
  await arrive(session, 'final', 35.005);
  await arrive(other, 'final', 35.005);
  expect(storage.getItem('machiTakarabakoExp')).toBe('50');
  expect(storage.getItem('machiTakarabakoAdventureCount')).toBe('1');
});
it('does not discard the reward journal while its legacy counters cannot be recovered', async () => {
  const { session, storage } = await start(); await arrive(session, 'waypoint', 35); await arrive(session, 'final', 35.005);
  vi.spyOn(storage, 'setItem').mockImplementation(() => { throw Error('保存中断'); });
  expect(() => session.reset()).toThrow('保存'); expect(loadDateAdventure(storage)?.rewardClaimed).toBe(true);
});
