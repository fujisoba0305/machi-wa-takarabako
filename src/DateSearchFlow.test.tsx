// @vitest-environment jsdom
import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import App from './App';
import * as statics from './services/staticFacilities';
import * as overpass from './services/overpass';
import { getWalkingDistances } from './services/walkingDistance';
import { navigateAdventureMap } from './features/googleMaps';
import { DATE_ADVENTURE_KEY, type DateAdventure } from './features/dateAdventure';
vi.mock('./features/googleMaps', async original => ({ ...await original<typeof import('./features/googleMaps')>(), navigateAdventureMap: vi.fn() }));
vi.mock('./services/overpass', () => ({ getNearbyCafes:vi.fn(),getNearbyFoodWalkSpots:vi.fn(),getNearbyRelaxSpots:vi.fn(),getNearbyViewSpots:vi.fn(),getNearbyEventSpots:vi.fn(),getNearbyParks:vi.fn(),getNearbyRestaurants:vi.fn() }));
vi.mock('./services/walkingDistance',()=>({getWalkingDistances:vi.fn()}));
let root:Root, box:HTMLDivElement;
function button(label:string){const b=[...box.querySelectorAll('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label);if(!b)throw Error('Missing '+label);return b;}
async function click(s:string){await act(async()=>button(s).click());}
async function advance(ms:number){await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});}
beforeEach(()=>{vi.useFakeTimers();localStorage.clear();vi.clearAllMocks();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);window.scrollTo=vi.fn();window.open=vi.fn();vi.stubEnv('VITE_LOCAL_STATIC_SEARCH','on');statics.resetStaticFacilityCache();
vi.stubGlobal('fetch',vi.fn(async(url:string)=>{if(!url.startsWith('/facilities-local-v1/'))throw Error('Forbidden API');return{ok:true,json:async()=>JSON.parse(readFileSync('public'+url,'utf8'))};}));
Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success:PositionCallback){success({coords:{latitude:35.681236,longitude:139.767125,accuracy:10},timestamp:Date.now()} as GeolocationPosition);}}});
box=document.createElement('div');document.body.append(box);root=createRoot(box);});
afterEach(async()=>{await act(async()=>root.unmount());box.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();statics.resetStaticFacilityCache();});
async function search(mode:string,distance='？km'){
await act(async()=>root.render(<App/>));await act(async()=>Simulate.change(box.querySelector('input')!,{target:{value:'検証'}} as never));await act(async()=>Simulate.submit(box.querySelector('form')!));
await click('距離と気分から宝物を探す');await click('デート');await click(distance);
await act(async()=>{const group=[...box.querySelectorAll('fieldset')].find(f=>f.querySelector('legend')?.textContent?.includes('デートジャンル'))!; [...group.querySelectorAll('button')].find(b=>b.textContent?.trim()===mode)!.click();});
await act(async()=>box.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());await click('ガチャを回しに行こう！');await click('ガチャのハンドルを回す');await advance(6500);await advance(3000);
}
it.each(['おまかせ','まったり','食べ歩き','夜景','イベント'])('selects two actual static facilities for %s without paid APIs or Overpass',async mode=>{
await search(mode);expect(box.querySelector('.result-screen')).not.toBeNull();
expect(box.textContent).not.toContain('目的地が見つかりませんでした');expect(box.textContent).not.toContain('経由地が見つかりませんでした');
expect(getWalkingDistances).not.toHaveBeenCalled();for(const fn of Object.values(overpass))expect(fn).not.toHaveBeenCalled();
await click('全体の地図を開く');const url=vi.mocked(window.open).mock.calls[0][0] as string;expect(url).toContain('travelmode=walking');expect(url).toContain('waypoints=');
expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
});
it.each([{rows:[]},{rows:[{type:'node',id:1,lat:35.68,lon:139.76,tags:{name:'一件'}}]}])('clearly reports food-walk shortage without an empty destination',async ({rows})=>{
vi.spyOn(statics,'loadStaticDateSpots').mockResolvedValue(rows);await search('食べ歩き');expect(box.textContent).toContain('買い物スポットが、この検索範囲に見つかりませんでした');expect(box.querySelector('.result-screen')).toBeNull();
expect(overpass.getNearbyFoodWalkSpots).not.toHaveBeenCalled();
});
it('distinguishes failed static data from genuine empty results',async()=>{vi.spyOn(statics,'loadStaticDateSpots').mockRejectedValue(new statics.StaticFacilityError());await search('食べ歩き');expect(box.textContent).toContain('施設データを読み込めませんでした');expect(overpass.getNearbyFoodWalkSpots).not.toHaveBeenCalled();});
it('stops a stalled date search after 20 seconds and ignores its late result',async()=>{let resolve!:(rows:[])=>void;vi.spyOn(statics,'loadStaticDateSpots').mockReturnValue(new Promise(done=>{resolve=done;}));await search('夜景');await advance(20000);expect(box.textContent).toContain('デートコースの検索に時間がかかっています');await act(async()=>resolve([]));expect(box.querySelector('.result-screen')).toBeNull();expect(overpass.getNearbyViewSpots).not.toHaveBeenCalled();});
it('retains the existing fixed-date calculation path without calling Routes',async()=>{await search('食べ歩き','1km');expect(box.querySelector('.result-screen')).not.toBeNull();expect(getWalkingDistances).not.toHaveBeenCalled();});
it('reuses the relaxation/cafe candidates for the calm mode',async()=>{await search('まったり');expect(box.querySelector('.result-screen')).not.toBeNull();expect(overpass.getNearbyCafes).not.toHaveBeenCalled();});
it('uses the legacy source once when explicitly rolled back',async()=>{vi.stubEnv('VITE_LOCAL_STATIC_SEARCH','off');vi.mocked(overpass.getNearbyFoodWalkSpots).mockResolvedValue([{type:'node',id:1,lat:35.68,lon:139.76,tags:{name:'A',shop:'bakery'}}]);vi.mocked(overpass.getNearbyCafes).mockResolvedValue([{type:'node',id:2,lat:35.683,lon:139.76,tags:{name:'B',amenity:'cafe'}}]);await search('食べ歩き');expect(box.querySelector('.result-screen')).not.toBeNull();expect(overpass.getNearbyFoodWalkSpots).toHaveBeenCalledOnce();expect(fetch).not.toHaveBeenCalled();expect(getWalkingDistances).not.toHaveBeenCalled();});
it('ignores date results after leaving the adventure flow',async()=>{let resolve!:(rows:[])=>void;vi.spyOn(statics,'loadStaticDateSpots').mockReturnValue(new Promise(done=>{resolve=done;}));await search('食べ歩き');await click('ホーム');await act(async()=>resolve([]));await advance(30000);expect(box.querySelector('.home-screen')).not.toBeNull();expect(box.querySelector('.result-screen')).toBeNull();});
it('shows a shop followed by a cafe and labels straight distance without invented walking minutes',async()=>{
vi.spyOn(statics,'loadStaticDateSpots').mockImplementation(async(_point,kind)=>kind==='food'?[{type:'node',id:1,lat:35.681,lon:139.767,tags:{name:'パン屋A',shop:'bakery'}},{type:'node',id:9,lat:35.681,lon:139.767,tags:{name:'純粋なカフェ',amenity:'cafe'}}]:[{type:'node',id:2,lat:35.683,lon:139.767,tags:{name:'喫茶店B',amenity:'cafe'}}]);
await search('食べ歩き');expect([...box.querySelectorAll('.spot-card h3')].map(n=>n.textContent)).toEqual(['パン屋A','喫茶店B']);expect(box.textContent).toContain('2店間の直線距離');expect(box.textContent).not.toMatch(/徒歩\s*\d+\s*分/);expect(box.textContent).not.toContain('純粋なカフェ');
});
it('reports the missing second-stop cafe without changing genres',async()=>{
vi.spyOn(statics,'loadStaticDateSpots').mockImplementation(async(_point,kind)=>kind==='food'?[{type:'node',id:1,lat:35.681,lon:139.767,tags:{name:'パン屋A',shop:'bakery'}}]:[]);
await search('食べ歩き');expect(box.textContent).toContain('2軒目に立ち寄れるカフェ・喫茶店が');expect(box.querySelector('.result-screen')).toBeNull();expect(overpass.getNearbyCafes).not.toHaveBeenCalled();
});

