// @vitest-environment jsdom
import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {searchApproximate} from './services/approximateSearch';
vi.mock('./services/approximateSearch',()=>({matchesApproximateScope:(c:{distance:string;mood:string})=>['1km','3km','5km','10km'].includes(c.distance)&&c.mood!=='デート',searchApproximate:vi.fn()}));
import { getNearbyParks, getNearbyRestaurants } from './services/overpass';
import { getWalkingDistances } from './services/walkingDistance';
import { getTreasures } from './services/treasures';

vi.mock('./services/overpass', () => ({ getNearbyParks: vi.fn(), getNearbyRestaurants: vi.fn() }));
vi.mock('./services/walkingDistance', () => ({ getWalkingDistances: vi.fn() }));
vi.mock('./services/treasures', () => ({ getTreasures: vi.fn(), createTreasure: vi.fn(), incrementTreasureDiscovery: vi.fn() }));
vi.mock('./services/treasureRatings', () => ({ getTreasureRatingSummary: vi.fn().mockResolvedValue({ averageRating: 0, ratingCount: 0 }), getTreasureRatingSummaries: vi.fn().mockResolvedValue({}), submitTreasureRating: vi.fn() }));
vi.mock('./components/TreasureCollection', () => ({ TreasureCollection: () => <div>図鑑</div> }));
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
  // Existing-provider regression tests; static integration has its own real-data suite.
  vi.stubEnv('VITE_LOCAL_STATIC_SEARCH', 'off');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('alert', vi.fn());
  window.scrollTo = vi.fn();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(success: PositionCallback) { success({ coords: { latitude: 35, longitude: 139, accuracy: 10 }, timestamp: Date.now() } as GeolocationPosition); } } });
  vi.mocked(searchApproximate).mockResolvedValue({spot,treasure:null,distanceKm:1.1,report:'直線距離検索'});
vi.mocked(getNearbyRestaurants).mockResolvedValue([]);
  vi.mocked(getNearbyParks).mockResolvedValue([spot]); vi.mocked(getTreasures).mockResolvedValue([]);
  vi.mocked(getWalkingDistances).mockImplementation(async (_, destinations) => destinations.map(d => ({ id: d.id, status: 'OK', distanceMeters: 900 })));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });


it.each(['1km','3km','5km','10km'])('standard %s keeps the animation and calls only straight search',async distance=>{
 await enterGacha(distance);expect(searchApproximate).toHaveBeenCalledOnce();await click('ガチャのハンドルを回す');await advance(1800);expect(container.querySelector('.result-screen')).toBeNull();await advance(2500);await advance(1500);expect(container.textContent).toContain('テストの公園');expect(container.textContent).toContain('現在地から直線距離');expect(getNearbyParks).not.toHaveBeenCalled();expect(getWalkingDistances).not.toHaveBeenCalled();expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
});
it('retains a selected registered treasure photo',async()=>{const treasure={id:7,name:'写真のある宝物',category:'🌳 自然',latitude:35.007,longitude:139,comment:'',image_url:'https://example.com/treasure.webp'};vi.mocked(searchApproximate).mockResolvedValue({spot:null,treasure,distanceKm:1.1,report:'直線距離検索'});await enterGacha();await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);expect(container.textContent).toContain(treasure.name);expect(container.querySelector('.gacha-treasure-result-image')?.getAttribute('src')).toBe(treasure.image_url);});
it('returns to unchanged conditions and retries a failed standard search without EXP',async()=>{vi.mocked(searchApproximate).mockRejectedValueOnce(Error('施設データを読み込めませんでした'));await enterGacha('3km');await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);expect(container.textContent).toContain('施設データを読み込めませんでした');await click('条件画面へ戻って再試行');expect(container.textContent).toContain('3km');await act(async()=>container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());await click('ガチャを回しに行こう！');await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);expect(container.textContent).toContain('テストの公園');expect(searchApproximate).toHaveBeenCalledTimes(2);expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');});
it('waits for a slow search independently of animation',async()=>{let done!:(v:any)=>void;vi.mocked(searchApproximate).mockImplementationOnce(()=>new Promise(r=>{done=r;}));await enterGacha();await click('ガチャのハンドルを回す');await advance(10000);expect(container.textContent).toContain('街の宝物を探しています');await act(async()=>done({spot,treasure:null,distanceKm:1.1,report:'直線距離検索'}));await advance(1500);await advance(1500);expect(container.textContent).toContain('テストの公園');});
it('ignores an old success after returning home',async()=>{let done!:(v:any)=>void;vi.mocked(searchApproximate).mockImplementationOnce(()=>new Promise(r=>{done=r;}));await enterGacha();await click('ガチャのハンドルを回す');await click('ホーム');done({spot:{...spot,tags:{name:'古い結果'}},treasure:null,distanceKm:1.1,report:'直線距離検索'});await advance(5000);expect(container.querySelector('.home-screen')).not.toBeNull();expect(container.textContent).not.toContain('古い結果');});
it('passes the selected ramen genre through without route calls',async()=>{await enterGacha('3km','グルメ','ラーメン');await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);expect(searchApproximate).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({distance:'3km',mood:'グルメ',foodGenre:'ラーメン'}),expect.any(Function),expect.anything());expect(getWalkingDistances).not.toHaveBeenCalled();});
it('preserves random-distance provider fallback and never calls straight search',async()=>{await enterGacha('？km');await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);expect(searchApproximate).not.toHaveBeenCalled();expect(getNearbyParks).toHaveBeenCalledWith(35,139,3000);expect(getWalkingDistances).not.toHaveBeenCalled();});
it('stops on GPS denial before any standard facility search',async()=>{await act(async()=>root.render(<App/>));await act(async()=>Simulate.change(container.querySelector('input')!,{target:{value:'冒険者'}} as never));await act(async()=>Simulate.submit(container.querySelector('form')!));await click('カフェ');await click('1km');Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(_s:PositionCallback,fail:PositionErrorCallback){fail({code:1} as GeolocationPositionError);}}});await act(async()=>container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());await click('ガチャを回しに行こう！');expect(searchApproximate).not.toHaveBeenCalled();expect(container.textContent).toContain('位置情報が許可');expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');});
// These regressions run after a restored Google session; no live auth or GPS service is contacted.
vi.mock('./services/accountAuth', () => ({
 isAccountPage: () => false, initializeAccount: async () => {}, loginWithGoogle: vi.fn(), logoutAccount: vi.fn(), googleAvatar: () => undefined,
 getAccountClient: () => ({auth: {getSession: async () => ({data: {session: {user: {id: 'regression-account', user_metadata: {}}, expires_at: Date.now()/1000+3600}}, error: null}), onAuthStateChange: () => ({data: {subscription: {unsubscribe: vi.fn()}}})}}),
}));
