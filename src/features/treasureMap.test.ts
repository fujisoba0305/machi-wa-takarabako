import { describe, expect, it } from 'vitest';
import type { Treasure } from '../services/treasures';
import { getNearbyTreasures, getTreasureCategoryIcon, getTreasureCategoryMarker, hasValidTreasureCoordinates } from './treasureMap';

const treasure = (overrides: Partial<Treasure> = {}): Treasure => ({
name: '宝物', comment: 'コメント', category: '💎 その他', latitude: 35, longitude: 139, image_url: null, ...overrides,
});

describe('treasure map display helpers', () => {
it.each([
['☕ カフェ', '☕'], ['🍜 グルメ', '🍜'], ['⛩️ 神社・お寺', '⛩️'], ['🌳 自然', '🌳'],
['📷 写真スポット', '📷'], ['🏪 お店', '🏪'], ['💎 その他', '💎'],
])('maps %s to %s', (category, icon) => expect(getTreasureCategoryIcon(category)).toBe(icon));
it('falls back for an unknown category', () => expect(getTreasureCategoryIcon('未分類')).toBe('💎'));
it.each([
['☕ カフェ', 'cafe'], ['🍜 グルメ', 'gourmet'], ['⛩️ 神社・お寺', 'shrine'],
['🌳 自然', 'nature'], ['📷 写真スポット', 'photo'], ['🏪 お店', 'shop'],
['💎 その他', 'other'],
])('assigns the %s marker theme', (category, theme) => {
expect(getTreasureCategoryMarker(category).theme).toBe(theme);
});
it('uses the other marker design as the visual fallback', () => {
expect(getTreasureCategoryMarker('未分類')).toEqual({ icon: '💎', theme: 'other' });
});
it('accepts treasures both with and without image_url', () => {
expect(hasValidTreasureCoordinates(treasure({ image_url: 'https://example.com/a.jpg' }))).toBe(true);
expect(hasValidTreasureCoordinates(treasure({ image_url: null }))).toBe(true);
});
it('keeps nearby treasures with and without photos and excludes distant treasures', () => {
const nearbyWithPhoto = treasure({ latitude: 35, longitude: 139.01, image_url: 'https://example.com/a.jpg' });
const nearbyWithoutPhoto = treasure({ latitude: 35.01, longitude: 139, image_url: null });
const distant = treasure({ latitude: 35.1, longitude: 139.1 });

expect(getNearbyTreasures(
[nearbyWithPhoto, nearbyWithoutPhoto, distant],
{ latitude: 35, longitude: 139 }
)).toEqual([nearbyWithPhoto, nearbyWithoutPhoto]);
});
});
