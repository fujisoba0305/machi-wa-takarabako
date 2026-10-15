// @vitest-environment jsdom
import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { getNearbyParks, getNearbyRestaurants } from './services/overpass';
import { getWalkingDistances } from './services/walkingDistance';
import { navigateAdventureMap } from './features/googleMaps';
import { resetStaticFacilityCache } from './services/staticFacilities';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { incrementTreasureDiscovery } from './services/treasures';
import { submitTreasureRating } from './services/treasureRatings';
import { getTreasures } from './services/treasures';

vi.mock('./services/overpass', () => ({ getNearbyParks: vi.fn(), getNearbyRestaurants: vi.fn() }));
vi.mock('./services/walkingDistance', () => ({ getWalkingDistances: vi.fn() }));
vi.mock('./services/treasures', () => ({ getTreasures: vi.fn(), createTreasure: vi.fn(), incrementTreasureDiscovery: vi.fn() }));
vi.mock('./services/treasureRatings', () => ({ getTreasureRatingSummary: vi.fn().mockResolvedValue({ averageRating: 0, ratingCount: 0 }), getTreasureRatingSummaries: vi.fn().mockResolvedValue({}), submitTreasureRating: vi.fn() }));
vi.mock('./components/TreasureCollection', () => ({ TreasureCollection: () => <div>図鑑</div> }));
vi.mock('./features/googleMaps', async importOriginal => ({ ...await importOriginal<typeof import('./features/googleMaps')>(), navigateAdventureMap: vi.fn() }));
let latitude=35.681236, longitude=139.767125;
let root: Root; let container: HTMLDivElement;
const spot = { type: 'node', id: 9, lat: 35.007, lon: 139, tags: { name: 'テストの公園' } };
function button(label: string) {
  const b = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === label || b.getAttribute('aria-label') === label);
  if (!b) throw Error('Missing button: ' + label);
  return b;
}
async function click(label: string) { await act(async () => button(label).click()); }
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function enterGacha(distance = '1km', mood = '公園・自然', genre = '') {
  await act(async () => root.render(<App />));
  await act(async () => Simulate.change(container.querySelector('input')!, { target: { value: '冒険者' } } as never));
  await act(async () => Simulate.submit(container.querySelector('form')!));
  await click(mood); await click(distance); if (genre) await click(genre);
  const coin = container.querySelector<HTMLButtonElement>('.adventure-coin-button')!;
  expect(coin.disabled).toBe(false); await act(async () => coin.click()); await click('ガチャを回しに行こう！');
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear();
  vi.stubEnv('DEV', true); vi.stubEnv('VITE_LOCAL_STATIC_SEARCH', 'on'); resetStaticFacilityCache();
  latitude=35.681236; longitude=139.767125;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => { if(!url.startsWith('/facilities-local-v1/')) throw Error('Forbidden external API '+url); return { ok:true, json:async()=>JSON.parse(readFileSync(resolve(process.cwd(),'public',url.slice(1)),'utf8')) }; }));
  vi.mocked(incrementTreasureDiscovery).mockResolvedValue(1);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('alert', vi.fn());
  window.scrollTo = vi.fn();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(success: PositionCallback) { success({ coords: { latitude, longitude, accuracy: 10 }, timestamp: Date.now() } as GeolocationPosition); } } });
  vi.mocked(getNearbyRestaurants).mockResolvedValue([]);
  vi.mocked(getNearbyParks).mockResolvedValue([spot]); vi.mocked(getTreasures).mockResolvedValue([]);
  vi.mocked(getWalkingDistances).mockImplementation(async (_, destinations) => destinations.map(d => ({ id: d.id, status: 'OK', distanceMeters: 900 })));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetStaticFacilityCache(); });

