import {distanceRange,validPoint,meters} from './core.mjs';
import {coverageMargin} from './osm-core.mjs';
import {decodePacked} from './packed-core.mjs';
export function selectRoadTiles(index,point,km){
  if(!validPoint(point)||index?.version!==1||index.policy!=='complete-edge-tiles-v1'||index.scale!==50||!Array.isArray(index.tileRange)||!index.tiles)throw Error('道路分割一覧が不正です。');
  const max=distanceRange(km)[1];
  if(coverageMargin(index.header,point)<max+100)return {status:'coverage-incomplete',message:'この座標・距離条件では道路データの範囲が不足します。候補0件とは区別しています。'};
  // A geodesic bound is only used to LOAD data; distances still use road edges.
  // 50m origin projection + worst-case accumulated edge rounding + numerical margin.
  const margin=50+index.edgeCount*index.maxLengthErrorMeters+2;
  if(!Number.isFinite(margin)||margin>300||margin<50)throw Error('道路分割の安全余白が不正です。');
  const angular=(max+margin)/6371000,lat=point.lat*Math.PI/180,dlon=Math.asin(Math.min(1,Math.sin(angular)/Math.cos(lat)))*180/Math.PI,dlat=angular*180/Math.PI;
  const [x0,y0,x1,y1]=index.tileRange,selected=[];
  for(let y=Math.max(y0,Math.floor((point.lat-dlat)*index.scale));y<=Math.min(y1,Math.floor((point.lat+dlat)*index.scale));y++)for(let x=Math.max(x0,Math.floor((point.lon-dlon)*index.scale));x<=Math.min(x1,Math.floor((point.lon+dlon)*index.scale));x++){
    const longitude=Math.max(x/index.scale,Math.min((x+1)/index.scale,point.lon)),delta=(longitude-point.lon)*Math.PI/180;
    const closestLatitude=Math.max(y/index.scale,Math.min((y+1)/index.scale,Math.atan2(Math.sin(lat),Math.cos(lat)*Math.cos(delta))*180/Math.PI));
    if(meters(point,{lat:closestLatitude,lon:longitude})>max+margin+.01)continue;
    const key=y+':'+x,tile=index.tiles[key];if(!tile)throw Error('必要な道路区画が一覧から欠落しています。');if(tile.url)selected.push({key,...tile});else if(tile.edgeCount!==0)throw Error('道路区画の状態が不正です。');
  }
  return {status:'ok',selected,max,margin,point:{...point},key:selected.map(x=>x.sha256).join(':')+':'+point.lat+':'+point.lon+':'+max};
}
function pack(header,fields){
  let offset=0;const arrays={};for(const [name,a] of Object.entries(fields)){offset=Math.ceil(offset/8)*8;arrays[name]={type:a instanceof Int32Array?'i':a instanceof Uint8Array?'B':'I',offset,count:a.length};offset+=a.byteLength;}
  const text=new TextEncoder().encode(JSON.stringify({...header,deltaEncoded:[],arrays})),base=Math.ceil((text.length+4)/8)*8,buffer=new ArrayBuffer(base+offset);new DataView(buffer).setUint32(0,text.length,true);new Uint8Array(buffer).set(text,4);
  for(const [name,a] of Object.entries(fields))new Uint8Array(buffer,base+arrays[name].offset,a.byteLength).set(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));return buffer;
}
export function assembleRoadTiles(index,plan,tiles,sourceFacilities){
  if(plan.status!=='ok'||tiles.length!==plan.selected.length)throw Error('必要な道路区画を読み込めていません。');
  const edges=new Map(),nodes=new Map();
  for(let ti=0;ti<tiles.length;ti++){
    const tile=tiles[ti],expected=plan.selected[ti];
    if(tile?.version!==1||tile.key!==expected.key||tile.graphSha256!==index.graphSha256||!Array.isArray(tile.edges)||!Array.isArray(tile.nodes)||tile.edges.length!==expected.edgeCount)throw Error('道路区画の版・件数が一致しません。');
    for(const node of tile.nodes){if(!Array.isArray(node)||node.length!==3||!node.every(Number.isSafeInteger)||node[0]<0||node[0]>=index.nodeCount||Math.abs(node[1])>900000000||Math.abs(node[2])>1800000000)throw Error('道路区画の点が不正です。');const old=nodes.get(node[0]);if(old&&(old[1]!==node[1]||old[2]!==node[2]))throw Error('境界の道路点が一致しません。');nodes.set(node[0],node);}
    for(const e of tile.edges){
      if(!Array.isArray(e)||e.length!==7||!e.slice(0,5).every(Number.isSafeInteger)||e[0]<0||e[0]>=index.edgeCount||e[3]<=0||e[4]<0||e[4]>7||!Array.isArray(e[5])||e[5].length<4||e[5].length%2||!e[5].every(Number.isSafeInteger)||!Array.isArray(e[6])||e[6].length%2)throw Error('道路区画の区間が不正です。');
      const old=edges.get(e[0]);if(old&&JSON.stringify(old)!==JSON.stringify(e))throw Error('境界で重複した道路が一致しません。');edges.set(e[0],e);
    }
  }
  const ordered=[...edges.values()].sort((a,b)=>a[0]-b[0]),orderedNodes=[...nodes.values()].sort((a,b)=>a[0]-b[0]),edgeMap=new Map(ordered.map((e,i)=>[e[0],i])),nodeMap=new Map(orderedNodes.map((n,i)=>[n[0],i])),n=orderedNodes.length,e=ordered.length,grid=index.header.grid;
  const lat=[],lon=[],owner=[],offsets=[0],cellLists=new Map(),from=new Uint32Array(e),to=new Uint32Array(e),lengths=new Uint32Array(e),flags=new Uint8Array(e),degrees=new Uint32Array(n);
  ordered.forEach((r,i)=>{
    if(!nodeMap.has(r[1])||!nodeMap.has(r[2]))throw Error('道路端点が欠落しています。');from[i]=nodeMap.get(r[1]);to[i]=nodeMap.get(r[2]);lengths[i]=r[3];flags[i]=r[4];degrees[from[i]]++;if(flags[i]&1)degrees[to[i]]++;
    const start=lat.length;for(let j=0;j<r[5].length;j+=2){lat.push(r[5][j]);lon.push(r[5][j+1]);owner.push(i);}offsets.push(lat.length);
    for(let j=0;j<r[6].length;j+=2){const cell=r[6][j],segment=r[6][j+1];if(!Number.isInteger(cell)||cell<0||cell>=grid.width*grid.height||!Number.isInteger(segment)||segment<0||segment>=r[5].length/2-1)throw Error('道路区画の空間索引が不正です。');if(!cellLists.has(cell))cellLists.set(cell,[]);cellLists.get(cell).push(start+segment);}
  });
  const outOffsets=new Uint32Array(n+1);for(let i=0;i<n;i++)outOffsets[i+1]=outOffsets[i]+degrees[i];const outTo=new Uint32Array(outOffsets[n]),outEdge=new Uint32Array(outOffsets[n]),cursor=outOffsets.slice();for(let i=0;i<e;i++){let at=cursor[from[i]]++;outTo[at]=to[i];outEdge[at]=i;if(flags[i]&1){at=cursor[to[i]]++;outTo[at]=from[i];outEdge[at]=i;}}
  const cellOffsets=[0],segments=[];for(let cell=0;cell<grid.width*grid.height;cell++){for(const s of (cellLists.get(cell)||[]).sort((a,b)=>a-b))segments.push(s);cellOffsets.push(segments.length);}
  const fields={nodeLat:Int32Array.from(orderedNodes.map(n=>n[1])),nodeLon:Int32Array.from(orderedNodes.map(n=>n[2])),edgeFrom:from,edgeTo:to,edgeMillimeters:lengths,flags,geoOffsets:Uint32Array.from(offsets),geoLat:Int32Array.from(lat),geoLon:Int32Array.from(lon),geoOwner:Uint32Array.from(owner),cellOffsets:Uint32Array.from(cellOffsets),cellSegments:Uint32Array.from(segments),outOffsets,outTo,outEdge};
  const facilities=sourceFacilities.map(f=>{
    const clone={...f};if(f.nodes)clone.nodes=f.nodes.filter(v=>nodeMap.has(v)).map(v=>nodeMap.get(v));
    if(f.snap&&edgeMap.has(f.snap.edge))clone.snap={...f.snap,edge:edgeMap.get(f.snap.edge)};
    else {delete clone.snap;if(!f.nodes)clone.nodes=[];}return clone;
  });
  const graph=decodePacked(pack(index.header,fields),facilities);graph.sourceEdgeMap=edgeMap;graph.sourceNodeMap=nodeMap;graph.partitionBudget={point:plan.point,max:plan.max};graph.sourceEdgeCount=index.edgeCount;return graph;
}
export function remapBlockStudy(graph,data){
  if(!graph.sourceEdgeMap)return data;
  const remap=choices=>choices.filter(s=>{
    const id=Array.isArray(s)?s[0]:s.edge;if(!Number.isInteger(id)||id<0||id>=graph.sourceEdgeCount)throw Error('元の街区道路IDが不正です。');return graph.sourceEdgeMap.has(id);
  }).map(s=>Array.isArray(s)?[graph.sourceEdgeMap.get(s[0]),...s.slice(1)]:{...s,edge:graph.sourceEdgeMap.get(s.edge)});
  return {...data,records:data.records.map(row=>({...row,sourceApproachCount:row.approaches.length,sourceSimpleApproachCount:row.simpleApproaches.length,approaches:remap(row.approaches),simpleApproaches:remap(row.simpleApproaches)}))};
}
