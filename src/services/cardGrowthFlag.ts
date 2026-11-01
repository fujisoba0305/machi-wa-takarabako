import {CARD_GROWTH_PRODUCTION_RELEASE_READY} from '../features/cardGrowthRelease';
/** Client build flag is OFF unless explicitly enabled. Server flag is independent. */
export function cardGrowthEnabled(){
 const local=import.meta.env.DEV&&import.meta.env.VITE_CARD_GROWTH_UI_ENABLED==='on'&&import.meta.env.VITE_SUPABASE_URL==='http://127.0.0.1:54321';
 const release=CARD_GROWTH_PRODUCTION_RELEASE_READY&&import.meta.env.PROD&&import.meta.env.VITE_CARD_GROWTH_ENABLED==='on';
 return Boolean(local||release);
}
