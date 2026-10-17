// @vitest-environment jsdom
import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ACTIVE_ADVENTURE_KEY, AdventureSession, type ActiveAdventure } from './features/activeAdventure';
import { DATE_ADVENTURE_KEY, DateAdventureSession } from './features/dateAdventure';
import { navigateAdventureMap } from './features/googleMaps';
import { createTreasure, incrementTreasureDiscovery } from './services/treasures';
import { submitTreasureRating } from './services/treasureRatings';
import { uploadTreasureImage, deleteTreasureImage } from './services/treasureImages';
import { saveDiagnostic, TreasureSaveError } from './features/treasureSaveDiagnostics';

vi.mock('./services/treasures', () => ({ createTreasure: vi.fn().mockResolvedValue(undefined),
  incrementTreasureDiscovery: vi.fn().mockResolvedValue(1), getTreasures: vi.fn().mockResolvedValue([]) }));
vi.mock('./services/treasureImages', () => ({ uploadTreasureImage: vi.fn().mockResolvedValue({ path: 'test.jpg', publicUrl: 'https://example.com/test.jpg' }), deleteTreasureImage: vi.fn() }));
vi.mock('./services/treasureRatings', () => ({ getTreasureRatingSummary: vi.fn().mockResolvedValue({ averageRating: 0, ratingCount: 0 }), getTreasureRatingSummaries: vi.fn().mockResolvedValue({}), submitTreasureRating: vi.fn() }));
vi.mock('./features/googleMaps', async importOriginal => ({ ...await importOriginal<typeof import('./features/googleMaps')>(), navigateAdventureMap: vi.fn() }));
vi.mock('./components/TreasureCollection', () => ({ TreasureCollection: () => <div>宝物図鑑</div> }));
let container: HTMLDivElement;
let root: Root;
let latitude: number;
let accuracy: number;
let failGPS: boolean;
let deferGPS: boolean;
let pendingGPS: PositionCallback | null;
const geolocation = vi.fn((success: PositionCallback, fail: PositionErrorCallback | null) => {
  if (deferGPS) { pendingGPS = success; return; }
  if (failGPS) { fail?.({ code: 1 } as GeolocationPositionError); return; }
  success(fix());
});
function fix(): GeolocationPosition { return { coords: { latitude, longitude: 139, accuracy }, timestamp: Date.now() } as GeolocationPosition; }
function button(text: string) {
  const match = [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text));
  if (!match) throw Error('Missing button: ' + text);
  return match;
}
async function click(text: string) { await act(async () => { button(text).click(); }); }
async function mount() { if (localStorage.getItem(ACTIVE_ADVENTURE_KEY) || localStorage.getItem(DATE_ADVENTURE_KEY)) { const {saveAdventurerProfile}=await import('./features/adventurerProfile');saveAdventurerProfile(localStorage,'regression-account',{name:'冒険者',started:true}); } container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); await act(async () => { root.render(<App />); }); }
async function reload() { await act(async () => root.unmount()); container.remove(); await mount(); }
function saved() { return JSON.parse(localStorage.getItem(ACTIVE_ADVENTURE_KEY)!) as ActiveAdventure; }
async function seed(treasure = false) {
  const session = new AdventureSession(localStorage);
  await session.start({ kind: treasure ? 'treasure' : 'normal', id: treasure ? '7' : 'node:1', latitude: 35, longitude: 139 }, {
    spot: treasure ? null : { type: 'node', id: 1, lat: 35, lon: 139, tags: { name: '森の公園' } },
    treasure: treasure ? { id: 7, latitude: 35, longitude: 139, name: '緑の宝物', comment: '', category: '📷 写真スポット', image_url: 'https://example.com/destination.jpg' } : null,
    choices: { distance: '1km', mood: 'リラックス', budget: '無料', time: '', foodGenre: '', dateGenre: '', eventGenre: '', shrineGenre: '' }, distanceKm: 0.8, playerName: '冒険者',
  }, async () => 1250);
  return saved();
}
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); latitude = 35; accuracy = 10; failGPS = false; deferGPS = false; pendingGPS = null;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('alert', vi.fn());
  window.scrollTo = vi.fn();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: geolocation } });
  URL.createObjectURL = vi.fn(() => 'blob:test'); URL.revokeObjectURL = vi.fn();
});
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.unstubAllGlobals(); });

