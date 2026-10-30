import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import manifest from '../data/kantoFacilityManifest.json';
import legacy from '../data/staticFacilityManifest.json';
import definitions from '../data/staticFacilityConditions.json';
import {calculateDistance} from '../features/distance';
import {isInsideStaticRegion,loadLocalStaticFacilities,loadStaticDateSpots,matchesStaticCondition,resetStaticFacilityCache} from './staticFacilities';
import {queryKantoFacilities,kantoFacilityCacheStats,kantoTransportDiagnostic} from './kantoFacilities';
const json=(url:string)=>JSON.parse(readFileSync('public'+url,'utf8'));
const coverage=json(manifest.region.url);
const all=Object.values(manifest.tiles).flatMap(a=>json(a.url).records);
const places=[['東京',35.681236,139.767125],['神奈川',35.575,139.658],['埼玉',35.9063,139.6238],['千葉',35.6132,140.1137],['茨城',36.3709,140.4768],['栃木',36.5594,139.8987],['群馬',36.3832125,139.0726408],['都県境・和光',35.7886,139.6128],['区画境界',35.8,139.7],['山間・草津',36.6206,138.5969]] as const;
function fixture(url:unknown){const u=String(url);if(!/^\/facilities-(local-v1|kanto-v[23])\//.test(u))throw Error('External network forbidden');return {ok:true,json:async()=>json(u)} as Response;}
beforeEach(()=>{vi.stubEnv('VITE_LOCAL_STATIC_SEARCH','on');vi.stubEnv('VITE_KANTO_STATIC_SEARCH',undefined);resetStaticFacilityCache();vi.stubGlobal('fetch',vi.fn(async url=>fixture(url)));});
afterEach(()=>{resetStaticFacilityCache();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('verifies every asset hash, count, old record preservation and seven boundaries',()=>{
 expect(all).toHaveLength(manifest.count);expect(new Set(all.map(r=>r.type+':'+r.id)).size).toBe(all.length);
 for(const a of [manifest.region,...Object.values(manifest.tiles)])expect(createHash('sha256').update(readFileSync('public'+a.url)).digest('hex')).toBe(a.sha256);
 expect(new Set(coverage.features.map((f:any)=>f.properties.name)).size).toBe(7);
 const ids=new Map(all.map(r=>[r.type+':'+r.id,r]));for(const r of json(legacy.dataset.url).records)expect(ids.get(r.type+':'+r.id)).toEqual(r);
});
it.each(places)('%s: every distance and existing genre agrees with an independent complete-data oracle',async(_name,latitude,longitude)=>{
 const p={latitude,longitude};expect(isInsideStaticRegion(p,coverage)).toBe(true);
 const nearby=all.map(r=>({r,d:calculateDistance(latitude,longitude,r.lat,r.lon)*1000})).filter(x=>x.d<=9000);
 for(const radius of [1500,3000,4500,9000])for(const definition of definitions){
 const clauses=definition.clauses,actual=await queryKantoFacilities(p,radius,isInsideStaticRegion,r=>matchesStaticCondition(r,clauses));
 const expected=nearby.filter(x=>x.d<=radius&&matchesStaticCondition(x.r,clauses)).map(x=>x.r);
 expect(new Set(actual!.map(r=>r.canonical))).toEqual(new Set(expected.map(r=>r.canonical)));
 expect(actual!.every(r=>calculateDistance(latitude,longitude,r.lat,r.lon)*1000<=radius)).toBe(true);
 }
},30000);
it('keeps the original Tokyo/Kanagawa two-file fallback and uses reviewed tiles by default',async()=>{
 const p={latitude:35.575,longitude:139.658},c={mood:'カフェ',distance:'？km'};
 const current=await loadLocalStaticFacilities(p,c,9000);expect(vi.mocked(fetch).mock.calls.some(([u])=>String(u).startsWith('/facilities-kanto-v3/'))).toBe(true);
 resetStaticFacilityCache();vi.stubEnv('VITE_KANTO_STATIC_SEARCH','off');vi.mocked(fetch).mockClear();const before=await loadLocalStaticFacilities(p,c,9000);expect(fetch).toHaveBeenCalledTimes(2);expect(before!.every(old=>current!.some(r=>r.type===old.type&&r.id===old.id))).toBe(true);
});
it('uses static data for unknown distance and all six date categories in Saitama',async()=>{
 const p={latitude:35.9063,longitude:139.6238};expect((await loadLocalStaticFacilities(p,{mood:'カフェ',distance:'？km'},3000))!.length).toBeGreaterThan(0);
 for(const kind of ['cafe','relax','food','view','event','park'] as const)expect(await loadStaticDateSpots(p,kind,3000)).not.toBeNull();
});
it('rejects a failed required tile without partial success and safely retries',async()=>{
 const p={latitude:35.9063,longitude:139.6238};let fail=true;
 vi.mocked(fetch).mockImplementation(async url=>{if(fail&&String(url).includes('/tile-'))throw Error('offline');return fixture(url);});
 await expect(queryKantoFacilities(p,1500,isInsideStaticRegion,()=>true)).rejects.toThrow('offline');fail=false;
 expect((await queryKantoFacilities(p,1500,isInsideStaticRegion,()=>true))!.length).toBeGreaterThan(0);
});
it('rejects corrupt records, then allows a clean retry',async()=>{
 const p={latitude:36.3709,longitude:140.4768};vi.mocked(fetch).mockImplementation(async url=>String(url).includes('/tile-')?{ok:true,json:async()=>({version:'wrong',records:[]})} as Response:fixture(url));
 await expect(queryKantoFacilities(p,1500,isInsideStaticRegion,()=>true)).rejects.toThrow('KANTO_DATA_INVALID');
 vi.mocked(fetch).mockImplementation(async url=>fixture(url));expect((await queryKantoFacilities(p,1500,isInsideStaticRegion,()=>true))!.length).toBeGreaterThan(0);
});
it('shares in-flight reads and reuses successful tiles without new requests',async()=>{
 const p={latitude:36.3709,longitude:140.4768},run=()=>queryKantoFacilities(p,1500,isInsideStaticRegion,()=>true);
 const[a,b]=await Promise.all([run(),run()]);expect(a).toEqual(b);const calls=vi.mocked(fetch).mock.calls.map(([u])=>u);expect(new Set(calls).size).toBe(calls.length);await run();expect(fetch).toHaveBeenCalledTimes(calls.length);
});
it('bounds the retained tile cache after travel between prefectures',async()=>{
 for(const[,latitude,longitude]of places)await queryKantoFacilities({latitude,longitude},9000,isInsideStaticRegion,()=>true);
 const stats=kantoFacilityCacheStats();expect(stats.tiles).toBeLessThanOrEqual(48);expect(stats.decodedBytes).toBeLessThanOrEqual(stats.maxBytes);
});
it('distinguishes outside coverage from valid empty candidates',async()=>{
 expect(await queryKantoFacilities({latitude:34.6937,longitude:135.5023},3000,isInsideStaticRegion,()=>true)).toBeNull();
 expect(await queryKantoFacilities({latitude:36.3709,longitude:140.4768},1500,isInsideStaticRegion,()=>false)).toEqual([]);
});

it('includes facilities on both sides of the Tokyo/Saitama border',async()=>{
 const p={latitude:35.7886,longitude:139.6128},oldRegion=json(legacy.region.url);
 const rows=(await loadLocalStaticFacilities(p,{mood:'カフェ',distance:'？km'},9000))!;
 expect(rows.some(r=>isInsideStaticRegion({latitude:r.lat!,longitude:r.lon!},oldRegion))).toBe(true);
 expect(rows.some(r=>!isInsideStaticRegion({latitude:r.lat!,longitude:r.lon!},oldRegion))).toBe(true);
});

it('retains the failing HTTP status when another parallel tile succeeds',async()=>{let failed=false;vi.mocked(fetch).mockImplementation(async url=>{if(!failed&&String(url).includes('/tile-')){failed=true;return {ok:false,status:503} as Response;}return fixture(url);});await expect(queryKantoFacilities({latitude:35.7886,longitude:139.6128},9000,isInsideStaticRegion,()=>true)).rejects.toThrow('KANTO_DATA_LOAD_FAILED');expect(kantoTransportDiagnostic()).toMatchObject({asset:'tile',failure:'http',httpStatus:503});});