async function revealStatic(mood = '公園・自然') {
  await enterGacha('？km', mood); await click('ガチャのハンドルを回す'); await advance(4000); await advance(1500);
}
async function startAndArrive() {
  await click('ここへ行く');
  const a = JSON.parse(localStorage.getItem('machiTakarabakoActiveAdventure')!);
  expect(a.departureWalkingDistanceMeters).toBeNull();
  expect(navigateAdventureMap).toHaveBeenCalledWith(a.departure, a.target);
  latitude = a.target.latitude; longitude = a.target.longitude;
  await click('到着した！');
  return a;
}
it('integrates actual static normal destination through gacha/start/GPS/20EXP/reload without Routes', async () => {
  vi.stubEnv('DEV', false);
  await revealStatic(); expect(container.querySelector('.result-screen')).not.toBeNull();
  expect(getNearbyParks).not.toHaveBeenCalled(); expect(getWalkingDistances).not.toHaveBeenCalled();
  await startAndArrive(); expect(localStorage.getItem('machiTakarabakoExp')).toBe('20');
  expect(container.textContent).toContain('やったー！'); expect(getWalkingDistances).not.toHaveBeenCalled();
  await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(<App />));
  expect(localStorage.getItem('machiTakarabakoExp')).toBe('20');
});
it('selects registered treasure via 50% branch and preserves 30EXP/discovery/rating without Routes', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(.1);
  vi.mocked(getTreasures).mockResolvedValue([{ id: 7, name: '人工の登録宝物', category: '🌳 自然', latitude, longitude, comment: '', image_url: null }]);
  await revealStatic(); expect(container.textContent).toContain('人工の登録宝物');
  await startAndArrive(); expect(localStorage.getItem('machiTakarabakoExp')).toBe('30');
  expect(incrementTreasureDiscovery).toHaveBeenCalledOnce(); expect(getWalkingDistances).not.toHaveBeenCalled();
  expect(container.textContent).toContain('評価');
  vi.mocked(submitTreasureRating).mockResolvedValueOnce({ averageRating: 5, ratingCount: 1 });
  await click('この宝物を評価する');
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="5つ星"]')!.click());
  await click('評価を送信する'); expect(submitTreasureRating).toHaveBeenCalledWith(7, 5);
  expect(localStorage.getItem('machiTakarabakoExp')).toBe('30');
});
it('keeps data failure distinct and does not fall back to public API', async () => {
  vi.mocked(fetch).mockRejectedValue(Error('local asset unavailable'));
  await revealStatic(); expect(container.textContent).toContain('施設データを読み込めませんでした');
  expect(getNearbyParks).not.toHaveBeenCalled(); expect(getWalkingDistances).not.toHaveBeenCalled();
  expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
});
it('keeps fixed-distance search on existing path and walking confirmation', async () => {
  vi.mocked(getNearbyParks).mockResolvedValue([{ ...spot, lat: latitude + .007, lon: longitude }]);
  await enterGacha('1km'); await click('ガチャのハンドルを回す'); await advance(4000); await advance(1500);
  expect(getNearbyParks).toHaveBeenCalledOnce(); expect(getWalkingDistances).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});
it('explicit off switch restores the original random-distance provider', async () => {
  vi.stubEnv('VITE_LOCAL_STATIC_SEARCH', 'off');
  vi.mocked(getNearbyParks).mockResolvedValue([{ ...spot, lat: latitude + .007, lon: longitude }]);
  await revealStatic(); expect(getNearbyParks).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
  expect(getWalkingDistances).not.toHaveBeenCalled();
});
it.each([
  ['カフェ', ''], ['グルメ', '和食'], ['神社・お寺', '御朱印巡り'],
  ['公園・自然', ''], ['景色・写真', ''], ['おまかせ', ''],
])('Tokyo local screen selects %s from actual static data', async (mood, genre) => {
  await enterGacha('？km', mood, genre); await click('ガチャのハンドルを回す'); await advance(4000); await advance(1500);
  expect(container.querySelector('.result-screen')).not.toBeNull();
  expect(getNearbyParks).not.toHaveBeenCalled(); expect(getNearbyRestaurants).not.toHaveBeenCalled(); expect(getWalkingDistances).not.toHaveBeenCalled();
});

// These regressions run after a restored Google session; no live auth or GPS service is contacted.
vi.mock('./services/accountAuth', () => ({
 isAccountPage: () => false, initializeAccount: async () => {}, loginWithGoogle: vi.fn(), logoutAccount: vi.fn(), googleAvatar: () => undefined,
 getAccountClient: () => ({auth: {getSession: async () => ({data: {session: {user: {id: 'regression-account', user_metadata: {}}, expires_at: Date.now()/1000+3600}}, error: null}), onAuthStateChange: () => ({data: {subscription: {unsubscribe: vi.fn()}}})}}),
}));
