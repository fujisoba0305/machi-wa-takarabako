// @vitest-environment jsdom
import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {searchApproximate} from './services/approximateSearch';
vi.mock('./services/approximateSearch',()=>({matchesApproximateScope:(c:{distance:string;mood:string})=>['1km','3km','5km','10km'].includes(c.distance)&&c.mood!=='デート',searchApproximate:vi.fn()}));
import { searchWalkingTrial } from './services/walkingTrial';
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
  await click(mood); await click(distance); if (genre) await click(genre);
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

beforeEach(()=>{vi.mocked(searchApproximate).mockResolvedValue({spot:{type:'node',id:123,lat:latitude+.01,lon:longitude,tags:{name:'直線試験カフェ'}},treasure:null,distanceKm:1.1,report:'直線距離・試験版'});});
it.each(['1km','3km','5km','10km'])('new trial %s uses no roads or walking API at search/start and preserves GPS rewards',async distance=>{
 await act(async()=>root.render(<App/>));await act(async()=>Simulate.change(container.querySelector('input')!,{target:{value:'冒険者'}} as never));await act(async()=>Simulate.submit(container.querySelector('form')!));await click('カフェ');await click(distance);expect(container.textContent).toContain('距離は直線距離の目安');await act(async()=>container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());await click('ガチャを回しに行こう！');await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);
 expect(searchApproximate).toHaveBeenCalledOnce();expect(searchWalkingTrial).not.toHaveBeenCalled();expect(getWalkingDistances).not.toHaveBeenCalled();expect(container.textContent).toContain('現在地から直線距離：');expect(container.textContent).toContain('実際の徒歩距離・所要時間はGoogleマップで確認');
 await click('ここへ行く');const a=JSON.parse(localStorage.getItem('machiTakarabakoActiveAdventure')!);expect(a.result.distanceKind).toBe('straight-line');expect(a.departureWalkingDistanceMeters).toBeNull();expect(navigateAdventureMap).toHaveBeenCalled();await click('到着した！');expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');latitude=a.target.latitude;longitude=a.target.longitude;await click('到着した！');expect(localStorage.getItem('machiTakarabakoExp')).toBe('20');expect(getWalkingDistances).not.toHaveBeenCalled();
});
it('standard search is enabled without a switch even on a fresh or previously OFF device',async()=>{await enterGacha('1km','公園・自然','',false);expect(container.querySelector('.walking-trial-controls')).toBeNull();await click('ガチャのハンドルを回す');await advance(4000);expect(searchApproximate).toHaveBeenCalledOnce();expect(getNearbyParks).not.toHaveBeenCalled();});
it('shows a retryable failure without falling back or granting rewards',async()=>{vi.mocked(searchApproximate).mockRejectedValue(Error('この直線距離・ジャンル条件に合う候補がありませんでした。'));await act(async()=>root.render(<App/>));await act(async()=>Simulate.change(container.querySelector('input')!,{target:{value:'冒険者'}} as never));await act(async()=>Simulate.submit(container.querySelector('form')!));await click('カフェ');await click('1km');await act(async()=>container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());await click('ガチャを回しに行こう！');await click('ガチャのハンドルを回す');await advance(4000);expect(container.textContent).toContain('候補がありません');expect(getNearbyParks).not.toHaveBeenCalled();expect(getWalkingDistances).not.toHaveBeenCalled();await click('条件画面へ戻って再試行');expect(container.textContent).toContain('冒険コインを作る');expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');});
vi.mock('./services/accountAuth',()=>({isAccountPage:()=>false,initializeAccount:async()=>{},loginWithGoogle:vi.fn(),logoutAccount:vi.fn(),googleAvatar:()=>undefined,getAccountClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'regression-account',user_metadata:{}},expires_at:Date.now()/1000+3600}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}})}})}));

