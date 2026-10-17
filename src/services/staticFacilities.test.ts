import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import manifest from '../data/staticFacilityManifest.json';
import { loadLocalStaticFacilities, needsLocalStaticLookup, resetStaticFacilityCache, resolveStaticCondition, StaticFacilityError } from './staticFacilities';
const gps = { latitude: 35.681236, longitude: 139.767125 }, choices = { mood: 'カフェ', distance: '？km' };
export function localFileFetch(url: string) {
  if (!url.startsWith('/facilities-local-v1/')) throw Error('Unexpected network request ' + url);
  return { ok: true, json: async () => JSON.parse(readFileSync(resolve(process.cwd(), 'public', url.slice(1)), 'utf8')) };
}
beforeEach(() => { vi.stubEnv('DEV', true); vi.stubEnv('VITE_LOCAL_STATIC_SEARCH', 'on'); resetStaticFacilityCache(); vi.stubGlobal('fetch', vi.fn(localFileFetch)); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetStaticFacilityCache(); });
describe('local static facility provider', () => {
  it('reads actual local cafe candidates with valid OSM identity and no Overpass/Routes', async () => { const rows = await loadLocalStaticFacilities(gps, choices, 3000); expect(rows!.length).toBeGreaterThan(0); expect(rows!.every(r => r.type === 'node' && r.tags?.amenity === 'cafe')).toBe(true); expect(fetch).toHaveBeenCalledTimes(2); expect(new Set(rows!.map(r => r.type + ':' + r.id)).size).toBe(rows!.length); expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).startsWith('/facilities-local-v1/'))).toBe(true); expect(vi.mocked(fetch).mock.calls[1][1]?.integrity).toMatch(/^sha256-/); });
  it('reuses verified successful data without repeating reads', async () => { await loadLocalStaticFacilities(gps, choices, 3000); await loadLocalStaticFacilities(gps, { mood: '自然', distance: '？km' }, 3000); expect(fetch).toHaveBeenCalledTimes(2); });
  it('keeps outside region, fixed distances and date on original path', async () => { for (const [p, q] of [[{ latitude: 34.6937, longitude: 135.5023 }, choices], [gps, { ...choices, distance: '3km' }], [gps, { ...choices, mood: 'デート' }]] as const) expect(await loadLocalStaticFacilities(p, q, 3000)).toBeNull(); expect(fetch).not.toHaveBeenCalled(); });
  it('uses static candidates in production without an explicit environment flag', async () => { vi.stubEnv('DEV', false); vi.stubEnv('VITE_LOCAL_STATIC_SEARCH', undefined); expect((await loadLocalStaticFacilities(gps, choices, 3000))!.length).toBeGreaterThan(0); expect(fetch).toHaveBeenCalledTimes(2); });
  it('supports the same off switch in production', async () => { vi.stubEnv('DEV', false); vi.stubEnv('VITE_LOCAL_STATIC_SEARCH', 'off'); expect(await loadLocalStaticFacilities(gps, choices, 3000)).toBeNull(); expect(fetch).not.toHaveBeenCalled(); });
  it('supports explicit rollback without clearing player data', async () => { vi.stubEnv('VITE_LOCAL_STATIC_SEARCH', 'off'); expect(needsLocalStaticLookup(gps, choices)).toBe(false); expect(await loadLocalStaticFacilities(gps, choices, 3000)).toBeNull(); expect(fetch).not.toHaveBeenCalled(); });
  it('rejects failed data without caching failure; retry same condition succeeds', async () => { vi.mocked(fetch).mockRejectedValueOnce(Error('unavailable')); await expect(loadLocalStaticFacilities(gps, choices, 3000)).rejects.toBeInstanceOf(StaticFacilityError); expect((await loadLocalStaticFacilities(gps, choices, 3000))!.length).toBeGreaterThan(0); });
  it('rejects corrupt dataset rather than treating as normal zero', async () => { vi.mocked(fetch).mockImplementation(async url => String(url) === manifest.dataset.url ? { ok: true, json: async () => ({ version: 'wrong', records: [] }) } as Response : localFileFetch(String(url)) as Response); await expect(loadLocalStaticFacilities(gps, choices, 3000)).rejects.toBeInstanceOf(StaticFacilityError); });
  it('preserves known normal zero without falling back or expanding', async () => { expect(await loadLocalStaticFacilities({ latitude: 35.3365, longitude: 139.447 }, { mood: '写真', distance: '？km' }, 3000)).toEqual([]); expect(fetch).toHaveBeenCalledTimes(2); });
  it('normalizes Korean label and preserves exact legacy conditions', () => { expect(resolveStaticCondition({ ...choices, mood: 'グルメ', foodGenre: '韓国料理' }).clauses.some(c => c.predicates.some(p => 'value' in p && p.value === 'barbecue'))).toBe(true); expect(resolveStaticCondition({ ...choices, mood: '神社・お寺', shrineGenre: '歴史散策' }).clauses.some(c => c.predicates.some(p => p.key === 'religion'))).toBe(false); });
  it('resolves all six random moods once with existing order', () => { expect(Array.from({ length: 6 }, (_, i) => resolveStaticCondition({ mood: 'おまかせ', distance: '？km' }, () => (i + .5) / 6).mood)).toEqual(['カフェ', '自然', 'グルメ', 'イベント', '写真', 'ストレス解消']); });
});

it('excludes the actual closed ramen shop and lost lifecycle tags without widening cuisine',async()=>{
 const rows=await loadLocalStaticFacilities({latitude:35.70185,longitude:139.39352},{mood:'グルメ',distance:'？km',foodGenre:'ラーメン'},3000);
 expect(rows!.length).toBeGreaterThan(0);expect(rows!.every(r=>r.tags?.cuisine==='ramen')).toBe(true);
 expect(rows!.some(r=>r.id===3881599562)).toBe(false);
 const old=await loadLocalStaticFacilities({latitude:35.7,longitude:139.7},{mood:'グルメ',distance:'？km',foodGenre:'おまかせ'},100000);
 expect(old!.some(r=>r.type==='node'&&r.id===592940767)).toBe(false);
});
