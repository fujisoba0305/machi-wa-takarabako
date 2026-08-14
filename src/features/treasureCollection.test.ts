import { describe, expect, it } from 'vitest';
import {
buildTreasureCollection,
countTreasureRanks,
filterTreasureCollection,
getNextTreasureRankProgress,
} from './treasureCollection';
import type { Treasure } from '../services/treasures';

const treasure = (id: number, discovery_count: number, image_url: string | null = null): Treasure => ({
id, name: `長い宝物名${id}`, comment: '長いコメントでも自然に表示する', category: 'その他',
latitude: 35, longitude: 139, image_url, discovery_count,
});

describe('treasure collection', () => {
it('builds photo and no-photo items with every rank and zero-rating fallback', () => {
const items = buildTreasureCollection(
[treasure(1, 0, 'https://example.com/a.jpg'), treasure(2, 3), treasure(3, 10), treasure(4, 30)],
{
2: { averageRating: 3.5, ratingCount: 2 },
3: { averageRating: 4, ratingCount: 5 },
4: { averageRating: 4.5, ratingCount: 10 },
}
);
expect(items.map((item) => item.rank.key)).toEqual(['bronze', 'silver', 'gold', 'legend']);
expect(items[0].summary).toEqual({ averageRating: 0, ratingCount: 0 });
expect(items[0].treasure.image_url).toContain('jpg');
expect(items[1].treasure.image_url).toBeNull();
expect(countTreasureRanks(items)).toEqual({ bronze: 1, silver: 1, gold: 1, legend: 1 });
expect(filterTreasureCollection(items, 'gold')).toHaveLength(1);
expect(filterTreasureCollection(items, 'all')).toHaveLength(4);
});

it('handles an empty collection', () => {
expect(buildTreasureCollection([], {})).toEqual([]);
});

it('calculates remaining conditions from shared thresholds', () => {
expect(getNextTreasureRankProgress(2, { averageRating: 4, ratingCount: 1 })).toMatchObject({
discoveriesRemaining: 1, ratingsRemaining: 1, requiredAverage: 3.5,
});
});

it('has no next rank after legend', () => {
expect(getNextTreasureRankProgress(30, { averageRating: 4.5, ratingCount: 10 })).toBeNull();
});
});
