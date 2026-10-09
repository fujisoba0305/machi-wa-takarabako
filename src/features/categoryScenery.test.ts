import { describe, expect, it } from 'vitest';
import { categoryScenery } from './categoryScenery';
describe('category imagery', () => {
  it.each([['公園・自然','公園・自然'],['☕ カフェ','カフェ'],['グルメ','グルメ'],['⛩ 神社・お寺','神社・お寺'],['📷 写真スポット','景色・写真'],['未分類','街歩き']])('maps %s to a local illustrative photograph', (input, expected) => {
    expect(categoryScenery(input).label).toBe(expected);
    expect(categoryScenery(input).url).toMatch(/\.webp/);
    expect(categoryScenery(input).url).not.toMatch(/^https?:/);
  });
});
