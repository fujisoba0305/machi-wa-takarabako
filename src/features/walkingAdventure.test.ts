import { describe, expect, it } from 'vitest';
import { AdventureSession, type PositionFix } from './activeAdventure';
import { adventureReturnScreen, adventureRestoreScreen, walkingDestination } from './walkingAdventure';
function storage() {
 const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
const target = { kind: 'normal' as const, id: 'node:1', latitude: 35, longitude: 139 };
const result = { spot: { type: 'node', id: 1, lat: 35, lon: 139 }, treasure: null, choices: { mood: '自然' }, distanceKm: 0.8 };
const fix: PositionFix = { latitude: 35, longitude: 139, accuracy: 10, timestamp: Date.now() };
describe('walking adventure lifecycle', () => {
 it('saves departure route once and restores without changing the start', async () => {
   const saved = storage(); const session = new AdventureSession(saved, async () => fix);
   let calls = 0;
   const measure = async () => { calls++; return 1234; };
   const started = await session.start(target, result, measure);
   const reloaded = new AdventureSession(saved, async () => fix);
   expect(await reloaded.start(target, result, measure)).toEqual(started);
   expect(calls).toBe(1); expect(started?.departureWalkingDistanceMeters).toBe(1234);
   expect(adventureRestoreScreen(reloaded.current)).toBe('walking');
   expect(adventureReturnScreen(reloaded.current)).toBe('walking');
 });
 it('allows walking when route lookup fails, without mislabelling straight-line distance', async () => {
   const session = new AdventureSession(storage(), async () => fix);
   const started = await session.start(target, result, async () => { throw Error('offline'); });
   expect(walkingDestination(started!).distanceLabel).toContain('取得できません');
   expect(started?.rewardClaimed).toBe(false);
 });
 it('does not restore walking after completed reward or without an adventure', async () => {
   const session = new AdventureSession(storage(), async () => fix);
   await session.start(target, result); await session.arrive(target, () => {});
   expect(adventureRestoreScreen(session.current)).toBe('arrival');
   expect(adventureReturnScreen(session.current)).toBe('home');
   expect(adventureReturnScreen(null)).toBe('home');
 });
 it('ignores an old route result after starting another search', async () => {
   const session = new AdventureSession(storage(), async () => fix);
   let resolve!: (meters: number) => void;
   const pending = session.start(target, result, () => new Promise<number>(r => { resolve = r; }));
   await Promise.resolve(); session.reset(); resolve(1234);
   expect(await pending).toBeNull(); expect(session.current).toBeNull();
 });
});