it.each(['おまかせ','まったり','食べ歩き','夜景','イベント'])('requires GPS proof at both stops after searching %s', async mode => {
await search(mode);
await click('経由地まで地図を開く');
const initial=JSON.parse(localStorage.getItem(DATE_ADVENTURE_KEY)!) as DateAdventure;
expect(initial.rewardClaimed).toBe(false); expect(initial.waypointArrival).toBeUndefined();
expect(navigateAdventureMap).toHaveBeenLastCalledWith(initial.departure,initial.waypoint);
// Far from either selected target: opening Maps cannot complete the waypoint.
const fixAt=(lat:number,lon:number,accuracy=10,deny=false)=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success:PositionCallback,failure:PositionErrorCallback){if(deny)failure({code:1} as GeolocationPositionError);else success({coords:{latitude:lat,longitude:lon,accuracy},timestamp:Date.now()} as GeolocationPosition);}}});
fixAt(34,139); await click('経由地に到着した');
expect(box.textContent).toContain('あと約'); expect(box.textContent).not.toContain('最終目的地まで地図を開く');
expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
fixAt(initial.waypoint.latitude,initial.waypoint.longitude,51);await click('経由地に到着した');expect(box.textContent).toContain('正確');
fixAt(initial.waypoint.latitude,initial.waypoint.longitude,10,true);await click('経由地に到着した');expect(box.textContent).toContain('位置情報の許可');
fixAt(initial.waypoint.latitude,initial.waypoint.longitude);await click('経由地に到着した');
expect(JSON.parse(localStorage.getItem(DATE_ADVENTURE_KEY)!).waypointArrival).toBeDefined();
await click('最終目的地まで地図を開く'); fixAt(34,139);await click('ゴールした');
expect(box.textContent).not.toContain('冒険達成！');expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
await click('ホーム');await click('冒険の続きに戻る');
expect(box.textContent).toContain('経由地のGPS到着を確認しました');await click('最終目的地まで地図を開く');
fixAt(initial.final.latitude,initial.final.longitude);await click('ゴールした');
expect(box.textContent).toContain('冒険達成！');expect(localStorage.getItem('machiTakarabakoExp')).toBe('50');expect(localStorage.getItem('machiTakarabakoAdventureCount')).toBe('1');
await act(async()=>root.unmount());root=createRoot(box);await act(async()=>root.render(<App/>));
expect(box.textContent).toContain('冒険達成！');expect(localStorage.getItem('machiTakarabakoExp')).toBe('50');
expect(getWalkingDistances).not.toHaveBeenCalled();
});

