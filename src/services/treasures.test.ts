import { beforeEach, describe, expect, it, vi } from 'vitest';

const select = vi.fn();
const from = vi.fn(() => ({ select }));
const rpc = vi.fn();

vi.mock('./supabase', () => ({
getSupabaseClient: () => ({ from, rpc }),
}));

import { getTreasures, incrementTreasureDiscovery } from './treasures';

describe('getTreasures', () => {
beforeEach(() => {
select.mockReset();
from.mockClear();
rpc.mockReset();
});

it('gets the display fields and preserves image URLs and nulls', async () => {
const rows = [
{ id: 1, name: '写真あり', comment: 'コメント', category: '📷 写真スポット', latitude: 35, longitude: 139, image_url: 'https://example.com/photo.jpg', discovery_count: 3 },
{ id: 2, name: '写真なし', comment: '', category: '💎 その他', latitude: 36, longitude: 140, image_url: null, discovery_count: 0 },
];
select.mockResolvedValue({ data: rows, error: null });

await expect(getTreasures()).resolves.toEqual(rows);
expect(from).toHaveBeenCalledWith('treasures');
expect(select).toHaveBeenCalledWith('id, name, comment, category, latitude, longitude, image_url, discovery_count');
});

it('throws when Supabase cannot load the list', async () => {
select.mockResolvedValue({
data: null,
error: { code: 'TEST', message: 'failed', details: '', hint: '' },
});

await expect(getTreasures()).rejects.toThrow('Treasure list fetch failed');
});

it('increments a treasure discovery atomically through RPC', async () => {
rpc.mockResolvedValue({ data: 4, error: null });

await expect(incrementTreasureDiscovery(42)).resolves.toBe(4);
expect(rpc).toHaveBeenCalledWith('increment_treasure_discovery', {
p_treasure_id: 42,
});
});

it('throws when the discovery RPC fails', async () => {
rpc.mockResolvedValue({
data: null,
error: { code: 'TEST', message: 'failed', details: '', hint: '' },
});

await expect(incrementTreasureDiscovery(42)).rejects.toThrow(
'Treasure discovery increment failed'
);
});
});
