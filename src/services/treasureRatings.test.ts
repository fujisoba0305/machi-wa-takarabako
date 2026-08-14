import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('./supabase', () => ({
getSupabaseClient: () => ({ rpc }),
}));

import { getTreasureRatingSummaries, getTreasureRatingSummary, submitTreasureRating } from './treasureRatings';

describe('treasure rating service', () => {
beforeEach(() => rpc.mockReset());

it('loads an aggregated summary', async () => {
rpc.mockResolvedValue({
data: [{ average_rating: '4.6', rating_count: 12 }],
error: null,
});

await expect(getTreasureRatingSummary(42)).resolves.toEqual({
averageRating: 4.6,
ratingCount: 12,
});
expect(rpc).toHaveBeenCalledWith('get_treasure_rating_summary', {
p_treasure_id: 42,
});
});

it('loads all summaries in one RPC call', async () => {
rpc.mockResolvedValue({ data: [
{ treasure_id: 4, average_rating: '4.2', rating_count: 5 },
{ treasure_id: 8, average_rating: 0, rating_count: 0 },
], error: null });
await expect(getTreasureRatingSummaries()).resolves.toEqual({
4: { averageRating: 4.2, ratingCount: 5 },
8: { averageRating: 0, ratingCount: 0 },
});
expect(rpc).toHaveBeenCalledTimes(1);
expect(rpc).toHaveBeenCalledWith('get_treasure_rating_summaries');
});

it('submits a valid rating and returns the new aggregate', async () => {
rpc.mockResolvedValue({
data: [{ average_rating: 5, rating_count: 1 }],
error: null,
});

await expect(submitTreasureRating(42, 5)).resolves.toEqual({
averageRating: 5,
ratingCount: 1,
});
});

it('rejects invalid values before calling Supabase', async () => {
await expect(submitTreasureRating(42, 6)).rejects.toThrow(
'Treasure rating must be an integer from 1 to 5'
);
expect(rpc).not.toHaveBeenCalled();
});

it('fails independently when submission RPC fails', async () => {
rpc.mockResolvedValue({ data: null, error: { message: 'failed' } });

await expect(submitTreasureRating(42, 4)).rejects.toThrow(
'Treasure rating submission failed'
);
});
});
