import { describe, expect, it } from 'vitest';
import type { Treasure } from '../services/treasures';
import {
canRateTreasure,
getTreasureRatingMessage,
isValidTreasureRating,
} from './treasureRatings';

const treasure: Treasure = {
id: 42,
name: '宝物',
comment: '',
category: '💎 その他',
latitude: 35,
longitude: 139,
image_url: null,
};

describe('treasure ratings', () => {
it('allows ratings only after arriving at a registered treasure', () => {
expect(canRateTreasure(treasure, false)).toBe(false);
expect(canRateTreasure(treasure, true)).toBe(true);
expect(canRateTreasure(null, true)).toBe(false);
});

it.each([1, 2, 3, 4, 5])('accepts rating %i', (rating) => {
expect(isValidTreasureRating(rating)).toBe(true);
});

it.each([0, 6, 1.5, Number.NaN])('rejects invalid rating %s', (rating) => {
expect(isValidTreasureRating(rating)).toBe(false);
});

it('formats zero and aggregated rating summaries', () => {
expect(getTreasureRatingMessage({ averageRating: 0, ratingCount: 0 }))
.toBe('⭐ まだ評価はありません');
expect(getTreasureRatingMessage({ averageRating: 4.56, ratingCount: 12 }))
.toBe('⭐ 4.6（12件）');
});
});
