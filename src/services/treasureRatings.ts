import { getSupabaseClient } from './supabase';
import {
isValidTreasureRating,
type TreasureRatingSummary,
} from '../features/treasureRatings';

type RatingSummaryRow = {
treasure_id?: number | string;
average_rating: number | string | null;
rating_count: number | string;
};

function parseRatingSummary(data: unknown): TreasureRatingSummary {
const row = Array.isArray(data) ? data[0] : data;

if (!row || typeof row !== 'object') {
throw new Error('Treasure rating RPC returned an invalid summary');
}

const summary = row as RatingSummaryRow;
const averageRating = Number(summary.average_rating ?? 0);
const ratingCount = Number(summary.rating_count);

if (!Number.isFinite(averageRating) || !Number.isInteger(ratingCount) || ratingCount < 0) {
throw new Error('Treasure rating RPC returned invalid values');
}

return { averageRating, ratingCount };
}

export async function getTreasureRatingSummaries() {
const supabase = getSupabaseClient();
const { data, error } = await supabase.rpc('get_treasure_rating_summaries');
if (error) throw new Error('Treasure rating summaries fetch failed');

return ((data ?? []) as RatingSummaryRow[]).reduce<Record<number, TreasureRatingSummary>>(
(summaries, row) => {
const treasureId = Number(row.treasure_id);
if (!Number.isInteger(treasureId)) return summaries;
summaries[treasureId] = parseRatingSummary(row);
return summaries;
},
{}
);
}

export async function getTreasureRatingSummary(treasureId: number) {
const supabase = getSupabaseClient();
const { data, error } = await supabase.rpc('get_treasure_rating_summary', {
p_treasure_id: treasureId,
});

if (error) throw new Error('Treasure rating summary fetch failed');

return parseRatingSummary(data);
}

export async function submitTreasureRating(treasureId: number, rating: number) {
if (!isValidTreasureRating(rating)) {
throw new Error('Treasure rating must be an integer from 1 to 5');
}

const supabase = getSupabaseClient();
const { data, error } = await supabase.rpc('submit_treasure_rating', {
p_treasure_id: treasureId,
p_rating: rating,
});

if (error) throw new Error('Treasure rating submission failed');

return parseRatingSummary(data);
}
