import { beforeEach, describe, expect, it, vi } from 'vitest';

const select = vi.fn();
const from = vi.fn(() => ({ select }));

vi.mock('./supabase', () => ({
getSupabaseClient: () => ({ from }),
}));

import { getTreasures } from './treasures';

describe('getTreasures', () => {
beforeEach(() => {
select.mockReset();
from.mockClear();
});

it('gets the display fields and preserves image URLs and nulls', async () => {
const rows = [
{ name: '写真あり', comment: 'コメント', category: '📷 写真スポット', latitude: 35, longitude: 139, image_url: 'https://example.com/photo.jpg' },
{ name: '写真なし', comment: '', category: '💎 その他', latitude: 36, longitude: 140, image_url: null },
];
select.mockResolvedValue({ data: rows, error: null });

await expect(getTreasures()).resolves.toEqual(rows);
expect(from).toHaveBeenCalledWith('treasures');
expect(select).toHaveBeenCalledWith('name, comment, category, latitude, longitude, image_url');
});

it('throws when Supabase cannot load the list', async () => {
select.mockResolvedValue({
data: null,
error: { code: 'TEST', message: 'failed', details: '', hint: '' },
});

await expect(getTreasures()).rejects.toThrow('Treasure list fetch failed');
});
});
