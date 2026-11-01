import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const productionApiEntrypoints = ['api/my-treasures.ts','api/overpass.ts','api/treasure-card.ts','api/treasure-post.ts','api/walking-distance.ts','api/walking-trial-access.ts'];
// api/ is a routing directory. Test suffixes do NOT make files private on Vercel.
export function inspectApiLayout(root){
 const dir=path.join(root,'api'),found=[];
 if(!fs.existsSync(dir)||fs.lstatSync(dir).isSymbolicLink())throw Error('Expected a real api directory');
 function visit(folder,prefix){for(const e of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,e.name),name=prefix+'/'+e.name;if(fs.lstatSync(p).isSymbolicLink())throw Error('API symlinks are not allowed: '+name);if(e.isDirectory())visit(p,name);else found.push(name);}}
 visit(dir,'api');found.sort();
 const extra=found.filter(p=>!productionApiEntrypoints.includes(p)),missing=productionApiEntrypoints.filter(p=>!found.includes(p));
 if(extra.length||missing.length)throw Error('Unexpected public API layout; extra='+extra.join(',')+'; missing='+missing.join(','));
 return {entrypoints:found,routes:found.map(p=>'/'+p.replace(/\.ts$/,''))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(inspectApiLayout(path.dirname(fileURLToPath(import.meta.url)))));
