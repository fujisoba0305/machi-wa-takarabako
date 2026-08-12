import { describe, expect, it } from 'vitest';
import type { Treasure } from '../services/treasures';
import { getTreasureCategoryIcon, hasValidTreasureCoordinates } from './treasureMap';

const treasure = (overrides: Partial<Treasure> = {}): Treasure => ({
name: '宝物', comment: 'コメント', category: '💎 その他', latitude: 35, longitude: 139, image_url: null, ...overrides,
});

describe('treasure map display helpers', () => {
it.each([
['☕ カフェ', '☕'], ['🍜 グルメ', '🍜'], ['⛩️ 神社・お寺', '⛩️'], ['🌳 自然', '🌳'],
['📷 写真スポット', '📷'], ['🏪 お店', '🏪'], ['💎 その他', '💎'],
])('maps %s to %s', (category, icon) => expect(getTreasureCategoryIcon(category)).toBe(icon));
it('falls back for an unknown category', () => expect(getTreasureCategoryIcon('未分類')).toBe('💎'));
it('accepts treasures both with and without image_url', () => {
expect(hasValidTreasureCoordinates(treasure({ image_url: 'https://example.com/a.jpg' }))).toBe(true);
expect(hasValidTreasureCoordinates(treasure({ image_url: null }))).toBe(true);
});
});
