// @vitest-environment jsdom
import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
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
  vi.mocked(getNearbyRestaurants).mockResolvedValue([]);
  vi.mocked(getNearbyParks).mockResolvedValue([spot]); vi.mocked(getTreasures).mockResolvedValue([]);
  vi.mocked(getWalkingDistances).mockImplementation(async (_, destinations) => destinations.map(d => ({ id: d.id, status: 'OK', distanceMeters: 900 })));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('gacha and existing search integration', () => {
  it('keeps search separate from animation and announces the selected destination with a category photo', async () => {
    await enterGacha(); expect(getNearbyParks).toHaveBeenCalledOnce();
    await act(async () => { button('マシンのハンドルを回す').click(); button('ガチャのハンドルを回す').click(); });
    await advance(1800); expect(container.querySelector('.forest-gacha--step-3')).not.toBeNull();
    expect(container.querySelector('.result-screen')).toBeNull();
    await advance(1000); expect(container.textContent).toContain('街の宝物を探しています');
    await advance(1000); expect(container.textContent).toContain('テストの公園');
    expect(container.querySelector('.destination-category-photo img')).not.toBeNull();
    expect(getNearbyParks).toHaveBeenCalledOnce(); expect(getWalkingDistances).toHaveBeenCalledOnce();
    expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
  });
  it('preserves the registered treasure photo when selected by the existing search', async () => {
    vi.mocked(getNearbyParks).mockResolvedValue([]);
    vi.mocked(getTreasures).mockResolvedValue([{ id: 7, name: '写真のある宝物', category: '🌳 自然', latitude: 35.007, longitude: 139, comment: '', image_url: 'https://example.com/treasure.webp' }]);
    await enterGacha(); await click('ガチャのハンドルを回す'); await advance(2800); await advance(1000);
    expect(container.textContent).toContain('写真のある宝物');
    expect(container.querySelector('.gacha-treasure-result-image')?.getAttribute('src')).toBe('https://example.com/treasure.webp');
    expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
  });
  it('returns to the existing conditions after a failed search and allows another draw without rewards', async () => {
    vi.mocked(getNearbyParks).mockRejectedValueOnce(new Error('network unavailable'));
    await enterGacha(); await click('ガチャのハンドルを回す'); await advance(2800);
    expect(container.textContent).toContain('検索を完了できませんでした');
    expect(container.querySelector('.result-screen')).toBeNull();
    await click('条件を変えて戻る');
    expect(container.querySelector('.choice-button.selected')?.textContent).toContain('1km');
    await act(async () => container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());
    await click('ガチャを回しに行こう！'); await click('ガチャのハンドルを回す'); await advance(2800); await advance(1000);
    expect(container.textContent).toContain('テストの公園'); expect(getNearbyParks).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
  });
  it('waits for a slow search after opening the capsule', async () => {
    let resolve!: (spots: typeof spot[]) => void;
    vi.mocked(getNearbyParks).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await enterGacha(); await click('ガチャのハンドルを回す'); await advance(10000);
    expect(container.textContent).toContain('街の宝物を探しています'); expect(container.querySelector('.result-screen')).toBeNull();
    await act(async () => resolve([spot])); await advance(1000);
    expect(container.textContent).toContain('テストの公園');
  });
  it('stays home if the user leaves while the capsule is moving', async () => {
    await enterGacha(); await click('ガチャのハンドルを回す'); await click('ホーム'); await advance(5000);
    expect(container.querySelector('.home-screen')).not.toBeNull(); expect(container.querySelector('.result-screen')).toBeNull();
  });
});

