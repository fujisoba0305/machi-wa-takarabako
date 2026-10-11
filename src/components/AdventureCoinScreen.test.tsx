// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AdventureCoinScreen } from './AdventureCoinScreen';
let root: Root; let container: HTMLDivElement;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root=createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('adventure coin completion', () => {
  it('renders actual conditions and updates when the selected values change', () => {
    act(() => root.render(<AdventureCoinScreen distance="5km" mood="カフェ" moodIcon="☕" onContinue={vi.fn()} />));
    expect([...container.querySelectorAll('dd')].map(e=>e.textContent)).toEqual(['5km','カフェ']);
    act(() => root.render(<AdventureCoinScreen distance="？km" mood="神社・お寺" moodIcon="⛩️" onContinue={vi.fn()} />));
    expect([...container.querySelectorAll('dd')].map(e=>e.textContent)).toEqual(['？km','神社・お寺']);
    expect(container.textContent).not.toContain('5km');
  });
  it('does not create storage or call the transition because of rendering or animations', () => {
    const next=vi.fn(); const save=vi.spyOn(Storage.prototype,'setItem');
    act(() => root.render(<AdventureCoinScreen distance="1km" mood="自然" moodIcon="🌳" onContinue={next} />));
    act(() => container.querySelector('.coin-celebration-token')!.dispatchEvent(new Event('animationend',{bubbles:true})));
    expect(next).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    act(() => container.querySelector('button')!.click()); expect(next).toHaveBeenCalledOnce();
  });
});
