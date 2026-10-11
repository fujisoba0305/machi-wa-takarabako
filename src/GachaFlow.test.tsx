// @vitest-environment jsdom
import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { getNearbyParks } from './services/overpass';
import { getWalkingDistances } from './services/walkingDistance';
import { getTreasures } from './services/treasures';

vi.mock('./services/overpass', () => ({ getNearbyParks: vi.fn() }));
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
async function enterGacha() {
  await act(async () => root.render(<App />));
  await act(async () => Simulate.change(container.querySelector('input')!, { target: { value: '冒険者' } } as never));
  await act(async () => Simulate.submit(container.querySelector('form')!));
  await click('公園・自然'); await click('1km');
  const coin = container.querySelector<HTMLButtonElement>('.adventure-coin-button')!;
  expect(coin.disabled).toBe(false); await act(async () => coin.click()); await click('ガチャを回しに行こう！');
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('alert', vi.fn());
  window.scrollTo = vi.fn();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(success: PositionCallback) { success({ coords: { latitude: 35, longitude: 139, accuracy: 10 }, timestamp: Date.now() } as GeolocationPosition); } } });
  vi.mocked(getNearbyParks).mockResolvedValue([spot]); vi.mocked(getTreasures).mockResolvedValue([]);
  vi.mocked(getWalkingDistances).mockImplementation(async (_, destinations) => destinations.map(d => ({ id: d.id, status: 'OK', distanceMeters: 900 })));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

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
    expect(container.textContent).toContain('スポットが見つかりませんでした');
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