it('ignores old source results after a new search and avoids another route lookup', async () => {
  let resolve!: (spots: typeof spot[]) => void;
  vi.mocked(getNearbyParks).mockReturnValueOnce(new Promise(done => { resolve=done; }));
  await enterGacha(); await click('ホーム'); await click('公園・自然');
  await act(async () => container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());
  await click('ガチャを回しに行こう！'); await click('ガチャのハンドルを回す'); await advance(2800); await advance(1200);
  expect(container.textContent).toContain('テストの公園');
  await act(async () => resolve([{...spot,id:1,tags:{name:'古い公園'}}])); await advance(2000);
  expect(container.textContent).not.toContain('古い公園'); expect(getWalkingDistances).toHaveBeenCalledOnce();
});
it('ignores stale walking results and stale failures after leaving search', async () => {
  let resolve!: (r: Awaited<ReturnType<typeof getWalkingDistances>>) => void;
  vi.mocked(getWalkingDistances).mockReturnValueOnce(new Promise(done=>{resolve=done;}));
  await enterGacha(); await click('ホーム');
  await act(async()=>resolve([{id:'0',status:'OK',distanceMeters:900}])); await advance(5000);
  expect(container.querySelector('.home-screen')).not.toBeNull(); expect(container.textContent).not.toContain('テストの公園');
});
it('does not allow an old rejection to fail a newer pending search', async () => {
  let reject!: (e: Error)=>void; let resolve!: (r: typeof spot[])=>void;
  vi.mocked(getNearbyParks).mockReturnValueOnce(new Promise((_r,j)=>{reject=j;})).mockReturnValueOnce(new Promise(r=>{resolve=r;}));
  await enterGacha(); await click('ホーム'); await click('公園・自然');
  await act(async()=>container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());
  await click('ガチャを回しに行こう！'); await click('ガチャのハンドルを回す');
  await act(async()=>reject(new Error('old failure'))); await advance(9000);
  expect(container.textContent).toContain('街の宝物を探しています'); expect(container.textContent).not.toContain('検索を完了できませんでした');
  await act(async()=>resolve([spot])); await advance(2000); expect(container.textContent).toContain('テストの公園');
});
it('does not mix a pizza treasure into a ramen search and makes no extra route calls', async () => {
  vi.mocked(getTreasures).mockResolvedValue([{id:7,name:'ピザの宝物',category:'🍜 グルメ',latitude:35.027,longitude:139,comment:'',image_url:null}]);
  await enterGacha('3km','グルメ','ラーメン'); await click('ガチャのハンドルを回す'); await advance(2800); await advance(1200);
  expect(getNearbyRestaurants).toHaveBeenCalledWith(35,139,4000,'ラーメン');
  expect(container.textContent).toContain('スポットが見つかりませんでした'); expect(container.textContent).not.toContain('ピザの宝物'); expect(getWalkingDistances).not.toHaveBeenCalled();
});
it('limits random-distance registered treasures to the local radius without route calls', async () => {
  vi.mocked(getNearbyParks).mockResolvedValue([]);
  vi.mocked(getTreasures).mockResolvedValue([{id:7,name:'111km先の宝物',category:'🌳 自然',latitude:36,longitude:139,comment:'',image_url:null}]);
  await enterGacha('？km'); await click('ガチャのハンドルを回す'); await advance(2800); await advance(1200);
  expect(getNearbyParks).toHaveBeenCalledWith(35,139,3000); expect(container.textContent).toContain('スポットが見つかりませんでした'); expect(container.textContent).not.toContain('111km先'); expect(getWalkingDistances).not.toHaveBeenCalled();
});
it('distinguishes a genuine empty result from service failure', async () => {
  vi.mocked(getNearbyParks).mockResolvedValue([]); await enterGacha(); await click('ガチャのハンドルを回す'); await advance(2800); await advance(1200);
  expect(container.textContent).toContain('名前と位置を確認できる施設・宝物が見つかりませんでした'); expect(container.textContent).not.toContain('接続できませんでした');
});
it('continues with an eligible treasure when Overpass fails', async () => {
  vi.mocked(getNearbyParks).mockRejectedValue(new Error('offline'));
  vi.mocked(getTreasures).mockResolvedValue([{id:7,name:'近くの宝物',category:'🌳 自然',latitude:35.007,longitude:139,comment:'',image_url:null}]);
  await enterGacha(); await click('ガチャのハンドルを回す'); await advance(2800); await advance(1200);
  expect(container.textContent).toContain('近くの宝物'); expect(container.textContent).not.toContain('検索を完了できませんでした'); expect(getWalkingDistances).not.toHaveBeenCalled();
});

it('keeps walking-distance lookups bounded to the existing two batches of eight', async () => {
  vi.mocked(getNearbyParks).mockResolvedValue(Array.from({length:30},(_,id)=>({...spot,id,lat:35.007+id*.0001})));
  vi.mocked(getWalkingDistances).mockImplementation(async(_,destinations)=>destinations.map(d=>({id:d.id,status:'OK',distanceMeters:9000})));
  await enterGacha(); await click('ガチャのハンドルを回す'); await advance(2800); await advance(1200);
  expect(getWalkingDistances).toHaveBeenCalledTimes(2);
  expect(vi.mocked(getWalkingDistances).mock.calls.map(c=>c[1].length)).toEqual([8,8]);
  expect(container.textContent).toContain('候補の確認上限に達しました');
});
it('accepts nearby random-distance treasure but excludes one just outside the 3km radius', async () => {
  vi.mocked(getNearbyParks).mockResolvedValue([]);
  vi.mocked(getTreasures).mockResolvedValue([
    {id:1,name:'範囲外の宝物',category:'🌳 自然',latitude:35.027,longitude:139,comment:'',image_url:null},
    {id:2,name:'範囲内の宝物',category:'🌳 自然',latitude:35.0269,longitude:139,comment:'',image_url:null},
  ]);
  await enterGacha('？km'); await click('ガチャのハンドルを回す'); await advance(2800); await advance(1200);
  expect(container.textContent).toContain('範囲内の宝物'); expect(container.textContent).not.toContain('範囲外の宝物'); expect(getWalkingDistances).not.toHaveBeenCalled();
});
it('reports route service failures separately from valid out-of-range routes', async () => {
  vi.mocked(getWalkingDistances).mockRejectedValue(new Error('route unavailable'));
  await enterGacha(); await click('ガチャのハンドルを回す'); await advance(2800); await advance(1200);
  expect(container.textContent).toContain('検索を完了できませんでした'); expect(getWalkingDistances).toHaveBeenCalledOnce();
});

