import type { Treasure } from '../services/treasures';
import type { TreasureRatingSummary } from './treasureRatings';
import {
getTreasureRank,
treasureRankRequirements,
treasureRanks,
type TreasureRank,
type TreasureRankKey,
} from './treasureRank';

export type TreasureRatingSummaryMap = Record<number, TreasureRatingSummary>;
export type TreasureCollectionItem = {
treasure: Treasure;
summary: TreasureRatingSummary;
rank: TreasureRank;
};

export function buildTreasureCollection(
treasures: Treasure[],
summaries: TreasureRatingSummaryMap
): TreasureCollectionItem[] {
return treasures.map((treasure) => {
const summary = treasure.id === undefined
? { averageRating: 0, ratingCount: 0 }
: summaries[treasure.id] ?? { averageRating: 0, ratingCount: 0 };
return {
treasure,
summary,
rank: getTreasureRank(treasure.discovery_count ?? 0, summary),
};
});
}

export function filterTreasureCollection(
items: TreasureCollectionItem[],
rank: TreasureRankKey | 'all'
) {
return rank === 'all' ? items : items.filter((item) => item.rank.key === rank);
}

export function countTreasureRanks(items: TreasureCollectionItem[]) {
return items.reduce<Record<TreasureRankKey, number>>(
(counts, item) => ({ ...counts, [item.rank.key]: counts[item.rank.key] + 1 }),
{ bronze: 0, silver: 0, gold: 0, legend: 0 }
);
}

export type NextTreasureRankProgress = {
rank: TreasureRank;
discoveriesRemaining: number;
ratingsRemaining: number;
requiredAverage: number;
} | null;

export function getNextTreasureRankProgress(
discoveryCount: number,
summary: TreasureRatingSummary
): NextTreasureRankProgress {
const current = getTreasureRank(discoveryCount, summary);
const nextKey = current.key === 'bronze' ? 'silver'
: current.key === 'silver' ? 'gold'
: current.key === 'gold' ? 'legend'
: null;
if (!nextKey) return null;
const requirement = treasureRankRequirements[nextKey];
return {
rank: treasureRanks[nextKey],
discoveriesRemaining: Math.max(0, requirement.discoveries - discoveryCount),
ratingsRemaining: Math.max(0, requirement.ratings - summary.ratingCount),
requiredAverage: requirement.average,
};
}