describe('walking and treasure registration screens', () => {
  it.each([false, true])('preserves verified date progress while registering and returning (waypoint=%s)', async verified => {
    const date = new DateAdventureSession(localStorage);
    await date.start({ waypoint: { type: 'node', id: 1, lat: 35, lon: 139, tags: { name: 'パン屋', shop: 'bakery' } },
      final: { type: 'node', id: 2, lat: 35.005, lon: 139, tags: { name: 'カフェ', amenity: 'cafe' } },
      choices: { mood: 'デート', distance: '？km', dateGenre: '食べ歩き' }, playerName: '冒険者', distanceKm: 1 });
    if (verified) await date.arrive('waypoint', date.current?.id);
    const original = localStorage.getItem(DATE_ADVENTURE_KEY);
    await mount(); await click('ホーム'); await click('宝物を発見！');
    await act(async () => {
      Simulate.change(container.querySelector('input[placeholder="例：路地裏の小さな喫茶店"]')!, { target: { value: '道中の宝物' } } as never);
      Simulate.change(container.querySelector('select')!, { target: { value: '📷 写真スポット' } } as never);
    });
    await act(async () => Simulate.submit(container.querySelector('form')!));
    expect(container.textContent).toContain('宝物を登録しました');
    await click('冒険の続きに戻る');
    expect(container.querySelector('.result-screen')).not.toBeNull();
    expect(localStorage.getItem(DATE_ADVENTURE_KEY)).toBe(original);
    expect(container.textContent).toContain(verified ? '経由地のGPS到着を確認しました' : '経由地に到着した');
    await reload(); expect(localStorage.getItem(DATE_ADVENTURE_KEY)).toBe(original);
    expect(container.querySelector('.result-screen')).not.toBeNull();
    expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
  });
  it.each(['upload', 'db-rejected', 'db-unknown'])('keeps the adventure and diagnoses photographed save failure: %s', async stage => {
    const original = await seed(); await mount(); await click('宝物を見つけた！');
    if (stage === 'upload') vi.mocked(uploadTreasureImage).mockRejectedValueOnce(new TreasureSaveError(saveDiagnostic({ status: 413 }, 'image_upload')));
    if (stage === 'db-rejected') vi.mocked(createTreasure).mockRejectedValueOnce(new TreasureSaveError(saveDiagnostic({ code: '42501', status: 403 }, 'db_insert')));
    if (stage === 'db-unknown') vi.mocked(createTreasure).mockRejectedValueOnce(new Error('connection lost'));
    await act(async () => {
      Simulate.change(container.querySelector('input[placeholder="例：路地裏の小さな喫茶店"]')!, { target: { value: '春日局乃像' } } as never);
      Simulate.change(container.querySelector('select')!, { target: { value: '📷 写真スポット' } } as never);
      Simulate.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['photo'], 'private.jpg', { type: 'image/jpeg' })] } } as never);
    });
    // Submit after the form changes have rendered.
    await act(async () => Simulate.submit(container.querySelector('form')!));
    expect(saved()).toEqual(original);
    expect(container.textContent).toContain(stage === 'upload' ? 'image_upload' : 'db_insert');
    if (stage === 'upload') expect(createTreasure).not.toHaveBeenCalled();
    if (stage === 'db-rejected') expect(deleteTreasureImage).toHaveBeenCalledWith('test.jpg');
    else expect(deleteTreasureImage).not.toHaveBeenCalled();
    if (stage === 'db-unknown') expect(container.textContent).toContain('再送する前に図鑑');
    expect(container.textContent).not.toContain('private.jpg');
    await click('冒険の続きに戻る'); expect(saved()).toEqual(original);
  });
  it('restores the walking screen, departure route and mission without requesting GPS', async () => {
    await seed(); geolocation.mockClear(); await mount();
    expect(container.textContent).toContain('ウォーキング中！');
    expect(container.textContent).toContain('森の公園'); expect(container.textContent).toContain('約1.3km');
    expect(container.textContent).toContain('目的地までの道で、気になるお店・看板・景色を1つ見つけよう！');
    expect(geolocation).not.toHaveBeenCalled();
  });
  it('registers a photographed treasure and resumes the exact same adventure', async () => {
    const original = await seed(); await mount(); await click('宝物を見つけた！');
    expect(container.textContent).toContain('ここを宝物として残そう');
    await act(async () => {
      Simulate.change(container.querySelector('input[placeholder="例：路地裏の小さな喫茶店"]')!, { target: { value: '途中で見つけた看板' } } as never);
      Simulate.change(container.querySelector('select')!, { target: { value: '📷 写真スポット' } } as never);
      Simulate.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['photo'], 'test.jpg', { type: 'image/jpeg' })] } } as never);
    });
    await act(async () => { Simulate.submit(container.querySelector('form')!); });
    expect(uploadTreasureImage).toHaveBeenCalledOnce(); expect(createTreasure).toHaveBeenCalledWith(expect.objectContaining({ name: '途中で見つけた看板', category: '📷 写真スポット', image_url: 'https://example.com/test.jpg' }));
    expect(container.textContent).toContain('宝物を登録しました'); expect(saved()).toEqual(original);
    await click('冒険の続きに戻る'); expect(container.textContent).toContain('ウォーキング中！');
    expect(container.textContent).toContain('森の公園'); expect(saved()).toEqual(original);
    await click('ナビを再開する'); await click('ナビを再開する');
    expect(navigateAdventureMap).toHaveBeenCalledTimes(2);
    expect(navigateAdventureMap).toHaveBeenLastCalledWith(original.departure, original.target);
    expect(saved()).toEqual(original); expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
  });
  it('returns from cancellation and from home without resetting the adventure', async () => {
    const original = await seed(); await mount(); await click('宝物を見つけた！'); await click('冒険の続きに戻る');
    await click('ホーム'); await click('冒険の続きに戻る'); expect(saved()).toEqual(original);
    expect(container.textContent).toContain('ウォーキング中！');
  });
  it('restores the original adventure after reload while registering', async () => {
    const original = await seed(); await mount(); await click('宝物を見つけた！'); await reload();
    expect(container.textContent).toContain('ウォーキング中！'); expect(saved()).toEqual(original);
  });
  it('preserves home return when registering outside an adventure', async () => {
    const complete = await seed(); localStorage.setItem(ACTIVE_ADVENTURE_KEY, JSON.stringify({ ...complete, rewardClaimed: true, completedAt: Date.now(), arrival: complete.departure }));
    await mount(); await click('ホーム'); await click('宝物を発見！');
    expect(container.textContent).toContain('ここを宝物として残そう');
    expect(container.textContent).not.toContain('冒険の続きに戻る');
    await click('キャンセル'); expect(container.querySelector('.home-screen')).not.toBeNull();
  });
  it.each(['far', 'accuracy', 'denied'])('gives no reward for %s and supports retry', async reason => {
    const original = await seed(true); await mount();
    if (reason === 'far') latitude = 35.01;
    if (reason === 'accuracy') accuracy = 51;
    if (reason === 'denied') failGPS = true;
    await click('到着した！'); expect(saved()).toEqual(original);
    expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
    expect(localStorage.getItem('machiTakarabakoDiscoveredTreasures')).toBeNull();
    expect(incrementTreasureDiscovery).not.toHaveBeenCalled();
    expect(container.querySelector('.arrival-screen')).toBeNull();
    latitude = 35; accuracy = 50; failGPS = false; await click('到着した！');
    expect(saved().rewardClaimed).toBe(true); expect(localStorage.getItem('machiTakarabakoExp')).toBe('30');
  });
  it.each([false, true])('rewards once after return from registration, including after reload (treasure=%s)', async treasure => {
    await seed(treasure); await mount(); await click('宝物を見つけた！'); await click('冒険の続きに戻る');
    deferGPS = true; await click('到着した！'); expect(button('現在地を確認中').disabled).toBe(true);
    await act(async () => { pendingGPS!(fix()); });
    expect(localStorage.getItem('machiTakarabakoExp')).toBe(treasure ? '30' : '20');
    expect(localStorage.getItem('machiTakarabakoAdventureCount')).toBe('1');
    expect(incrementTreasureDiscovery).toHaveBeenCalledTimes(treasure ? 1 : 0);
    if (treasure) expect(JSON.parse(localStorage.getItem('machiTakarabakoDiscoveredTreasures')!)[0].treasureId).toBe(7);
    expect(container.querySelector('.arrival-screen')).not.toBeNull();
    expect(container.querySelector('.arrival-exp')?.textContent).toContain(treasure ? '+30' : '+20');
    await act(async () => Simulate.animationEnd(container.querySelector('.arrival-chest-lid')!));
    await reload(); expect(container.querySelector('.walking-screen')).toBeNull();
    expect(container.querySelector('.arrival-screen')).not.toBeNull();
    expect(localStorage.getItem('machiTakarabakoExp')).toBe(treasure ? '30' : '20');
    expect(incrementTreasureDiscovery).toHaveBeenCalledTimes(treasure ? 1 : 0);
  });

  it('keeps the adventure and registration form if saving the new treasure fails', async () => {
    const original = await seed(); await mount(); await click('宝物を見つけた！');
    vi.mocked(createTreasure).mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      Simulate.change(container.querySelector('input[placeholder="例：路地裏の小さな喫茶店"]')!, { target: { value: '看板' } } as never);
      Simulate.change(container.querySelector('select')!, { target: { value: '📷 写真スポット' } } as never);
    });
    await act(async () => Simulate.submit(container.querySelector('form')!));
    expect(container.textContent).toContain('宝物を保存できませんでした');
    expect(saved()).toEqual(original); await click('冒険の続きに戻る');
    expect(container.textContent).toContain('森の公園');
  });
  it('shows a destination photograph when available and hides a failed image', async () => {
    await seed(true); await mount();
    const image = container.querySelector('.walking-destination-photo')!;
    expect(image.getAttribute('src')).toBe('https://example.com/destination.jpg');
    await act(async () => Simulate.error(image));
    expect(container.querySelector('.walking-destination-photo')).toBeNull();
    expect(container.textContent).toContain('緑の宝物');
  });

  it('does not reward a pending arrival after leaving the walking screen', async () => {
    const original = await seed(); await mount(); deferGPS = true; await click('到着した！'); await click('ホーム');
    await act(async () => pendingGPS!(fix())); expect(saved()).toEqual(original);
    expect(localStorage.getItem('machiTakarabakoExp')).toBe('0');
  });
  it('opens the recorded adventure, returns home and starts the next selection without awarding again', async () => {
    await seed(); await mount(); await click('到着した！');
    expect(container.querySelector('.arrival-screen')).not.toBeNull();
    expect(container.textContent).toContain('出発時の徒歩ルート距離');
    expect(container.textContent).toContain('約1.3km');
    expect(container.textContent).toContain('実際に歩いた距離ではありません');
    await click('ホームに戻る'); expect(container.querySelector('.home-screen')).not.toBeNull();
    await reload(); await click('次の冒険に行く');
    expect(container.querySelector('.condition-screen')).not.toBeNull();
    expect(localStorage.getItem('machiTakarabakoExp')).toBe('20');
  });
  it('keeps the existing rating form and submission after treasure arrival', async () => {
    vi.mocked(submitTreasureRating).mockResolvedValueOnce({ averageRating: 5, ratingCount: 1 });
    await seed(true); await mount(); await click('到着した！');
    expect(container.querySelector('.arrival-rank')).not.toBeNull();
    await click('この宝物を評価する');
    expect(container.querySelector('.treasure-rating-panel')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="5つ星"]')!.click());
    await click('評価を送信する'); expect(submitTreasureRating).toHaveBeenCalledWith(7, 5);
    expect(container.textContent).toContain('評価ありがとう');
    expect(localStorage.getItem('machiTakarabakoExp')).toBe('30');
  });

});