it('keeps the coin and conditions when GPS fails, then retries GPS before searching', async()=>{
 await enterGacha('3km'); await click('ホーム'); await advance(31000); await click('公園・自然'); await act(async()=>container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());
 Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(_s:PositionCallback,f:PositionErrorCallback){f({code:1} as GeolocationPositionError);}}});
 vi.mocked(getNearbyParks).mockClear(); await click('ガチャを回しに行こう！');expect(getNearbyParks).not.toHaveBeenCalled();expect(container.querySelector('.coin-celebration')).not.toBeNull();expect(container.textContent).toContain('位置情報が許可');expect(container.textContent).toContain('3km');
 Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(s:PositionCallback){s({coords:{latitude:35,longitude:139,accuracy:10},timestamp:Date.now()} as GeolocationPosition);}}});
 await click('ガチャを回しに行こう！');expect(getNearbyParks).toHaveBeenCalledWith(35,139,4000);
});
it('reacquires old GPS and does not navigate after leaving the coin while waiting',async()=>{
 await enterGacha();await click('ホーム');await advance(301000);await click('公園・自然');await act(async()=>container.querySelector<HTMLButtonElement>('.adventure-coin-button')!.click());
 let resolve!: PositionCallback;Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(s:PositionCallback){resolve=s;}}});
 await click('ガチャを回しに行こう！');await click('ホーム');await act(async()=>resolve({coords:{latitude:36,longitude:139}} as GeolocationPosition));
 expect(container.querySelector('.home-screen')).not.toBeNull();expect(getNearbyParks).toHaveBeenCalledTimes(1);
});
it('distinguishes walking lookup failure from distance mismatch',async()=>{
 vi.mocked(getWalkingDistances).mockRejectedValue(new Error('offline'));await enterGacha();await click('ガチャのハンドルを回す');await advance(2800);await advance(1200);
 expect(container.textContent).toContain('徒歩距離を確認できませんでした');expect(container.textContent).not.toContain('施設検索サービスに接続');
});
it('deduplicates OSM identities and excludes invalid coordinates before paid-route selection',async()=>{
 vi.mocked(getNearbyParks).mockResolvedValue([spot,spot,{...spot,id:10,lat:NaN},{...spot,id:11,tags:{name:'  '}}]);
 await enterGacha();expect(vi.mocked(getWalkingDistances).mock.calls[0][1]).toHaveLength(1);
});

it('reports a distance mismatch without changing selected conditions',async()=>{
 vi.mocked(getWalkingDistances).mockResolvedValue([{id:'0',status:'OK',distanceMeters:9000}]);await enterGacha('3km');await click('ガチャのハンドルを回す');await advance(2800);await advance(1200);
 expect(container.textContent).toContain('指定した距離で到達できる目的地がありませんでした');await click('条件を変えて戻る');expect(container.querySelector('.choice-button.selected')?.textContent).toContain('3km');
});
it('waits for initial pending GPS before allowing gacha search',async()=>{
 let resolve!: PositionCallback;Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(s:PositionCallback){resolve=s;}}});
 await act(async()=>root.render(<App/>));await act(async()=>Simulate.change(container.querySelector('input')!,{target:{value:'冒険者'}} as never));await act(async()=>Simulate.submit(container.querySelector('form')!));expect(getNearbyParks).not.toHaveBeenCalled();expect(container.textContent).toContain('現在地を確認しています');expect(container.querySelector('.home-screen')).toBeNull();
 await act(async()=>resolve({coords:{latitude:35,longitude:139,accuracy:10},timestamp:Date.now()} as GeolocationPosition));expect(container.querySelector('.home-screen')).not.toBeNull();expect(getNearbyParks).not.toHaveBeenCalled();
});

it('diagnoses random-distance selection without names or coordinates and does not call Routes',async()=>{
 const info=vi.spyOn(console,'info').mockImplementation(()=>{});
 await enterGacha('？km');await click('ガチャのハンドルを回す');await advance(2800);await advance(1200);
 expect(container.textContent).toContain('テストの公園');expect(getWalkingDistances).not.toHaveBeenCalled();
 const selected=info.mock.calls.find(c=>c[0]==='[normal-search] succeeded');expect(selected?.[1]).toMatchObject({source:'overpass',overpassEligibleCount:1,registeredEligibleCount:0});
 expect(JSON.stringify(selected)).not.toContain('テストの公園');expect(JSON.stringify(selected)).not.toContain('35.007');info.mockRestore();
});

// These regressions run after a restored Google session; no live auth or GPS service is contacted.
vi.mock('./services/accountAuth', () => ({
 isAccountPage: () => false, initializeAccount: async () => {}, loginWithGoogle: vi.fn(), logoutAccount: vi.fn(), googleAvatar: () => undefined,
 getAccountClient: () => ({auth: {getSession: async () => ({data: {session: {user: {id: 'regression-account', user_metadata: {}}, expires_at: Date.now()/1000+3600}}, error: null}), onAuthStateChange: () => ({data: {subscription: {unsubscribe: vi.fn()}}})}}),
}));
