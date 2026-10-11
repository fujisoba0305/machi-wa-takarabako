// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GachaScreen } from './GachaScreen';
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('gacha presentation controls', () => {
  it('guards both controls synchronously, then reveals once without writing storage', () => {
    const reveal = vi.fn(); const storage = vi.spyOn(Storage.prototype, 'setItem');
    act(() => root.render(<GachaScreen mood="自然" distance="1km" capsuleIcon="🌳" onReveal={reveal} />));
    const controls = [...container.querySelectorAll('button')];
    act(() => { controls[0].click(); controls[1].click(); controls[0].click(); });
    expect(controls.every(button => button.disabled)).toBe(true);
    act(() => vi.advanceTimersByTime(1800));
    expect(container.querySelector('.forest-gacha--step-3')).not.toBeNull();
    expect(container.querySelectorAll('.forest-gacha-prize')).toHaveLength(1);
    act(() => vi.runAllTimers()); expect(reveal).toHaveBeenCalledOnce();
    expect(storage).not.toHaveBeenCalled(); storage.mockRestore();
  });
  it('honors the device reduced-motion preference and skips the moving phases', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const reveal = vi.fn();
    act(() => root.render(<GachaScreen mood="自然" distance="1km" capsuleIcon="🌳" onReveal={reveal} />));
    act(() => container.querySelector('button')!.click());
    expect(container.querySelector('.forest-gacha--step-3')).not.toBeNull();
    act(() => vi.advanceTimersByTime(450)); expect(reveal).toHaveBeenCalledOnce();
  });
  it('does not navigate after unmounting during an animation', () => {
    const reveal = vi.fn();
    act(() => root.render(<GachaScreen mood="自然" distance="1km" capsuleIcon="🌳" onReveal={reveal} />));
    act(() => container.querySelector('button')!.click());
    act(() => root.render(<div>ホーム</div>)); act(() => vi.runAllTimers());
    expect(reveal).not.toHaveBeenCalled(); expect(container.textContent).toBe('ホーム');
  });
});
