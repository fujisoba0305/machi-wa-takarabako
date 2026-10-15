import {selectRoadTiles,assembleRoadTiles} from './partition-road.mjs';
let indexCache=null,facilityCache=null;const tileCache=new Map();
export async function readVerifiedJson(descriptor,stage,asset){
  if(!descriptor||!/^\/data\/[a-z0-9-]+-[a-f0-9]{12}\.json$/.test(descriptor.url))throw Error('道路分割ファイル名が不正です。');
  const b=await asset(descriptor.url,stage),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==descriptor.sha256)throw Error('道路分割データの整合性を確認できませんでした。');return JSON.parse(new TextDecoder().decode(b));
}
export async function planPartition(region,point,km,asset){
  const descriptor=region.partitionRoads;if(descriptor?.format!=='complete-edge-tiles-v1')throw Error('この地域の分割データは未準備です。一括方式をご利用ください。');
  if(indexCache?.sha256!==descriptor.sha256){const data=await readVerifiedJson(descriptor,'roadIndex',asset);if(data.graphSha256!==region.sha256||data.facilitiesSha256!==region.facilitiesSha256)throw Error('道路分割の元データ版が一致しません。');indexCache={sha256:descriptor.sha256,data};tileCache.clear();}
  const index=indexCache.data,plan=selectRoadTiles(index,point,km);if(plan.status!=='ok')return {index,plan};
  const selectedBrotli=plan.selected.reduce((s,t)=>s+t.brotliBytes,0),fullBrotli=region.roadTransport?.brotliBytes||region.brotliBytes;
  // Many requests + JSON merging are not worthwhile for a small size reduction.
  // PC comparison showed the 5km selection slower despite a 10% total saving.
  return {index,plan,fallback:selectedBrotli>=fullBrotli*.75,selectedBrotli};
}
export async function loadPartition(index,plan,region,asset,progress){
  if(facilityCache?.sha256!==region.facilitiesSha256){const data=await readVerifiedJson({url:region.facilitiesUrl,sha256:region.facilitiesSha256},'facilities',asset);facilityCache={sha256:region.facilitiesSha256,data:data.facilities};}
  const loaded=[];
  // Sequential requests bound public/local server load and temporary memory.
  for(const tile of plan.selected){let data=tileCache.get(tile.sha256);if(!data){data=await readVerifiedJson(tile,'roadTile',asset);tileCache.set(tile.sha256,data);}loaded.push(data);}
  const needed=new Set(plan.selected.map(t=>t.sha256));for(const key of tileCache.keys())if(!needed.has(key))tileCache.delete(key);
  progress('roadMerge');return assembleRoadTiles(index,plan,loaded,facilityCache.data);
}
