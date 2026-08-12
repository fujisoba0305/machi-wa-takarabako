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

let requestComplete = false;

try {
const supabase = getSupabaseClient();
console.info('[treasure-save] client_init_success');

console.info('[treasure-save] request_start');
const { error } = await supabase.from('treasures').insert(treasure);
requestComplete = true;
console.info('[treasure-save] request_complete');

if (error) {
console.error('[treasure-save] Supabase INSERT failed', {
code: error.code,
message: error.message,
details: error.details,
hint: error.hint,
});

throw new Error('Treasure insert failed');
}
} catch (error) {
if (!requestComplete) {
console.error('[treasure-save] pre-request exception', {
name: error instanceof Error ? error.name : 'UnknownError',
message: error instanceof Error ? error.message : 'Unknown error',
});
}

throw error;
}
}
