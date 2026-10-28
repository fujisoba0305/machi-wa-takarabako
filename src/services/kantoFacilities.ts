import kanto from '../data/kantoFacilityManifest.json';
import { calculateDistance } from '../features/distance';
export type KantoRow={type:string;id:number;lat:number;lon:number;canonical:string;tags:Record<string,string>};
type Point={latitude:number;longitude:number};type Asset={url:string;sha256:string;count?:number;bytes?:number};
type Region={features:{geometry:{coordinates:number[][][][]}}[]};
let regionTask:Promise<Region>|null=null,generation=0,clock=0;
const cache=new Map<string,{task:Promise<Map<string,KantoRow[]>>;bytes:number;used:number;ready:boolean}>();
const MAX_CACHE_BYTES=24*1024*1024,MAX_CACHE_TILES=48,CONCURRENCY=3;
export const kantoStaticEnabled=()=>import.meta.env.VITE_KANTO_STATIC_SEARCH!=='off';
export function kantoLookupBounds(point:Point){return kanto.boxes.some(([w,s,e,n])=>point.longitude>=w&&point.longitude<=e&&point.latitude>=s&&point.latitude<=n);}
async function read(asset:Asset){const response=await fetch(asset.url,{integrity:'sha256-'+btoa(asset.sha256.match(/../g)!.map(h=>String.fromCharCode(parseInt(h,16))).join(''))});if(!response.ok)throw Error('KANTO_DATA_LOAD_FAILED');return response.json();}
export function resetKantoFacilityCache(){generation++;cache.clear();regionTask=null;}
export function kantoFacilityCacheStats(){return{tiles:cache.size,decodedBytes:[...cache.values()].reduce((s,e)=>s+e.bytes,0),maxBytes:MAX_CACHE_BYTES};}
function prune(pinned:Set<string>){let bytes=[...cache.values()].reduce((s,e)=>s+e.bytes,0);for(const[key,e]of [...cache].sort((a,b)=>a[1].used-b[1].used)){if(cache.size<=MAX_CACHE_TILES&&bytes<=MAX_CACHE_BYTES)break;if(e.ready&&!pinned.has(key)){cache.delete(key);bytes-=e.bytes;}}}
function tile(key:string,asset:Asset,pinned:Set<string>){let e=cache.get(key);if(e){e.used=++clock;return e.task;}const epoch=generation;const entry={task:Promise.resolve(new Map<string,KantoRow[]>()),bytes:asset.bytes??0,used:++clock,ready:false};entry.task=read(asset).then(data=>{if(data.version!==kanto.version||!Array.isArray(data.records)||data.records.length!==asset.count)throw Error('KANTO_DATA_INVALID');const index=new Map<string,KantoRow[]>(),ids=new Set<string>();for(const r of data.records as KantoRow[]){if(!['node','way','relation'].includes(r.type)||!Number.isSafeInteger(r.id)||r.id<=0||!Number.isFinite(r.lat)||Math.abs(r.lat)>90||!Number.isFinite(r.lon)||Math.abs(r.lon)>180||!r.tags?.name?.trim()||typeof r.canonical!=='string'||[Math.floor(r.lat*(1/kanto.gridDegrees)),Math.floor(r.lon*(1*(1/kanto.gridDegrees)))].join(':')!==key||ids.has(r.type+':'+r.id))throw Error('KANTO_DATA_INVALID');ids.add(r.type+':'+r.id);const cell=[Math.floor(r.lat*100),Math.floor(r.lon*100)].join(':');const bucket=index.get(cell)||[];bucket.push(r);index.set(cell,bucket);}entry.ready=true;if(epoch===generation)prune(pinned);return index;}).catch(error=>{if(cache.get(key)===entry)cache.delete(key);throw error;});cache.set(key,entry);return entry.task;}
export async function queryKantoFacilities(point:Point,radius:number,inside:(p:Point,r:Region)=>boolean,accept:(r:KantoRow)=>boolean):Promise<KantoRow[]|null>{
 if(!Number.isFinite(radius)||radius<0)throw Error('KANTO_RADIUS_INVALID');
 if(!regionTask)regionTask=read(kanto.region).then(data=>{if(!Array.isArray(data.features)||data.features.length!==7)throw Error('KANTO_COVERAGE_INVALID');return data as Region;}).catch(error=>{regionTask=null;throw error;});
 if(!inside(point,await regionTask))return null;
 const dy=radius/110000,dx=radius/(110000*Math.cos(point.latitude*Math.PI/180)),keys:string[]=[];
 for(let y=Math.floor((point.latitude-dy)*(1/kanto.gridDegrees));y<=Math.floor((point.latitude+dy)*(1/kanto.gridDegrees));y++)for(let x=Math.floor((point.longitude-dx)*(1/kanto.gridDegrees));x<=Math.floor((point.longitude+dx)*(1/kanto.gridDegrees));x++){const key=y+':'+x;if(Object.prototype.hasOwnProperty.call(kanto.tiles,key))keys.push(key);}
 const assets=kanto.tiles as Record<string,Asset>,pinned=new Set(keys),indexes=new Map<string,Map<string,KantoRow[]>>();let cursor=0,failed=false;
 // Bound active transfers. A required tile failure rejects the complete search, never partial results.
 await Promise.all(Array.from({length:Math.min(CONCURRENCY,keys.length)},async()=>{while(!failed&&cursor<keys.length){const key=keys[cursor++];try{indexes.set(key,await tile(key,assets[key],pinned));}catch(error){failed=true;throw error;}}}));
 const result:KantoRow[]=[],seen=new Set<string>();
 for(let y=Math.floor((point.latitude-dy)*100);y<=Math.floor((point.latitude+dy)*100);y++)for(let x=Math.floor((point.longitude-dx)*100);x<=Math.floor((point.longitude+dx)*100);x++){const key=Math.floor(y/(100*kanto.gridDegrees))+':'+Math.floor(x/(100*kanto.gridDegrees)),bucket=indexes.get(key)?.get(y+':'+x)||[];for(const r of bucket){if(seen.has(r.canonical)||!accept(r)||calculateDistance(point.latitude,point.longitude,r.lat,r.lon)*1000>radius)continue;seen.add(r.canonical);result.push(r);}}
 prune(new Set());return result;
}