async function prepareNew(distance='1km'){await act(async()=>root.render(<App/>));await act(async()=>Simulate.change(container.querySelector('input')!,{target:{value:'冒険者'}} as never));await act(async()=>Simulate.submit(container.querySelector('form')!));await click('カフェ');await click(distance);await act(async()=>container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());await click('ガチャを回しに行こう！');await click('ガチャのハンドルを回す');await advance(4000);await advance(1500);}
it('new switch ON does not change ?km or start roads',async()=>{await prepareNew('？km');expect(searchApproximate).not.toHaveBeenCalled();expect(searchWalkingTrial).not.toHaveBeenCalled();expect(getWalkingDistances).not.toHaveBeenCalled();expect(container.querySelector('.result-screen')).not.toBeNull();});
it('ignores late results after cancel and can retry',async()=>{let resolve!:(v:any)=>void;vi.mocked(searchApproximate).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));await prepareNew();await click('検索を中止して条件画面へ');await act(async()=>resolve({spot:{type:'node',id:9,lat:latitude+.01,lon:longitude,tags:{name:'古い結果'}},treasure:null,distanceKm:1.1,report:'直線距離・試験版'}));expect(container.textContent).not.toContain('古い結果');expect(container.textContent).toContain('冒険コインを作る');expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');});
it('registered treasure keeps 30EXP, discovery, rating and distance label after restore',async()=>{const treasure={id:7,name:'直線登録宝物',category:'☕ カフェ',latitude:latitude+.01,longitude,comment:'',image_url:null};vi.mocked(searchApproximate).mockResolvedValue({spot:null,treasure,distanceKm:1.1,report:'直線距離・試験版'});await prepareNew();await click('ここへ行く');await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(<App/>));expect(container.textContent).toContain('現在地から直線距離');latitude=treasure.latitude;longitude=treasure.longitude;await click('到着した！');expect(localStorage.getItem('machiTakarabakoExp')).toBe('30');expect(incrementTreasureDiscovery).toHaveBeenCalledOnce();expect(container.textContent).toContain('検索時の直線距離');await click('この宝物を評価する');expect(container.textContent).toContain('評価');expect(getWalkingDistances).not.toHaveBeenCalled();});

it('opens Maps after one click while departure GPS improves; target and reward state stay intact',async()=>{await prepareNew();const geo=navigator.geolocation as any;geo.getCurrentPosition=(success:PositionCallback)=>success({coords:{latitude,longitude,accuracy:80},timestamp:Date.now()} as GeolocationPosition);geo.clearWatch=vi.fn();geo.watchPosition=vi.fn((success:PositionCallback)=>{setTimeout(()=>success({coords:{latitude,longitude,accuracy:5},timestamp:Date.now()} as GeolocationPosition),20);return 7;});await click('ここへ行く');expect(navigateAdventureMap).not.toHaveBeenCalled();expect(container.textContent).toContain('直線試験カフェ');await advance(20);expect(navigateAdventureMap).toHaveBeenCalledOnce();const a=JSON.parse(localStorage.getItem('machiTakarabakoActiveAdventure')!);expect(a.target.id).toBe('node:123');expect(a.departure.accuracy).toBe(5);expect(a.rewardClaimed).toBe(false);expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');expect(geo.clearWatch).toHaveBeenCalledWith(7);expect(getWalkingDistances).not.toHaveBeenCalled();});

it('waits for fresh GPS after stale output and cancels without launching facilities or accepting a late fix',async()=>{await act(async()=>root.render(<App/>));await act(async()=>Simulate.change(container.querySelector('input')!,{target:{value:'冒険者'}} as never));await act(async()=>Simulate.submit(container.querySelector('form')!));await click('カフェ');await click('1km');const geo=navigator.geolocation as any;let late!:PositionCallback;geo.getCurrentPosition=(success:PositionCallback)=>success({coords:{latitude,longitude,accuracy:8.9},timestamp:Date.now()-35200} as GeolocationPosition);geo.watchPosition=vi.fn((success:PositionCallback)=>{late=success;return 23;});geo.clearWatch=vi.fn();await act(async()=>container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());await click('ガチャを回しに行こう！');await click('ガチャのハンドルを回す');await advance(4000);expect(container.textContent).toContain('新しいGPS測位を待っています');expect(searchApproximate).not.toHaveBeenCalled();await click('検索を中止して条件画面へ');expect(geo.clearWatch).toHaveBeenCalledWith(23);await act(async()=>late({coords:{latitude,longitude,accuracy:5},timestamp:Date.now()} as GeolocationPosition));expect(searchApproximate).not.toHaveBeenCalled();expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');expect(container.textContent).toContain('冒険コインを作る');});
