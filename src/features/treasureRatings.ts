import type { Treasure } from '../services/treasures';

export type TreasureRatingSummary = {
averageRating: number;
ratingCount: number;
};

export function isValidTreasureRating(rating: number) {
return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export function canRateTreasure(
treasure: Treasure | null,
hasArrived: boolean
) {
return Boolean(treasure?.id !== undefined && hasArrived);
}

export function getTreasureRatingMessage(summary: TreasureRatingSummary) {
if (summary.ratingCount === 0) return '⭐ まだ評価はありません';

return `⭐ ${summary.averageRating.toFixed(1)}（${summary.ratingCount}件）`;
}
