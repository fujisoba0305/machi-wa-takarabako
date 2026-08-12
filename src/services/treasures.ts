import { getSupabaseClient } from './supabase';

export type TreasureInsert = {
name: string;
comment: string;
category: string;
latitude: number;
longitude: number;
};

export async function createTreasure(treasure: TreasureInsert) {
const { error } = await getSupabaseClient()
.from('treasures')
.insert(treasure);

if (error) {
throw new Error('Treasure insert failed');
}
}
