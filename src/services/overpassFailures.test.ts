import { afterEach, beforeEach, expect, it, vi } from 'vitest';
beforeEach(()=>{vi.resetModules();vi.stubGlobal('window',{location:{hostname:'localhost'}});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
it.each([
  {ok:false,status:500,json:async()=>({})},
  {ok:true,json:async()=>({elements:[],remark:'runtime error: timeout'})},
  {ok:true,json:async()=>({elements:[{id:1}],remark:'runtime error: partial'})},
  {ok:true,json:async()=>({})},
  {ok:true,json:async()=>{throw new Error('invalid JSON');}},
])('does not cache failed or incomplete responses',async failure=>{
  const fetchMock=vi.fn().mockResolvedValueOnce(failure).mockResolvedValue({ok:true,json:async()=>({elements:[]})});vi.stubGlobal('fetch',fetchMock);
  const {getNearbyCafes}=await import('./overpass');
  await expect(getNearbyCafes(35,139,2000)).rejects.toThrow();
  await expect(getNearbyCafes(35,139,2000)).resolves.toEqual([]);
  await getNearbyCafes(35,139,2000); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('propagates network failures and retries instead of caching them',async()=>{
  const mock=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ok:true,json:async()=>({elements:[]})});vi.stubGlobal('fetch',mock);
  const {getNearbyParks}=await import('./overpass');await expect(getNearbyParks(35,139,2000)).rejects.toThrow('offline');await getNearbyParks(35,139,2000);expect(mock).toHaveBeenCalledTimes(2);
});
it('aborts stalled responses and leaves the query retryable',async()=>{
  vi.useFakeTimers();const mock=vi.fn().mockImplementation((_url,options)=>new Promise((_r,j)=>options.signal.addEventListener('abort',()=>j(new Error('timeout')))));vi.stubGlobal('fetch',mock);
  const {getNearbyCafes}=await import('./overpass');const pending=expect(getNearbyCafes(35,139,2000)).rejects.toThrow('timeout');await vi.advanceTimersByTimeAsync(55000);await pending;
  mock.mockResolvedValue({ok:true,json:async()=>({elements:[]})});await getNearbyCafes(35,139,2000);expect(mock).toHaveBeenCalledTimes(2);
});

it('expires genuine empty results after 30 seconds',async()=>{
 vi.useFakeTimers();const mock=vi.fn().mockResolvedValue({ok:true,json:async()=>({elements:[]})});vi.stubGlobal('fetch',mock);
 const {getNearbyCafes}=await import('./overpass');await getNearbyCafes(35,139,2000);await getNearbyCafes(35,139,2000);expect(mock).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(30000);await getNearbyCafes(35,139,2000);expect(mock).toHaveBeenCalledTimes(2);
});
it('expires populated results after five minutes',async()=>{
 vi.useFakeTimers();const mock=vi.fn().mockResolvedValue({ok:true,json:async()=>({elements:[{id:1}]})});vi.stubGlobal('fetch',mock);
 const {getNearbyCafes}=await import('./overpass');await getNearbyCafes(35,139,2000);await vi.advanceTimersByTimeAsync(30000);await getNearbyCafes(35,139,2000);expect(mock).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(270000);await getNearbyCafes(35,139,2000);expect(mock).toHaveBeenCalledTimes(2);
});
it('keeps coordinates, names, and response errors out of client diagnostics',async()=>{
 const info=vi.spyOn(console,'info').mockImplementation(()=>{});const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 vi.stubGlobal('fetch',vi.fn().mockRejectedValueOnce(new Error('secret-location')).mockResolvedValue({ok:true,json:async()=>({elements:[{id:1,lat:35.123456,tags:{name:'private-place'}}]})}));
 const {getNearbyCafes}=await import('./overpass');await expect(getNearbyCafes(35.123456,139,2000)).rejects.toThrow();await getNearbyCafes(35.123456,139,2000);
 const log=JSON.stringify([info.mock.calls,warn.mock.calls]);expect(log).not.toContain('35.123456');expect(log).not.toContain('private-place');expect(log).not.toContain('secret-location');
});

it('shares concurrent requests for identical conditions', async()=>{
 let resolve!: (r: unknown)=>void; const mock=vi.fn().mockReturnValue(new Promise(r=>resolve=r));vi.stubGlobal('fetch',mock);
 const {getNearbyCafes}=await import('./overpass');const first=getNearbyCafes(35,139,2000);const second=getNearbyCafes(35,139,2000);
 expect(mock).toHaveBeenCalledTimes(1);resolve({ok:true,json:async()=>({elements:[]})});await Promise.all([first,second]);
});
it('limits concurrent requests to two and never shares different locations or categories',async()=>{
 const resolvers: ((r:unknown)=>void)[]=[];const mock=vi.fn().mockImplementation(()=>new Promise(r=>resolvers.push(r)));vi.stubGlobal('fetch',mock);
 const {getNearbyCafes,getNearbyParks}=await import('./overpass');const a=getNearbyCafes(35,139,2000),b=getNearbyParks(35,139,2000),c=getNearbyCafes(36,139,2000);
 expect(mock).toHaveBeenCalledTimes(2);resolvers[0]({ok:true,json:async()=>({elements:[]})});await a;
 expect(mock).toHaveBeenCalledTimes(3);resolvers[1]({ok:true,json:async()=>({elements:[]})});resolvers[2]({ok:true,json:async()=>({elements:[]})});await Promise.all([b,c]);
});
it('uses valid cached candidates while the network is unavailable and isolates radius',async()=>{
 const mock=vi.fn().mockResolvedValue({ok:true,json:async()=>({elements:[{id:42}]})});vi.stubGlobal('fetch',mock);
 const {getNearbyCafes}=await import('./overpass');await getNearbyCafes(35,139,2000);mock.mockRejectedValue(new Error('offline'));
 await expect(getNearbyCafes(35,139,2000)).resolves.toEqual([{id:42}]);expect(mock).toHaveBeenCalledTimes(1);
 await expect(getNearbyCafes(35,139,3000)).rejects.toThrow('offline');
});

it('honors rate-limit cooldown across different conditions without bypassing it, then retries',async()=>{
 vi.useFakeTimers();const upstream=vi.fn().mockResolvedValueOnce({ok:false,status:429,headers:{get:()=> '60'}}).mockResolvedValue({ok:true,json:async()=>({elements:[]})});vi.stubGlobal('fetch',upstream);
 const {getNearbyCafes,getNearbyParks}=await import('./overpass');await expect(getNearbyCafes(35,139,2000)).rejects.toThrow();
 await vi.advanceTimersByTimeAsync(30000);await expect(getNearbyParks(35,139,2000)).rejects.toThrow('cooldown');expect(upstream).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(30000);await expect(getNearbyParks(35,139,2000)).resolves.toEqual([]);expect(upstream).toHaveBeenCalledTimes(2);
});
