import {it,expect,vi,afterEach} from 'vitest';
import {cardGrowthEnabled} from './cardGrowthFlag';
afterEach(()=>vi.unstubAllEnvs());
it.each([true,false])('defaults OFF in production=%s without settings',prod=>{vi.stubEnv('PROD',prod);vi.stubEnv('DEV',!prod);vi.stubEnv('VITE_CARD_GROWTH_ENABLED','');vi.stubEnv('VITE_CARD_GROWTH_UI_ENABLED','');expect(cardGrowthEnabled()).toBe(false);});
it.each(['true','1','ON','off',''])('does not accept ambiguous production flag %j',value=>{vi.stubEnv('PROD',true);vi.stubEnv('DEV',false);vi.stubEnv('VITE_CARD_GROWTH_ENABLED',value);vi.stubEnv('VITE_CARD_GROWTH_UI_ENABLED','on');vi.stubEnv('VITE_SUPABASE_URL','http://127.0.0.1:54321');expect(cardGrowthEnabled()).toBe(false);});
it('keeps this OFF-only release locked even if the new build flag is on',()=>{vi.stubEnv('PROD',true);vi.stubEnv('DEV',false);vi.stubEnv('VITE_CARD_GROWTH_ENABLED','on');expect(cardGrowthEnabled()).toBe(false);});
it('retains the existing isolated local opt-in',()=>{vi.stubEnv('PROD',false);vi.stubEnv('DEV',true);vi.stubEnv('VITE_CARD_GROWTH_UI_ENABLED','on');vi.stubEnv('VITE_SUPABASE_URL','http://127.0.0.1:54321');expect(cardGrowthEnabled()).toBe(true);vi.stubEnv('VITE_SUPABASE_URL','https://fixture.invalid');expect(cardGrowthEnabled()).toBe(false);});
