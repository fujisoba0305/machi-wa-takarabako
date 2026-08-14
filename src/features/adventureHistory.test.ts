import { describe, expect, it } from 'vitest';
import {
addAdventureDiscovery,
formatAdventureDiscoveryDate,
joinAdventureHistory,
loadAdventureHistory,
parseAdventureHistory,
recordArrivedTreasure,
} from './adventureHistory';
import { buildTreasureCollection } from './treasureCollection';
import type { Treasure } from '../services/treasures';

const treasure = (id: number, discovery_count = 0): Treasure => ({
id, name: `宝物${id}`, comment: '', category: 'その他', latitude: 35,
longitude: 139, image_url: null, discovery_count,
});

describe('adventure history', () => {
it('adds the first arrival and preserves its date on revisit', () => {
const first = addAdventureDiscovery([], 4, '2026-08-14T01:00:00.000Z');
const revisit = addAdventureDiscovery(first, 4, '2026-08-15T01:00:00.000Z');
expect(revisit).toEqual(first);
expect(revisit).toHaveLength(1);
});

it('adds another treasure without duplicating existing discoveries', () => {
const history = addAdventureDiscovery(
[{ treasureId: 4, firstDiscoveredAt: '2026-08-14T01:00:00.000Z' }],
12, '2026-08-15T01:00:00.000Z'
);
expect(history.map((item) => item.treasureId)).toEqual([4, 12]);
});

it.each([null, '', 'not-json', '{}', '[1,4,12]', '[{"treasureId":"bad"}]'])('recovers safely from missing or corrupt storage', (raw) => {
expect(parseAdventureHistory(raw)).toEqual([]);
});

it('recovers when localStorage access itself fails', () => {
expect(loadAdventureHistory({
getItem: () => { throw new Error('blocked'); },
setItem: () => undefined,
})).toEqual([]);
});

it('does not record before arrival or record an Overpass result', () => {
expect(recordArrivedTreasure([], treasure(4), false)).toEqual([]);
expect(recordArrivedTreasure([], null, true)).toEqual([]);
});

it('joins IDs to current Supabase data, ignores deleted treasures, and uses the latest rank', () => {
const collection = buildTreasureCollection([treasure(4, 10)], {
4: { averageRating: 4, ratingCount: 5 },
});
const joined = joinAdventureHistory([
{ treasureId: 4, firstDiscoveredAt: '2026-08-14T01:00:00.000Z' },
{ treasureId: 99, firstDiscoveredAt: '2026-08-13T01:00:00.000Z' },
], collection);
expect(joined).toHaveLength(1);
expect(joined[0].treasure.name).toBe('宝物4');
expect(joined[0].rank.key).toBe('gold');
});

it('handles an empty history', () => {
expect(joinAdventureHistory([], buildTreasureCollection([treasure(1)], {}))).toEqual([]);
});

it('formats the first discovery as a Japanese date without time and hides invalid dates', () => {
expect(formatAdventureDiscoveryDate('2026-08-14T01:00:00.000Z')).toBe('2026年8月14日');
expect(formatAdventureDiscoveryDate('invalid')).toBe('');
});
});
