import {readFileSync} from 'node:fs';
import {afterEach,expect,it,vi} from 'vitest';
import {loadStaticDateSpots,resetStaticFacilityCache,staticFacilityLoadStage} from './staticFacilities';
import {withDateDeadline,DateSearchTimeout} from '../features/dateSearchDeadline';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();resetStaticFacilityCache();});
it('reproduces a cold static body timeout and a successful cached retry without Overpass',async()=>{
vi.useFakeTimers();vi.stubEnv('VITE_LOCAL_STATIC_SEARCH','on');resetStaticFacilityCache();
const fetchMock=vi.fn(async(url:string)=>{if(!url.startsWith('/facilities-local-v1/'))throw Error('Forbidden API');const data=JSON.parse(readFileSync('public'+url,'utf8'));return{ok:true,json:()=>url.includes('candidates')?new Promise(resolve=>setTimeout(()=>resolve(data),23000)):Promise.resolve(data)};});vi.stubGlobal('fetch',fetchMock);
const point={latitude:35.681236,longitude:139.767125};
const rejected=expect(withDateDeadline(()=>loadStaticDateSpots(point,'food',3000),()=>true)).rejects.toBeInstanceOf(DateSearchTimeout);
await vi.advanceTimersByTimeAsync(20000);await rejected;
expect(staticFacilityLoadStage().dataset).toBe('body-and-parse');
await vi.advanceTimersByTimeAsync(3000);
const rows=await withDateDeadline(()=>loadStaticDateSpots(point,'food',3000),()=>true);expect(rows!.length).toBeGreaterThan(0);expect(fetchMock).toHaveBeenCalledTimes(2);expect(staticFacilityLoadStage().dataset).toBe('ready');
});
