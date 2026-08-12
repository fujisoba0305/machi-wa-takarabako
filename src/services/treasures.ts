import { getSupabaseClient } from './supabase';

export type TreasureInsert = {
name: string;
comment: string;
category: string;
latitude: number;
longitude: number;
};

export async function createTreasure(treasure: TreasureInsert) {
console.info('[treasure-save] INSERT start', {
namePresent: treasure.name.length > 0,
categoryPresent: treasure.category.length > 0,
latitudeType: typeof treasure.latitude,
longitudeType: typeof treasure.longitude,
});

const { error } = await getSupabaseClient()
.from('treasures')
.insert(treasure);

if (error) {
console.error('[treasure-save] Supabase INSERT failed', {
code: error.code,
message: error.message,
details: error.details,
hint: error.hint,
});

throw new Error('Treasure insert failed');
}
}
