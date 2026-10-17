import {managementEnabled,createManagedTreasure} from './treasureManagement';
import { getSupabaseClient } from './supabase';
import { saveDiagnostic, TreasureSaveError } from '../features/treasureSaveDiagnostics';

export type TreasureInsert = {
name: string;
comment: string;
category: string;
latitude: number;
longitude: number;
image_url: string | null;
additional_image_url?: string | null;
};

export type Treasure = TreasureInsert & {
id?: number;
created_at?: string;
discovery_count?: number;
};

const treasureDisplayFields =
'id, name, comment, category, latitude, longitude, image_url, discovery_count';
const legacyTreasureDisplayFields =
'id, name, comment, category, latitude, longitude, image_url';

export async function getTreasures(): Promise<Treasure[]> {
const supabase = getSupabaseClient();
const initial = await supabase
.from('treasures')
.select('id, name, comment, category, latitude, longitude, image_url, discovery_count, additional_image_url, created_at');
let data:unknown[]|null=initial.data;let error=initial.error;

if (error?.code === '42703' || error?.code === 'PGRST204') {
 const original=await supabase.from('treasures').select(treasureDisplayFields);data=original.data;error=original.error;
}

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
if(managementEnabled()){await createManagedTreasure(treasure);return;}
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
const { error, status } = await supabase.from('treasures').insert(treasure);
requestComplete = true;
console.info('[treasure-save] request_complete');

if (error) {
throw new TreasureSaveError(saveDiagnostic({ code: error.code, status }, 'db_insert'));
}
} catch (error) {
const diagnostic = saveDiagnostic(error, 'db_insert');
console.error('[treasure-save] failed', { ...diagnostic, responseReceived: requestComplete });
throw error instanceof TreasureSaveError ? error : new TreasureSaveError(diagnostic);
}
}

/** Read-only schema preflight before any second-image upload. No migration or writes. */
export async function requireAdditionalImageSupport(){
 const {error}=await getSupabaseClient().from('treasures').select('additional_image_url').limit(0);
 if(error)throw new TreasureSaveError(saveDiagnostic(error.code==='42703'||error.code==='PGRST204'?{code:'PHOTO_SCHEMA'}:error,'image_prepare'));
}
