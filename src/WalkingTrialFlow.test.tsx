// @vitest-environment jsdom
import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { searchWalkingTrial } from './services/walkingTrial';
vi.mock('./components/WalkingTrialControls',()=>({WalkingTrialControls:({onChange}: {onChange:(v:boolean)=>void})=><button onClick={()=>onChange(true)}>試験版ON</button>}));
vi.mock('./services/walkingTrial',()=>({withWalkingTrialDeadline:(p:Promise<unknown>)=>p,searchWalkingTrial:vi.fn(),cancelWalkingTrial:vi.fn(),matchesTrialScope:(c:{distance:string;mood:string})=>['1km'].includes(c.distance)&&c.mood!=='デート'}));
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
async function enterGacha(distance = '1km', mood = '公園・自然', genre = '', trial = true) {
  await act(async () => root.render(<App />));
  await act(async () => Simulate.change(container.querySelector('input')!, { target: { value: '冒険者' } } as never));
  await act(async () => Simulate.submit(container.querySelector('form')!));
  await click(mood); await click(distance); if (genre) await click(genre);if(trial)await click('試験版ON');
  const coin = container.querySelector<HTMLButtonElement>('.adventure-coin-button')!;
  expect(coin.disabled).toBe(false); await act(async () => coin.click()); await click('ガチャを回しに行こう！');
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear();
  vi.stubEnv('DEV', true); vi.stubEnv('VITE_LOCAL_STATIC_SEARCH', 'on'); resetStaticFacilityCache();
  latitude=35.681236; longitude=139.767125;
  vi.mocked(searchWalkingTrial).mockResolvedValue({spot:{type:'node',id:123,lat:latitude+.01,lon:longitude,tags:{name:'試験用目的地'}},treasure:null,distance:{roadMeters:1100,estimated:true,origin:'unknown',quality:'block-estimate'},report:'徒歩検索・試験版：施設到達未確認'});
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

it.each(['1km'])('試験版%sは既存演出後にOSM検索だけを呼び推定表示する',async distance=>{
 await enterGacha(distance);await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);
 expect(searchWalkingTrial).toHaveBeenCalledOnce();expect(vi.mocked(searchWalkingTrial).mock.calls[0][1].distance).toBe(distance);
 expect(getNearbyParks).not.toHaveBeenCalled();expect(getWalkingDistances).not.toHaveBeenCalled();
 expect(container.textContent).toContain('推定徒歩距離');expect(container.textContent).toContain('施設到達未確認');
});
it('試験版の開始・遠方拒否・GPS到着・20EXP・再読込をRoutesなしで維持',async()=>{
 await enterGacha();await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);await click('ここへ行く');
 const a=JSON.parse(localStorage.getItem('machiTakarabakoActiveAdventure')!);expect(a.result.walkingTrial.estimated).toBe(true);expect(a.target.latitude).toBeCloseTo(35.691236,8);expect(a.departureWalkingDistanceMeters).toBeNull();expect(navigateAdventureMap).toHaveBeenCalled();
 await click('到着した！');expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
 latitude=a.target.latitude;longitude=a.target.longitude;await click('到着した！');expect(localStorage.getItem('machiTakarabakoExp')).toBe('20');expect(getWalkingDistances).not.toHaveBeenCalled();
 await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(<App/>));expect(localStorage.getItem('machiTakarabakoExp')).toBe('20');expect(container.textContent).toContain('検索時の推定徒歩距離');
});
it('試験版の登録宝物も30EXP・発見・評価を維持',async()=>{
 const treasure={id:7,name:'試験用登録宝物',category:'🌳 自然',latitude:latitude+.01,longitude,comment:'',image_url:null};
 vi.mocked(searchWalkingTrial).mockResolvedValue({spot:null,treasure,distance:{roadMeters:1100,estimated:true,origin:'unknown',quality:'mapped-walk-connection'},report:'施設到達未確認'});
 await enterGacha();await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);await startAndArrive();expect(localStorage.getItem('machiTakarabakoExp')).toBe('30');expect(incrementTreasureDiscovery).toHaveBeenCalledOnce();await click('この宝物を評価する');expect(container.textContent).toContain('評価');expect(getWalkingDistances).not.toHaveBeenCalled();
});
it('候補0件・通信障害は既存APIへ自動移行せず報酬も付与しない',async()=>{
 vi.mocked(searchWalkingTrial).mockResolvedValue(null);await enterGacha();await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);expect(container.textContent).toContain('条件は変更していません');expect(getWalkingDistances).not.toHaveBeenCalled();expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
});
it('試験版ONでも？kmは既存静的検索を維持',async()=>{
 await enterGacha('？km');await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);expect(searchWalkingTrial).not.toHaveBeenCalled();expect(getNearbyParks).not.toHaveBeenCalled();expect(getWalkingDistances).not.toHaveBeenCalled();
});

it('試験版の通信失敗は理由を表示し、既存検索に自動移行しない',async()=>{vi.mocked(searchWalkingTrial).mockRejectedValue(Error('道路データ読込で失敗しました。再試行してください。'));await enterGacha();await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);expect(container.textContent).toContain('道路データ読込で失敗');expect(getNearbyParks).not.toHaveBeenCalled();expect(getWalkingDistances).not.toHaveBeenCalled();expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');});

for(const distance of ['3km','5km','10km'])it('初期試験ONでも'+distance+'は従来経路',async()=>{await enterGacha(distance);await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);expect(searchWalkingTrial).not.toHaveBeenCalled();expect(getNearbyParks).toHaveBeenCalled();});
it('試験OFFなら1kmも従来経路',async()=>{await enterGacha('1km','公園・自然','',false);await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);expect(searchWalkingTrial).not.toHaveBeenCalled();expect(getNearbyParks).toHaveBeenCalled();});
it('検索中に中止しても報酬を付与せず条件画面へ戻る',async()=>{vi.mocked(searchWalkingTrial).mockImplementation(()=>new Promise(()=>{}));await enterGacha();await click('ガチャのハンドルを回す');await advance(4000);await click('検索を中止して条件画面へ');expect(container.textContent).toContain('冒険コインを作る');expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');});

// These regressions run after a restored Google session; no live auth or GPS service is contacted.
vi.mock('./services/accountAuth', () => ({
 isAccountPage: () => false, initializeAccount: async () => {}, loginWithGoogle: vi.fn(), logoutAccount: vi.fn(), googleAvatar: () => undefined,
 getAccountClient: () => ({auth: {getSession: async () => ({data: {session: {user: {id: 'regression-account', user_metadata: {}}, expires_at: Date.now()/1000+3600}}, error: null}), onAuthStateChange: () => ({data: {subscription: {unsubscribe: vi.fn()}}})}}),
}));
