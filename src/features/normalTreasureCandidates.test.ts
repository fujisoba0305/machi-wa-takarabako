import { describe, expect, it } from 'vitest';
import type { Treasure } from '../services/treasures';
import {
getEligibleRegisteredTreasures,
loadNormalSearchSources,
matchesTreasureMood,
selectNormalSearchCandidate,
} from './normalTreasureCandidates';

const treasure = (overrides: Partial<Treasure> = {}): Treasure => ({
name: '登録宝物',
comment: '発見コメント',
category: '☕ カフェ',
latitude: 35,
longitude: 139.01,
image_url: null,
...overrides,
});

describe('registered treasure normal-search candidates', () => {
it.each([
['カフェ', '☕ カフェ'],
['自然', '🌳 自然'],
['写真', '📷 写真スポット'],
['ストレス解消', '🌳 自然'],
['神社・お寺', '⛩️ 神社・お寺'],
['グルメ', '🍜 グルメ'],
])('matches mood %s to category %s', (mood, category) => {
expect(matchesTreasureMood(category, mood)).toBe(true);
});

it('does not force an unrelated category into event search', () => {
expect(matchesTreasureMood('🏪 お店', 'イベント')).toBe(false);
});

it('includes in-range treasures and excludes out-of-range and mismatched treasures', () => {
const inRangeWithPhoto = treasure({ image_url: 'https://example.com/photo.jpg' });
const inRangeWithoutPhoto = treasure({ longitude: 139.015, image_url: null });
const outOfRange = treasure({ longitude: 139.2 });
const wrongCategory = treasure({ category: '🌳 自然' });

expect(getEligibleRegisteredTreasures(
[inRangeWithPhoto, inRangeWithoutPhoto, outOfRange, wrongCategory],
{ latitude: 35, longitude: 139 },
'カフェ',
{ min: 0, max: 2 }
).map(({ treasure: candidate }) => candidate)).toEqual([
inRangeWithPhoto,
inRangeWithoutPhoto,
]);
});

it('returns no registered candidates for an empty list', () => {
expect(getEligibleRegisteredTreasures(
[],
{ latitude: 35, longitude: 139 },
'おまかせ',
{ min: 0, max: 3 }
)).toEqual([]);
});

it('honors both bounds of the selected distance range', () => {
const tooClose = treasure({ longitude: 139.01 });
const inSelectedRange = treasure({ longitude: 139.03 });

expect(getEligibleRegisteredTreasures(
[tooClose, inSelectedRange],
{ latitude: 35, longitude: 139 },
'カフェ',
{ min: 2, max: 4 }
).map(({ treasure: candidate }) => candidate)).toEqual([inSelectedRange]);
});

it('selects the only available source', () => {
const registered = getEligibleRegisteredTreasures(
[treasure()],
{ latitude: 35, longitude: 139 },
'カフェ',
{ min: 0, max: 2 }
);

expect(selectNormalSearchCandidate(['overpass'], [], () => 0)).toEqual({
source: 'overpass', candidate: 'overpass',
});
expect(selectNormalSearchCandidate([], registered, () => 0)?.source).toBe('treasure');
expect(selectNormalSearchCandidate([], [], () => 0)).toBeNull();
});

it('balances by source when both sources exist instead of by item count', () => {
const registered = getEligibleRegisteredTreasures(
[treasure()],
{ latitude: 35, longitude: 139 },
'カフェ',
{ min: 0, max: 2 }
);

expect(selectNormalSearchCandidate(['a', 'b', 'c'], registered, () => 0.25)?.source).toBe('treasure');
expect(selectNormalSearchCandidate(['a', 'b', 'c'], registered, () => 0.75)?.source).toBe('overpass');
});

it('keeps Overpass candidates when Supabase loading fails', async () => {
const sources = await loadNormalSearchSources(
async () => ['overpass'],
async () => { throw new Error('Supabase unavailable'); }
);

expect(sources.overpass).toEqual(['overpass']);
expect(sources.treasures).toEqual([]);
expect(sources.treasuresError).toBeInstanceOf(Error);
});

it('keeps registered treasures when Overpass loading fails', async () => {
const registered = treasure();
const sources = await loadNormalSearchSources<string>(
async () => { throw new Error('Overpass unavailable'); },
async () => [registered]
);

expect(sources.overpass).toEqual([]);
expect(sources.treasures).toEqual([registered]);
expect(sources.overpassError).toBeInstanceOf(Error);
});
});
