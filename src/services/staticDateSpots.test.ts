import { beforeEach,afterEach,expect,it,vi } from 'vitest';
import {readFileSync} from 'node:fs';
import {loadStaticDateSpots,resetStaticFacilityCache,type DateSpotKind} from './staticFacilities';
const cases:DateSpotKind[]=['cafe','relax','food','view','event','park'];
beforeEach(()=>{vi.stubEnv('VITE_LOCAL_STATIC_SEARCH','on');resetStaticFacilityCache();vi.stubGlobal('fetch',vi.fn(async(url:string)=>{if(!url.startsWith('/facilities-local-v1/'))throw Error('External API forbidden');return{ok:true,json:async()=>JSON.parse(readFileSync('public'+url,'utf8'))};}));});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();resetStaticFacilityCache();});
it.each(cases)('uses the same kind=%s tags and OSM types as legacy queries',async kind=>{
const rows=(await loadStaticDateSpots({latitude:35.681236,longitude:139.767125},kind,3000))!;expect(rows.length).toBeGreaterThan(0);expect(new Set(rows.map(r=>r.type+':'+r.id)).size).toBe(rows.length);
for(const r of rows){const t=r.tags!;if(kind==='food')expect(r.type==='node'&&(t.amenity==='ice_cream'||['bakery','pastry','confectionery','chocolate'].includes(t.shop!))).toBe(true);if(kind==='cafe')expect(r.type==='node'&&t.amenity==='cafe').toBe(true);if(kind==='park')expect(['node','way'].includes(r.type)&&t.leisure==='park').toBe(true);if(kind==='view')expect(r.type==='node'&&['viewpoint','attraction'].includes(t.tourism!)).toBe(true);if(kind==='event')expect(r.type==='node'&&['museum','gallery','viewpoint'].includes(t.tourism!)).toBe(true);}
});
it.each(cases)('checks Yokohama candidate availability for %s',async kind=>{const rows=await loadStaticDateSpots({latitude:35.466188,longitude:139.622715},kind,3000);expect(rows).not.toBeNull();expect(rows!.length).toBeGreaterThan(1);});
it('does not query static or paid APIs outside the two prefectures',async()=>{expect(await loadStaticDateSpots({latitude:34.6937,longitude:135.5023},'food',3000)).toBeNull();expect(fetch).not.toHaveBeenCalled();});
it('shares the existing cache between date modes',async()=>{await loadStaticDateSpots({latitude:35.681236,longitude:139.767125},'cafe',3000);await loadStaticDateSpots({latitude:35.681236,longitude:139.767125},'food',3000);expect(fetch).toHaveBeenCalledTimes(2);});
