// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { request } from 'node:http';
import { localApi } from '../../dev/localApi';
let server: ViteDevServer | undefined;
afterEach(async()=>{ await server?.close(); server=undefined; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function call(path: string, body = {}) {
 if (!server) { server=await createServer({ configFile:false, plugins:[localApi()], optimizeDeps:{noDiscovery:true}, server:{host:'127.0.0.1',port:0},logLevel:'silent' }); await server.listen(); }
 const address=server.httpServer!.address() as {port:number};
 return new Promise<{status:number,body:any,environment:unknown}>((resolve,reject)=>{
 const req=request({hostname:'127.0.0.1',port:address.port,path,method:'POST',headers:{'Content-Type':'application/json'}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode!,body:JSON.parse(text),environment:res.headers['x-machi-api-environment']}));});req.on('error',reject);req.end(JSON.stringify(body)); });
}
it('serves the corrected local handler over actual HTTP, never the production or Swiss API',async()=>{
 const upstream=vi.fn().mockResolvedValue({ok:true,json:async()=>({elements:[{id:1}]})});vi.stubGlobal('fetch',upstream);
 const result=await call('/api/overpass',{query:'[out:json];node(35,139,36,140);out;'});
 expect(result).toMatchObject({status:200,environment:'local',body:{elements:[{id:1}]}});
 expect(upstream.mock.calls.map(c=>c[0])).toEqual(['https://maps.mail.ru/osm/tools/overpass/api/interpreter']);
});
it('fails on both providers then retries the same query successfully',async()=>{
 const upstream=vi.fn().mockRejectedValue(new Error('network'));vi.stubGlobal('fetch',upstream);
 expect((await call('/api/overpass',{query:'test'})).status).toBe(500);
 upstream.mockResolvedValue({ok:true,json:async()=>({elements:[]})});
 expect((await call('/api/overpass',{query:'test'}))).toMatchObject({status:200,body:{elements:[]}});
 expect(upstream).toHaveBeenCalledTimes(3);
});
it('blocks local paid Routes without any external fetch',async()=>{
 const upstream=vi.fn();vi.stubGlobal('fetch',upstream);
 expect(await call('/api/walking-distance')).toMatchObject({status:503,body:{error:'LOCAL_ROUTES_DISABLED'}});
 expect(upstream).not.toHaveBeenCalled();
});
it('reports local wiring without secrets or coordinates',async()=>{
 expect(await call('/api/diagnostics')).toMatchObject({status:200,body:{environment:'local',overpass:'local-handler',walkingDistance:'disabled-no-paid-calls'}});
});