it('preserves date departure and ID on resume, and cancels a late arrival after leaving', async()=>{
await search('食べ歩き');await click('経由地まで地図を開く');const initial=localStorage.getItem(DATE_ADVENTURE_KEY);
await click('経由地へのナビを再開する');expect(localStorage.getItem(DATE_ADVENTURE_KEY)).toBe(initial);
let success!:PositionCallback;Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(done:PositionCallback){success=done;}}});
await click('経由地に到着した');expect(button('経由地に到着した').disabled).toBe(true);
await click('経由地に到着した');await click('ホーム');const a=JSON.parse(initial!) as DateAdventure;
await act(async()=>success({coords:{latitude:a.waypoint.latitude,longitude:a.waypoint.longitude,accuracy:10},timestamp:Date.now()} as GeolocationPosition));
expect(localStorage.getItem(DATE_ADVENTURE_KEY)).toBe(initial);expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
await click('冒険の続きに戻る');expect(box.textContent).toContain('経由地に到着した');
});
it('does not navigate or offer arrival when fresh departure GPS is denied, and permits retry', async()=>{
await search('食べ歩き');
Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(_success:PositionCallback,fail:PositionErrorCallback){fail({code:1} as GeolocationPositionError);}}});
await click('経由地まで地図を開く');expect(box.textContent).toContain('位置情報の許可');
expect(localStorage.getItem(DATE_ADVENTURE_KEY)).toBeNull();expect(navigateAdventureMap).not.toHaveBeenCalled();
expect(box.textContent).not.toContain('経由地に到着した');
Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success:PositionCallback){success({coords:{latitude:35.68,longitude:139.76,accuracy:10},timestamp:Date.now()} as GeolocationPosition);}}});
await click('経由地まで地図を開く');expect(localStorage.getItem(DATE_ADVENTURE_KEY)).not.toBeNull();expect(navigateAdventureMap).toHaveBeenCalledOnce();
});
