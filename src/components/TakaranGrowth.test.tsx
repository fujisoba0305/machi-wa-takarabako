// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { TakaranGrowth } from './TakaranGrowth';
import { PERSONAL_DISCOVERIES_PREFIX } from '../features/personalDiscoveries';
import { TAKARAN_GROWTH_PREFIX } from '../features/takaranGrowth';
let root: Root, container: HTMLDivElement;
function book(n: number, uid = 'a', category = '☕ カフェ') {
  localStorage.setItem(PERSONAL_DISCOVERIES_PREFIX + uid, JSON.stringify({ version: 1, discovererUid: uid,
    records: Array.from({ length: n }, (_, i) => ({ key: 'treasure:' + (i + 1), source: 'treasure', adventureId: 'arrival-' + i, firstDiscoveredAt: new Date(100000 + i * 1000).toISOString(), treasure: { id: i + 1, name: '発見済み', category, comment: '', latitude: 35, longitude: 139, image_url: null } })) }));
}
async function render(uid = 'a', adventureInProgress = false) { await act(async () => root.render(<TakaranGrowth key={uid} uid={uid} adventureInProgress={adventureInProgress} />)); }
async function click(text: string) { const button = [...container.querySelectorAll('button')].find(b => { const label = b.cloneNode(true) as HTMLElement; label.querySelectorAll('[aria-hidden="true"]').forEach(n => n.remove()); return label.textContent === text; }); if (!button) throw Error('Button not found: ' + text); await act(async () => button.click()); }
beforeEach(() => { localStorage.clear(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); vi.stubGlobal('fetch', vi.fn(() => { throw Error('Growth must not fetch'); })); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('shows base, progress, remaining discoveries and thirteen entries with locked names/images hidden', async () => {
  book(4); await render(); expect(container.textContent).toContain('たからん Lv.4'); expect(container.textContent).toContain('4 / 5個の宝物を発見'); expect(container.textContent).toContain('あと1個でLv.5！'); expect(container.querySelector('progress')?.value).toBe(50);
  expect(container.querySelectorAll('.takaran-growth-gallery li')).toHaveLength(0); await click('進化図鑑を見る');
  expect(container.querySelectorAll('.takaran-growth-gallery li')).toHaveLength(13); expect(container.querySelectorAll('.locked')).toHaveLength(12);
  const levelLabels = [...container.querySelectorAll('.takaran-growth-gallery small')].map(label => label.textContent);
  expect(levelLabels.filter(label => label === 'Lv.20・？？？')).toHaveLength(4); expect(levelLabels.filter(label => label === 'Lv.30・？？？')).toHaveLength(4);
  expect(container.querySelectorAll('.locked img')).toHaveLength(0); expect(container.textContent).not.toContain('もぐもぐたからん'); expect(container.querySelector('.takaran-growth-item')).not.toBeNull(); expect(fetch).not.toHaveBeenCalled();
});
it('isolates UID switching and restores the locked route on remount without replay after skipping', async () => {
  book(20); book(1, 'b'); await render(); expect(container.textContent).toContain('もぐもぐたからん'); await click('進化図鑑を見る'); expect(container.querySelectorAll('.unlocked')).toHaveLength(1);
  expect(container.querySelector('.takaran-growth-celebration')).not.toBeNull(); await click('演出をスキップ'); expect(container.querySelector('.takaran-growth-celebration')).toBeNull();
  await render('b'); expect(container.textContent).toContain('たからん Lv.2'); expect(container.textContent).not.toContain('もぐもぐたからん');
  await render(); expect(container.textContent).toContain('もぐもぐたからん'); expect(container.querySelector('.takaran-growth-celebration')).toBeNull();
  expect(container.querySelectorAll('.takaran-growth-gallery li')).toHaveLength(0);
});
it('never interrupts an in-progress adventure and plays the short skippable presentation afterwards', async () => {
  vi.useFakeTimers(); book(20); await render('a', true); expect(container.querySelector('.takaran-growth-celebration')).toBeNull();
  await render('a', false); expect(container.querySelector('.takaran-growth-celebration')).not.toBeNull(); await act(async () => vi.advanceTimersByTime(2500));
  expect(container.querySelector('.takaran-growth-celebration')).toBeNull(); expect(JSON.parse(localStorage.getItem(TAKARAN_GROWTH_PREFIX + 'a')!).acknowledgedStage).toBe(10);
});
it('handles corrupt records without falsely showing Lv1 or overwriting anything', async () => {
  localStorage.setItem(PERSONAL_DISCOVERIES_PREFIX + 'a', 'broken'); const before = { ...localStorage }; await render();
  expect(container.textContent).toContain('確認できません'); expect(container.textContent).not.toContain('たからん Lv.1'); expect({ ...localStorage }).toEqual(before);
});
it('handles quota failure without losing book or EXP and permits safe retry', async () => {
  book(20); localStorage.setItem('machiTakarabakoExp', '1234'); const before = { ...localStorage };
  const original = Storage.prototype.setItem;
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key, value) { if (key.startsWith(TAKARAN_GROWTH_PREFIX)) throw Error('quota'); original.call(this, key, value); });
  await render(); expect(container.textContent).toContain('進化先を保存できません'); expect(container.querySelector('.unlocked')).toBeNull(); expect({ ...localStorage }).toEqual(before);
  spy.mockRestore(); await click('育成情報を再確認'); expect(container.textContent).toContain('もぐもぐたからん'); expect(localStorage.getItem('machiTakarabakoExp')).toBe('1234');
});
it('shows CSS growth effects and hints without revealing an unevolved name', async () => {
  book(10, 'a', '🌳 自然'); await render(); expect(container.querySelector('.has-glow.omen-nature')).not.toBeNull(); expect(container.textContent).toContain('自然の力'); expect(container.textContent).not.toContain('リーフたからん');
});
it('respects reduced-motion preference via CSS and loads no locked evolution image', () => {
  const css = fs.readFileSync('src/components/TakaranGrowth.css', 'utf8'); expect(css).toContain('@media(prefers-reduced-motion:reduce)'); expect(css).toContain('animation:none !important'); expect(css).toContain('.takaran-growth *::after');
});
it('opens and closes the gallery without storage writes, new requests or changed growth', async () => {
  book(10); await render('a', true); const before = { ...localStorage }; const progress = container.querySelector('progress')!.value;
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  const button = container.querySelector<HTMLButtonElement>('.takaran-growth-gallery-toggle')!;
  expect(button.getAttribute('aria-expanded')).toBe('false'); expect(document.getElementById(button.getAttribute('aria-controls')!)?.hidden).toBe(true);
  await click('進化図鑑を見る'); expect(button.getAttribute('aria-expanded')).toBe('true'); expect(container.querySelectorAll('.takaran-growth-gallery li')).toHaveLength(13);
  await click('進化図鑑を閉じる'); expect(button.getAttribute('aria-expanded')).toBe('false'); expect(container.querySelectorAll('.takaran-growth-gallery img')).toHaveLength(0);
  expect(container.querySelector('progress')!.value).toBe(progress); expect({ ...localStorage }).toEqual(before); expect(writes).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it.each([[2, 3, '2 / 3', 'あと1個でLv.4！', 0], [5, 5, '5 / 7', 'あと2個でLv.6！', 0], [10, 7, '10 / 13', 'あと3個でLv.8！', 0], [12, 7, '12 / 13', 'あと1個でLv.8！', 200 / 3], [20, 10, '20個', 'Lv.10達成！', 100], [25, 10, '25個', 'Lv.10達成！', 100]])('shows interval progress for %i discoveries', async (n, level, count, next, progress) => {
  book(n as number); await render('a', true); expect(container.textContent).toContain(`たからん Lv.${level}`); expect(container.textContent).toContain(String(count)); expect(container.textContent).toContain(String(next)); expect(container.querySelector('progress')!.value).toBeCloseTo(progress as number);
});
it.each([['☕ カフェ', 'food'], ['🌳 自然', 'nature'], ['⛩️ 神社・お寺', 'history'], ['🏪 お店', 'city']])('shows four peripheral CSS ornaments for %s without exposing the evolution name', async (category, route) => {
  book(10, 'a', category); await render('a', true); const symbols = container.querySelector('.takaran-growth-symbols')!;
  expect(symbols.getAttribute('data-omen')).toBe(route); expect(symbols.getAttribute('aria-hidden')).toBe('true'); expect(symbols.children).toHaveLength(4); expect(container.querySelector('.takaran-growth-portrait')!.className).toContain('omen-' + route); expect(container.querySelectorAll('.takaran-growth-portrait img')).toHaveLength(1);
});
it('keeps Lv3 without wing effects, adds a steady Lv5 aura, and never decorates an uncertain route', async () => {
  book(2); await render(); expect(container.querySelector('.has-item')).not.toBeNull(); expect(container.querySelector('.has-glow')).toBeNull(); expect(container.querySelector('.takaran-growth-symbols')).toBeNull();
  await act(async () => root.render(<div/>)); book(5); await render(); expect(container.querySelector('.has-glow')).not.toBeNull(); expect(container.querySelector('.takaran-growth-item')).not.toBeNull();
  await act(async () => root.render(<div/>)); book(10, 'a', '💎 その他'); await render(); expect(container.querySelector('.takaran-growth-symbols')).toBeNull();
  const css = fs.readFileSync('src/components/TakaranGrowth.css', 'utf8'); expect(css).toContain('#a6f4d3cc'); expect(css).toContain('opacity:.78');
});
it('retains a retryable notice for a missing supplied image', async () => {
  await render(); await act(async () => container.querySelector('.takaran-growth-portrait img')!.dispatchEvent(new Event('error'))); expect(container.textContent).toContain('画像を読み込めません'); expect(container.textContent).toContain('たからん Lv.1');
});