it('opens MyPage during an adventure and returns without changing guest records', async () => {
  const adventure = await seed(); await mount();
  const before = { ...localStorage };
  await click('マイページ');
  expect(container.querySelector('.my-page')).not.toBeNull();
  expect(container.querySelector<HTMLButtonElement>('.my-page-login')!.disabled).toBe(true);
  await click('冒険に戻る');
  expect(container.querySelector('.walking-screen')).not.toBeNull();
  expect(saved()).toEqual(adventure); expect({ ...localStorage }).toEqual(before);
});

// These regressions run after a restored Google session; no live auth or GPS service is contacted.
vi.mock('./services/accountAuth', () => ({
 isAccountPage: () => false, initializeAccount: async () => {}, loginWithGoogle: vi.fn(), logoutAccount: vi.fn(), googleAvatar: () => undefined,
 getAccountClient: () => ({auth: {getSession: async () => ({data: {session: {user: {id: 'regression-account', user_metadata: {}}, expires_at: Date.now()/1000+3600}}, error: null}), onAuthStateChange: () => ({data: {subscription: {unsubscribe: vi.fn()}}})}}),
}));

it('uses the verified arrival fix on home and keeps category/menu navigation consistent',async()=>{
 await seed();await mount();await click('到着した！');await click('ホームに戻る');
 expect(container.textContent).toContain('現在地の取得履歴あり');expect(container.textContent).not.toContain('たからんを押して現在地を取得');
 geolocation.mockClear();await click('公園・自然');expect(container.querySelector('.condition-screen')).not.toBeNull();expect(geolocation).not.toHaveBeenCalled();
 await click('ホーム');await click('距離と気分から宝物を探す');expect(container.querySelector('.condition-screen')).not.toBeNull();
 await click('ホーム');await act(async()=>container.querySelector<HTMLButtonElement>('.bottom-nav button:nth-child(3)')!.click());expect(container.querySelector('.condition-screen')).not.toBeNull();expect(alert).not.toHaveBeenCalled();expect(localStorage.getItem('machiTakarabakoExp')).toBe('20');
});
it('allows condition selection after reload but requires fresh GPS at the coin, keeping rewards on failure',async()=>{
 const complete=await seed();localStorage.setItem(ACTIVE_ADVENTURE_KEY,JSON.stringify({...complete,rewardClaimed:true,completedAt:Date.now(),arrival:complete.departure}));await mount();await click('ホーム');geolocation.mockClear();
 await click('カフェ');expect(container.querySelector('.condition-screen')).not.toBeNull();expect(geolocation).not.toHaveBeenCalled();await click('1km');await click('冒険コインを作る');failGPS=true;await click('ガチャを回しに行こう！');
 expect(geolocation).toHaveBeenCalledOnce();expect(container.querySelector('.gacha-screen')).toBeNull();expect(container.textContent).toContain('位置情報が許可されていません');expect(saved().rewardClaimed).toBe(true);
});

