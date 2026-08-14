import { describe, expect, it } from 'vitest';
import {
getTreasureRank,
getTreasureRankForResult,
getTreasureRatingStars,
isTreasureRankUp,
treasureRanks,
} from './treasureRank';

describe('treasure rank', () => {
it('uses bronze for zero discoveries and ratings', () => {
expect(getTreasureRank(0, { averageRating: 0, ratingCount: 0 }).key).toBe('bronze');
});

it('promotes to silver at every silver threshold', () => {
expect(getTreasureRank(3, { averageRating: 3.5, ratingCount: 2 }).key).toBe('silver');
});

it.each([
[2, 3.5, 2],
[3, 3.5, 1],
[3, 3.4, 2],
])('does not promote to silver when one condition is missing', (discoveries, average, ratings) => {
expect(getTreasureRank(discoveries, { averageRating: average, ratingCount: ratings }).key)
.toBe('bronze');
});

it('promotes to gold at every gold threshold', () => {
expect(getTreasureRank(10, { averageRating: 4, ratingCount: 5 }).key).toBe('gold');
});

it('promotes to legend before considering gold', () => {
expect(getTreasureRank(30, { averageRating: 4.5, ratingCount: 10 }).key).toBe('legend');
});

it('formats unrated and rated stars without hiding the decimal score', () => {
expect(getTreasureRatingStars({ averageRating: 0, ratingCount: 0 })).toBe('☆☆☆☆☆');
expect(getTreasureRatingStars({ averageRating: 4.6, ratingCount: 12 })).toBe('★★★★☆');
});

it('detects rank up but never reports a rank down as rank up', () => {
expect(isTreasureRankUp(treasureRanks.bronze, treasureRanks.silver)).toBe(true);
expect(isTreasureRankUp(treasureRanks.gold, treasureRanks.silver)).toBe(false);
expect(isTreasureRankUp(treasureRanks.gold, treasureRanks.gold)).toBe(false);
});

it('recalculates and promotes immediately after a qualifying rating', () => {
const before = getTreasureRank(3, { averageRating: 4, ratingCount: 1 });
const after = getTreasureRank(3, { averageRating: 3.5, ratingCount: 2 });

expect(before.key).toBe('bronze');
expect(after.key).toBe('silver');
expect(isTreasureRankUp(before, after)).toBe(true);
});

it('does not assign a treasure rank to an Overpass result', () => {
expect(getTreasureRankForResult(null, { averageRating: 5, ratingCount: 100 })).toBeNull();
});
});
