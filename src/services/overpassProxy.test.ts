import { afterEach, expect, it, vi } from 'vitest';
import handler from '../../api/overpass';
import type { VercelRequest,VercelResponse } from '@vercel/node';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function run(){const res={status:vi.fn(),json:vi.fn()};res.status.mockReturnValue(res);await handler({method:'POST',body:{query:'test'}} as VercelRequest,res as unknown as VercelResponse);return res;}
it('falls back on incomplete results and never calls the Swiss-only endpoint',async()=>{
  const fetchMock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({elements:[],remark:'timeout'})}).mockResolvedValue({ok:true,json:async()=>({elements:[]})});vi.stubGlobal('fetch',fetchMock);
  const res=await run();expect(res.status).toHaveBeenCalledWith(200);expect(fetchMock).toHaveBeenCalledTimes(2);expect(fetchMock.mock.calls.map(c=>c[0])).toEqual(['https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass.private.coffee/api/interpreter']);
});
it('reports upstream failure rather than a successful empty result',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:false,status:503,text:async()=>''});vi.stubGlobal('fetch',fetchMock);const res=await run();expect(res.status).toHaveBeenCalledWith(500);expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('accepts a genuine zero result without querying another provider',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({elements:[]})});vi.stubGlobal('fetch',fetchMock);const res=await run();expect(res.status).toHaveBeenCalledWith(200);expect(fetchMock).toHaveBeenCalledOnce();
});

it('waits before a bounded fallback after a server error',async()=>{
  vi.useFakeTimers();vi.resetModules();const {default:isolated,FALLBACK_WAIT_MS}=await import('../../api/overpass');
  const upstream=vi.fn().mockResolvedValueOnce({ok:false,status:504}).mockResolvedValue({ok:true,json:async()=>({elements:[{id:2}]})});vi.stubGlobal('fetch',upstream);
  const res={status:vi.fn(),json:vi.fn(),setHeader:vi.fn()};res.status.mockReturnValue(res);
  const pending=isolated({method:'POST',body:{query:'test'}} as VercelRequest,res as unknown as VercelResponse);
  await vi.advanceTimersByTimeAsync(FALLBACK_WAIT_MS-1);expect(upstream).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);await pending;expect(upstream).toHaveBeenCalledTimes(2);expect(res.status).toHaveBeenCalledWith(200);vi.useRealTimers();
});
it.each([429,403,406])('does not bypass HTTP %s restrictions and respects cooldown',async status=>{
  vi.useFakeTimers();vi.resetModules();const {default:isolated}=await import('../../api/overpass');
  const upstream=vi.fn().mockResolvedValue({ok:false,status,headers:{get:()=> '60'}});vi.stubGlobal('fetch',upstream);
  const request={method:'POST',body:{query:'test'}} as VercelRequest;
  const res={status:vi.fn(),json:vi.fn(),setHeader:vi.fn()};res.status.mockReturnValue(res);
  await isolated(request,res as unknown as VercelResponse);expect(upstream).toHaveBeenCalledTimes(1);expect(res.status).toHaveBeenCalledWith(429);
  await vi.advanceTimersByTimeAsync(30000);await isolated(request,res as unknown as VercelResponse);expect(upstream).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(30000);upstream.mockResolvedValue({ok:true,json:async()=>({elements:[]})});await isolated(request,res as unknown as VercelResponse);expect(upstream).toHaveBeenCalledTimes(2);vi.useRealTimers();
});
it('does not log the query, coordinates, names, or upstream response body',async()=>{
  vi.resetModules();const {default:isolated}=await import('../../api/overpass');const info=vi.spyOn(console,'info').mockImplementation(()=>{});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({elements:[{lat:35.123456,tags:{name:'private name'}}]})}));
  const res={status:vi.fn(),json:vi.fn()};res.status.mockReturnValue(res);
  await isolated({method:'POST',body:{query:'node[name="private name"](around:3000,35.123456,139);out;'}} as VercelRequest,res as unknown as VercelResponse);
  const logged=JSON.stringify(info.mock.calls);expect(logged).not.toContain('35.123456');expect(logged).not.toContain('private name');expect(logged).toContain('vk-maps');
});

it('bounds server concurrency and never sends a third parallel upstream request',async()=>{
  vi.resetModules();const {default:isolated}=await import('../../api/overpass');
  let finish!: (r:unknown)=>void;const upstream=vi.fn().mockReturnValue(new Promise(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',upstream);
  const makeResponse=()=>{const res={status:vi.fn(),json:vi.fn(),setHeader:vi.fn()};res.status.mockReturnValue(res);return res;};
  const request={method:'POST',body:{query:'test'}} as VercelRequest;
  const first=isolated(request,makeResponse() as unknown as VercelResponse);const second=isolated(request,makeResponse() as unknown as VercelResponse);const blocked=makeResponse();
  await isolated(request,blocked as unknown as VercelResponse);expect(blocked.status).toHaveBeenCalledWith(503);expect(upstream).toHaveBeenCalledTimes(2);
  finish({ok:true,json:async()=>({elements:[]})});await Promise.all([first,second]);
});
