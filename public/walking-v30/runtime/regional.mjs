import {meters,distanceRange,validPoint,Heap} from './core.mjs';
// Packaging/road-network validation only. Never certifies facility access.
export const TILE_DEGREES=.02;
export function tileKey(lat,lon){return `${Math.floor(lon/TILE_DEGREES)}_${Math.floor(lat/TILE_DEGREES)}`;}
export function requiredKeys(point,km){
 if(!validPoint(point))throw Error('Invalid origin');
 const radius=distanceRange(km)[1]+100; // 50m origin snap plus conservative numerical/selection allowance.
 const dy=radius/6371000*180/Math.PI;
 const cos=Math.cos((Math.abs(point.lat)+dy)*Math.PI/180);
 if(cos<=0)throw Error('Unsupported latitude');
 const dx=radius/6371000*180/Math.PI/cos;
 const keys=[];
 // Reuse the original spherical closest-point tile test. Include every tile
 // intersecting the walking budget, not only tiles containing facilities.
 for(let x=Math.floor((point.lon-dx)/TILE_DEGREES);x<=Math.floor((point.lon+dx)/TILE_DEGREES);x++)
  for(let y=Math.floor((point.lat-dy)/TILE_DEGREES);y<=Math.floor((point.lat+dy)/TILE_DEGREES);y++){
   const longitude=Math.max(x*TILE_DEGREES,Math.min((x+1)*TILE_DEGREES,point.lon)),delta=(longitude-point.lon)*Math.PI/180,lat=point.lat*Math.PI/180;
   const latitude=Math.max(y*TILE_DEGREES,Math.min((y+1)*TILE_DEGREES,Math.atan2(Math.sin(lat),Math.cos(lat)*Math.cos(delta))*180/Math.PI));
   if(meters(point,{lat:latitude,lon:longitude})<=radius+.01)keys.push(`${x}_${y}`);
  }
 return keys;
}
export function validatePlan(index,point,km){
 const keys=requiredKeys(point,km),missing=keys.filter(k=>!index.tiles[k]);
 if(missing.length)return {status:'coverage-incomplete',missing,keys};
 // Empty covered tiles must be explicitly present. Outside-source tiles never masquerade as empty.
 if(keys.some(k=>index.tiles[k].coverage!==true))return {status:'coverage-incomplete',keys};
 return {status:'ok',keys,bytes:keys.reduce((n,k)=>n+index.tiles[k].gzipBytes,0)};
}
export function assemble(tiles){
 const edges=new Map(),nodes=new Map();
 for(const tile of tiles){
  for(const node of tile.nodes){const prior=nodes.get(node[0]);if(prior&&JSON.stringify(prior)!==JSON.stringify(node))throw Error('Node seam mismatch');nodes.set(node[0],node);}
  for(const edge of tile.edges){const prior=edges.get(edge[0]);if(prior&&JSON.stringify(prior)!==JSON.stringify(edge))throw Error('Edge seam mismatch');edges.set(edge[0],edge);}
 }
 const adjacency=new Map();
 const add=(a,b,d,id)=>{if(!adjacency.has(a))adjacency.set(a,[]);adjacency.get(a).push([b,d,id]);};
 for(const [id,e]of edges){
  const a=nodes.get(e[1]),b=nodes.get(e[2]);if(!a||!b)throw Error('Missing endpoint');
  const length=meters({lat:a[1]/1e7,lon:a[2]/1e7},{lat:b[1]/1e7,lon:b[2]/1e7});
  if(!Number.isFinite(e[3])||e[3]<=0||Math.abs(length-e[3])>.000001)throw Error('Invalid road length');
  add(e[1],e[2],e[3],id);if(e[4]&1)add(e[2],e[1],e[3],id);
 }
 return {nodes,edges,adjacency};
}
export function roadDistances(graph,originId,max){
 if(!graph.nodes.has(originId)||!Number.isFinite(max)||max<0)throw Error('Invalid network origin');
 const queue=new Heap(),dist=new Map([[originId,0]]);queue.push([0,originId]);
 while(queue.a.length){const [d,node]=queue.pop();if(d!==dist.get(node))continue;
  for(const [next,length]of graph.adjacency.get(node)||[]){const n=d+length;if(n<=max&&n<(dist.get(next)??Infinity)){dist.set(next,n);queue.push([n,next]);}}
 }
 return dist;
}