it('can remove an oversized rejected photo and retry without losing the name or adventure',async()=>{
 const original=await seed();await mount();await click('宝物を見つけた！');vi.mocked(uploadTreasureImage).mockRejectedValueOnce(new TreasureSaveError(saveDiagnostic({status:413},'image_upload')));
 await act(async()=>{Simulate.change(container.querySelector('input[placeholder="例：路地裏の小さな喫茶店"]')!,{target:{value:'残す名前'}} as never);Simulate.change(container.querySelector('select')!,{target:{value:'📷 写真スポット'}} as never);Simulate.change(container.querySelector('input[type="file"]')!,{target:{files:[new File(['photo'],'photo.jpg',{type:'image/jpeg'})]}} as never);});
 await act(async()=>Simulate.submit(container.querySelector('form')!));expect(container.textContent).toContain('1枚5MB');expect(createTreasure).not.toHaveBeenCalled();await click('写真を外す');
 expect(container.querySelector<HTMLInputElement>('input[placeholder="例：路地裏の小さな喫茶店"]')!.value).toBe('残す名前');await act(async()=>Simulate.submit(container.querySelector('form')!));expect(createTreasure).toHaveBeenCalledWith(expect.objectContaining({name:'残す名前',image_url:null}));expect(uploadTreasureImage).toHaveBeenCalledOnce();expect(saved()).toEqual(original);
});
