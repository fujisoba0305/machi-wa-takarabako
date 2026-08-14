import { getSupabaseClient } from './supabase';

export type TreasureInsert = {
name: string;
comment: string;
category: string;
latitude: number;
longitude: number;
image_url: string | null;
};

export type Treasure = TreasureInsert & {
id?: number;
discovery_count?: number;
};

const treasureDisplayFields =
'id, name, comment, category, latitude, longitude, image_url, discovery_count';
const legacyTreasureDisplayFields =
'id, name, comment, category, latitude, longitude, image_url';

export async function getTreasures(): Promise<Treasure[]> {
const supabase = getSupabaseClient();
let { data, error } = await supabase
.from('treasures')
.select(treasureDisplayFields);

if (error?.code === '42703' || error?.code === 'PGRST204') {
const legacyResult = await supabase
.from('treasures')
.select(legacyTreasureDisplayFields);
data = legacyResult.data?.map((treasure) => ({
...treasure,
discovery_count: 0,
})) ?? null;
error = legacyResult.error;
}

if (error) {
console.error('[treasure-map] Supabase SELECT failed', {
code: error.code,
message: error.message,
details: error.details,
hint: error.hint,
});
throw new Error('Treasure list fetch failed');
}

return (data ?? []) as Treasure[];
}

export async function incrementTreasureDiscovery(treasureId: number) {
const supabase = getSupabaseClient();
const { data, error } = await supabase.rpc('increment_treasure_discovery', {
p_treasure_id: treasureId,
});

if (error) {
console.error('[treasure-discovery] RPC failed', {
code: error.code,
message: error.message,
details: error.details,
hint: error.hint,
});
throw new Error('Treasure discovery increment failed');
}

if (typeof data !== 'number' || !Number.isFinite(data)) {
throw new Error('Treasure discovery increment returned an invalid count');
}

return data;
}

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
