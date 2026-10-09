// @vitest-environment jsdom
import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { HomeExplore, DestinationPhoto } from './HomeExplore';
it('connects the home categories, search and collection to their existing actions', () => {
  const container = document.createElement('div'); const root = createRoot(container);
  const explore = vi.fn(); const collection = vi.fn();
  act(() => root.render(<HomeExplore name="冒険者" onExplore={explore} onCollection={collection} />));
  const buttons = [...container.querySelectorAll('button')];
  act(() => buttons.find(b => b.textContent?.includes('カフェ'))!.click());
  expect(explore).toHaveBeenLastCalledWith('カフェ');
  act(() => buttons.find(b => b.textContent?.includes('距離と気分'))!.click());
  expect(explore).toHaveBeenLastCalledWith();
  act(() => buttons.find(b => b.textContent?.includes('みんなが'))!.click());
  expect(collection).toHaveBeenCalledOnce();
  act(() => root.unmount());
});
it('shows a truthful fallback for missing or failed destination photos', () => {
  const container = document.createElement('div'); const root = createRoot(container);
  act(() => root.render(<DestinationPhoto name="目的地" />));
  expect(container.textContent).toContain('カテゴリイメージ');
  act(() => root.render(<DestinationPhoto name="目的地" url="/missing.jpg" />));
  expect(container.querySelector('img')?.alt).toBe('目的地');
  act(() => Simulate.error(container.querySelector('img')!));
  expect(container.querySelector('img')?.getAttribute('src')).not.toBe('/missing.jpg');
  act(() => Simulate.error(container.querySelector('img')!));
  expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).toContain('カテゴリイメージ');
  act(() => root.unmount());
});
