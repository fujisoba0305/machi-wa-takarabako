// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppIcon, IconText, plainIconLabel } from './AppIcon';
import { categoryMarkerSvg } from './categoryMarkerSvg';

function render(text: string) {
  const element = document.createElement('div');
  element.innerHTML = renderToStaticMarkup(<IconText text={text} />);
  return element;
}
describe('presentation-only SVG icons', () => {
  it('renders legacy category labels without changing their saved value', () => {
    const stored = '⛩️ 神社・お寺';
    const element = render(stored);
    expect(stored).toBe('⛩️ 神社・お寺');
    expect(element.textContent).toBe(' 神社・お寺');
    expect(element.querySelector('svg')?.classList.contains('app-icon--shrine')).toBe(true);
    expect(plainIconLabel(stored)).toBe('神社・お寺');
  });
  it('keeps the Japanese accessible label and hides decorative SVGs', () => {
    const element = render('💎 宝物を見つけた！');
    expect(element.textContent).toBe(' 宝物を見つけた！');
    expect(element.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('svg')?.getAttribute('focusable')).toBe('false');
  });
  it('handles multiple icons and variation selectors consistently on repeated renders', () => {
    for (let i = 0; i < 3; i++) {
      const element = render('🗺️ 地図 → ☀️');
      expect(element.querySelectorAll('svg')).toHaveLength(3);
      expect(element.textContent).toBe(' 地図  ');
    }
  });
  it('preserves rank decorations and escapes unknown text', () => {
    const element = render('🥇 GOLD <script>alert(1)</script>');
    expect(element.textContent).toBe('🥇 GOLD <script>alert(1)</script>');
    expect(element.querySelector('script')).toBeNull();
  });
  it('gives custom shrine icons the same SVG geometry and stroke as Lucide icons', () => {
    for (const name of ['shrine', 'home'] as const) {
      const element = document.createElement('div');
      element.innerHTML = renderToStaticMarkup(<AppIcon name={name} />);
      expect(element.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(element.querySelector('svg')?.getAttribute('stroke-width')).toBe('1.8');
    }
  });
  it('builds map marker SVGs only from known paths, never caller HTML', () => {
    for (const theme of ['cafe', 'gourmet', 'shrine', 'nature', 'photo', 'shop', 'other']) {
      expect(categoryMarkerSvg(theme)).toContain('<svg');
      expect(categoryMarkerSvg(theme)).toContain('aria-hidden="true"');
    }
    expect(categoryMarkerSvg('<script>')).toBe(categoryMarkerSvg('other'));
  });
});
