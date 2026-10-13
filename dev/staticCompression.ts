import type {Plugin} from 'vite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export function staticCompression():Plugin {
return {name:'machi-local-static-compression',apply:'serve',configureServer(server){
  const manifest=JSON.parse(readFileSync(resolve(server.config.root,'src/data/staticFacilityManifest.json'),'utf8'));
  const compressed=new Map<string,Buffer>();
  for(const asset of [manifest.dataset,manifest.region]){
    if(!/^\/facilities-local-v1\/(candidates|coverage)-[a-f0-9]{12}\.json$/.test(asset.url))throw Error('Invalid static asset path');
    const raw=readFileSync(resolve(server.config.publicDir,asset.url.slice(1)));
    if(createHash('sha256').update(raw).digest('hex')!==asset.sha256)throw Error('Static asset integrity mismatch');
    compressed.set(asset.url,gzipSync(raw));
  }
  server.middlewares.use((req,res,next)=>{
    const data=compressed.get(req.url?.split('?')[0]||'');
    const accepts=(req.headers['accept-encoding']||'').split(',').some(item=>{const [name,...options]=item.trim().split(';');return name==='gzip'&&!options.some(p=>/^\s*q=0(?:\.0*)?\s*$/.test(p));});
    if(!data||!['GET','HEAD'].includes(req.method||'')||!accepts)return next();
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');res.setHeader('Cache-Control','no-cache');res.setHeader('Content-Length',data.length);res.setHeader('X-Machi-Static-Transport','local-gzip');
    res.end(req.method==='HEAD'?undefined:data);
  });
}};
}
