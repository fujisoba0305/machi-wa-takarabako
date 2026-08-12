import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient() {
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
throw new Error('Supabase configuration is unavailable');
}

if (!supabaseClient) {
supabaseClient = createClient(supabaseUrl, supabasePublishableKey);
}

return supabaseClient;
}
