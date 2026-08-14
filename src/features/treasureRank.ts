import type { TreasureRatingSummary } from './treasureRatings';
import type { Treasure } from '../services/treasures';

export type TreasureRankKey = 'bronze' | 'silver' | 'gold' | 'legend';

export type TreasureRank = {
key: TreasureRankKey;
level: number;
label: string;
shortLabel: string;
description: string;
};

export const treasureRanks: Record<TreasureRankKey, TreasureRank> = {
bronze: {
key: 'bronze',
level: 0,
label: '🥉 BRONZE TREASURE',
shortLabel: '🥉 BRONZE',
description: 'まだ知られていない街の小さな宝物',
},
silver: {
key: 'silver',
level: 1,
label: '🥈 SILVER TREASURE',
shortLabel: '🥈 SILVER',
description: '少しずつ冒険者に知られ始めた宝物',
},
gold: {
key: 'gold',
level: 2,
label: '🥇 GOLD TREASURE',
shortLabel: '🥇 GOLD',
description: '多くの冒険者に愛される街の宝物',
},
legend: {
key: 'legend',
level: 3,
label: '💎 LEGEND TREASURE',
shortLabel: '💎 LEGEND',
description: '冒険者たちが認めた伝説の宝物',
},
};

export const treasureRankRequirements = {
silver: { discoveries: 3, ratings: 2, average: 3.5 },
gold: { discoveries: 10, ratings: 5, average: 4.0 },
legend: { discoveries: 30, ratings: 10, average: 4.5 },
} as const;

function meetsRequirements(
discoveryCount: number,
summary: TreasureRatingSummary,
requirements: { discoveries: number; ratings: number; average: number }
) {
return (
discoveryCount >= requirements.discoveries &&
summary.ratingCount >= requirements.ratings &&
summary.averageRating >= requirements.average
);
}

export function getTreasureRank(
discoveryCount: number,
summary: TreasureRatingSummary
) {
if (meetsRequirements(discoveryCount, summary, treasureRankRequirements.legend)) {
return treasureRanks.legend;
}
if (meetsRequirements(discoveryCount, summary, treasureRankRequirements.gold)) {
return treasureRanks.gold;
}
if (meetsRequirements(discoveryCount, summary, treasureRankRequirements.silver)) {
return treasureRanks.silver;
}
return treasureRanks.bronze;
}

export function getTreasureRankForResult(
treasure: Treasure | null,
summary: TreasureRatingSummary
) {
if (!treasure) return null;
return getTreasureRank(treasure.discovery_count ?? 0, summary);
}

export function isTreasureRankUp(previous: TreasureRank, next: TreasureRank) {
return next.level > previous.level;
}

export function getTreasureRatingStars(summary: TreasureRatingSummary) {
if (summary.ratingCount === 0) return '☆☆☆☆☆';

const fullStars = Math.min(5, Math.max(0, Math.floor(summary.averageRating)));
return `${'★'.repeat(fullStars)}${'☆'.repeat(5 - fullStars)}`;
}
