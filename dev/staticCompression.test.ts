import {beforeAll,expect,it,vi} from 'vitest';
import type {ViteDevServer} from 'vite';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {staticCompression} from './staticCompression';
import {readFileSync} from 'node:fs';
let handle:(req:{method:string;url:string;headers:Record<string,string>},res:{setHeader:(k:string,v:unknown)=>void;end:(b?:Buffer)=>void},next:()=>void)=>void;
const manifest=JSON.parse(readFileSync('src/data/staticFacilityManifest.json','utf8'));
beforeAll(()=>{const plugin=staticCompression();const configure=plugin.configureServer;if(typeof configure!=='function')throw Error('Missing hook');configure({config:{root:process.cwd(),publicDir:process.cwd()+'/public'},middlewares:{use(fn:typeof handle){handle=fn;}}} as unknown as ViteDevServer);});
function request(url:string,method='GET',encoding='gzip'){const headers:Record<string,unknown>={};const res={setHeader:(k:string,v:unknown)=>{headers[k]=v;},end:vi.fn()};const next=vi.fn();handle({url,method,headers:{'accept-encoding':encoding}},res,next);return{headers,res,next};}
it('compresses the dataset while preserving decoded integrity',()=>{const r=request(manifest.dataset.url);const compressed=r.res.end.mock.calls[0][0]!;expect(r.headers['Content-Encoding']).toBe('gzip');expect(compressed.length).toBeLessThan(manifest.dataset.bytes/3);expect(createHash('sha256').update(gunzipSync(compressed)).digest('hex')).toBe(manifest.dataset.sha256);});
it('handles HEAD without transferring a body',()=>{const r=request(manifest.dataset.url,'HEAD');expect(r.headers['Content-Length']).toBeGreaterThan(0);expect(r.res.end).toHaveBeenCalledWith(undefined);});
it.each(['/api/overpass','/.local-https/mobile-key.pem','/facilities-local-v1/../../.env'])('does not intercept private or API path %s',path=>{const r=request(path);expect(r.next).toHaveBeenCalledOnce();expect(r.res.end).not.toHaveBeenCalled();});
it('honors clients that disallow gzip',()=>{expect(request(manifest.dataset.url,'GET','gzip;q=0, br').next).toHaveBeenCalledOnce();});
it('is a development-only plugin',()=>{expect(staticCompression().apply).toBe('serve');});
