import {Heap,meters,validPoint,distanceRange} from './core.mjs';
import {coverageMargin} from './osm-core.mjs';
import {prepareEvidence,assessConnection} from './connections.mjs';
export function decodePacked(buffer,facilities,evidence=null) {
  const length=new DataView(buffer).getUint32(0,true);if(length>100000||length+4>buffer.byteLength)throw Error('道路ヘッダーが不正です。');
  const h=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,length))),base=Math.ceil((4+length)/8)*8;
  if(h.version!==1||h.policy!=='conservative-foot-v1')throw Error('道路形式が不正です。');
  const types={i:Int32Array,I:Uint32Array,d:Float64Array,B:Uint8Array};const g={...h,facilities,buffer};
  for(const [name,d] of Object.entries(h.arrays)){
    const Type=types[d.type];if(!Type||!Number.isSafeInteger(d.count)||d.count<0||d.count>5_000_000||d.offset%8||base+d.offset+d.count*Type.BYTES_PER_ELEMENT>buffer.byteLength)throw Error('道路配列が不正です。');
    g[name]=new Type(buffer,base+d.offset,d.count);
  }
  for(const name of h.deltaEncoded||[]){if(!['nodeLat','nodeLon','geoLat','geoLon'].includes(name))throw Error('座標圧縮が不正です。');let total=0;for(let i=0;i<g[name].length;i++){total+=g[name][i];g[name][i]=total;}}
  const n=g.nodeLat.length,e=g.edgeFrom.length;
  if(g.nodeLon.length!==n||g.edgeTo.length!==e||(g.edgeMillimeters||g.edgeMeters).length!==e||g.flags.length!==e||g.geoOffsets.length!==e+1||g.outOffsets.length!==n+1)throw Error('道路配列の長さが不正です。');
  if(g.geoLat.length!==g.geoLon.length||g.geoLat.length!==g.geoOwner.length||g.geoOffsets.at(-1)!==g.geoLat.length||g.outOffsets.at(-1)!==g.outTo.length||g.outTo.length!==g.outEdge.length)throw Error('道路索引が不正です。');
  let maxError=0;
  for(let i=0;i<e;i++){
    if(g.edgeFrom[i]>=n||g.edgeTo[i]>=n||!Number.isFinite(lengthOf(g,i))||lengthOf(g,i)<=0||g.geoOffsets[i+1]-g.geoOffsets[i]<2)throw Error('道路区間が不正です。');
    let measured=0;for(let j=g.geoOffsets[i];j<g.geoOffsets[i+1]-1;j++)measured+=meters(geo(g,j),geo(g,j+1));
    maxError=Math.max(maxError,Math.abs(measured-lengthOf(g,i)));
    if(meters(node(g,g.edgeFrom[i]),geo(g,g.geoOffsets[i]))>.02||meters(node(g,g.edgeTo[i]),geo(g,g.geoOffsets[i+1]-1))>.02)throw Error('道路の端点が不正です。');
  }
  if(maxError>1)throw Error('道路長を保持できていません。');g.lengthErrorMax=maxError;
  if(evidence){g.connectionEvidence=prepareEvidence(evidence);g.elevatedEdges=new Set(evidence.elevatedEdges||[]);}return g;
}
const node=(g,i)=>({lat:g.nodeLat[i]/1e7,lon:g.nodeLon[i]/1e7});
const geo=(g,i)=>({lat:g.geoLat[i]/1e7,lon:g.geoLon[i]/1e7});
const lengthOf=(g,i)=>g.edgeMillimeters?g.edgeMillimeters[i]/1000:g.edgeMeters[i];
export function packedSnap(g,p){return packedSnapCandidates(g,p,1)[0]||null;}
export function packedSnapCandidates(g,p,limit=8){
  if(!validPoint(p))throw Error('座標が不正です。');const grid=g.grid,x=Math.floor(p.lon*grid.scale)-grid.x0,y=Math.floor(p.lat*grid.scale)-grid.y0,seen=new Set(),bestByEdge=new Map();const scale=Math.cos(p.lat*Math.PI/180);
  for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++){
    if(xx<0||yy<0||xx>=grid.width||yy>=grid.height)continue;const c=yy*grid.width+xx;
    for(let k=g.cellOffsets[c];k<g.cellOffsets[c+1];k++){
      const j=g.cellSegments[k];if(seen.has(j))continue;seen.add(j);const edge=g.geoOwner[j];if(g.heldRoadEdges?.has(edge))continue;const a=geo(g,j),b=geo(g,j+1),vx=(b.lon-a.lon)*scale,vy=b.lat-a.lat,den=vx*vx+vy*vy;
      const q=den===0?0:Math.max(0,Math.min(1,((p.lon-a.lon)*scale*vx+(p.lat-a.lat)*vy)/den));const point={lat:a.lat+q*(b.lat-a.lat),lon:a.lon+q*(b.lon-a.lon)},gap=meters(p,point);
      if(gap<=50&&(!bestByEdge.has(edge)||gap<bestByEdge.get(edge).gapMeters)){let offset=0;for(let t=g.geoOffsets[edge];t<j;t++)offset+=meters(geo(g,t),geo(g,t+1));bestByEdge.set(edge,{edge,offsetMeters:offset+q*meters(a,b),gapMeters:gap,...point});}
    }
  }
  return [...bestByEdge.values()].sort((a,b)=>a.gapMeters-b.gapMeters).slice(0,limit);
}
function piece(g,e,start,end){const reverse=start>end,low=Math.min(start,end),high=Math.max(start,end),out=[];let sum=0;
  for(let i=g.geoOffsets[e];i<g.geoOffsets[e+1]-1;i++){const a=geo(g,i),b=geo(g,i+1),length=meters(a,b);if(length>0&&sum+length>=low&&sum<=high){for(const v of [Math.max(sum,low),Math.min(sum+length,high)]){const q=Math.max(0,Math.min(1,(v-sum)/length));out.push([a.lat+q*(b.lat-a.lat),a.lon+q*(b.lon-a.lon)]);}}sum+=length;}return reverse?out.reverse():out;
}
function matches(f,clauses){return clauses.some(c=>f.type===c.type&&c.predicates.every(p=>p.op==='exists'?f.tags[p.key]!==undefined:p.op==='='?f.tags[p.key]===p.value:typeof f.tags[p.key]==='string'&&new RegExp(p.value).test(f.tags[p.key])));}
export function chooseOrigin(g,p,{legacy=false}={}){
  const started=performance.now(),snaps=packedSnapCandidates(g,p,legacy?1:8),snapMs=performance.now()-started,evidenceStart=performance.now();if(!snaps.length)return null;
  const isElevated=s=>g.elevatedEdges?.has(s.edge)||Boolean(g.flags[s.edge]&2);
  if(!legacy&&snaps.some(s=>isElevated(s)&&s.gapMeters<=snaps[0].gapMeters+.02))return {origin:snaps[0],connection:{type:'unknown',reason:'elevated-road',gapMeters:snaps[0].gapMeters},snapMs,evidenceMs:performance.now()-evidenceStart,alternative:false};
  let first=null;
  for(const snap of snaps){const points=[];for(let j=g.geoOffsets[snap.edge];j<g.geoOffsets[snap.edge+1];j++)points.push([g.geoLon[j]/1e7,g.geoLat[j]/1e7]);
    const connection=assessConnection(g.connectionEvidence,snap,p,{elevated:isElevated(snap),roadSupport:{policy:g.policy,points},legacy});
    const answer={origin:snap,connection,snapMs,evidenceMs:performance.now()-evidenceStart,alternative:snaps[0].edge!==snap.edge};if(!first)first=answer;
    // Prefer the closest positively supported connection, not a farther road
    // chosen to manufacture a target distance. Unknown never becomes success.
    if(connection.type==='mapped-walk-connection')return answer;
  }
  return {...first,evidenceMs:performance.now()-evidenceStart};
}
export function searchPacked(g,p,km,clauses,includeRoadPoints=false,random=Math.random,options={}){
  if(options.mode&&!['traditional','block','simple'].includes(options.mode))throw Error('検索方式が不正です。');
  const start=performance.now(),[min,max]=options.measureAllDistances?[0,11000]:distanceRange(km);
  if(g.partitionBudget&&(g.partitionBudget.point.lat!==p.lat||g.partitionBudget.point.lon!==p.lon||max>g.partitionBudget.max))return {status:'partition-incomplete',message:'読み込み済み区画ではこの起点・距離を保証できません。必要な区画を読み直してください。'};
  const timings={};let clock=performance.now();
  if(coverageMargin(g,p)<max+100)return {status:'coverage-incomplete',message:'この座標・距離条件では道路データの範囲が不足します。候補0件とは区別しています。'};
  const originSelection=chooseOrigin(g,p,{legacy:options.connectionPolicy==='legacy'}),origin=originSelection?.origin;if(!origin)return {status:'origin-unconnected',message:'起点から50m以内の利用可能道路がありません。座標またはGPSを確認してください。'};
  timings.originSnapMs=originSelection.snapMs;timings.originEvidenceMs=originSelection.evidenceMs;clock=performance.now();
  const cacheKey=p.lat+':'+p.lon+':'+max+':'+origin.edge+':'+origin.offsetMeters, cached=!options.noNetworkCache&&g.networkCache?.key===cacheKey?g.networkCache:null;
  const n=g.nodeLat.length,d=cached?.d||new Float64Array(n),parent=cached?.parent||new Int32Array(n),pe=cached?.pe||new Int32Array(n);if(!cached){d.fill(Infinity);parent.fill(-1);pe.fill(-1);}const heap=new Heap(),oe=origin.edge,from=g.edgeFrom[oe],to=g.edgeTo[oe],len=lengthOf(g,oe);
  const initial=[[to,Math.max(0,len-origin.offsetMeters)]];if(g.flags[oe]&1)initial.push([from,origin.offsetMeters]);
  for(const [v,c]of initial)if(!cached&&c<d[v]){d[v]=c;heap.push([c,v]);}let visited=cached?.visited||0;
  while(heap.a.length){const [cost,v]=heap.pop();if(cost!==d[v])continue;if(cost>max)break;visited++;
    for(let i=g.outOffsets[v];i<g.outOffsets[v+1];i++){const e=g.outEdge[i];if(g.heldRoadEdges?.has(e))continue;const target=g.outTo[i],next=cost+lengthOf(g,e);if(next>max||next>=d[target])continue;d[target]=next;parent[target]=v;pe[target]=e;heap.push([next,target]);}}
  if(!cached&&!options.noNetworkCache)g.networkCache={key:cacheKey,d,parent,pe,visited};
  timings.networkSearchMs=performance.now()-clock;clock=performance.now();
  const originConnection=originSelection.connection;clock=performance.now();
  const candidates=[];let held=0,blocked=0,notReachedWithinBudget=0,matchedFacilityCount=0,roadReachedProjectionCount=0,outsideRangeCount=0,connectionUnavailableCount=0;const connectionCounts={'osm-entrance':0,'osm-node':0,'mapped-walk-connection':0,unknown:0,blocked:0};
  for(let index=0;index<g.facilities.length;index++){const f=g.facilities[index];if(!matches(f,clauses))continue;matchedFacilityCount++;let cost=Infinity,end=-1,direct=false,endpoint=f.snap;
    const traditional=f.connection||{type:f.quality==='road-point-only'?'unknown':f.quality,gapMeters:f.snap?.gapMeters??null};
    if(options.mode&&options.mode!=='traditional'&&f.blockStudy?.restricted){connectionUnavailableCount++;continue;}
    let connection=traditional;
    const estimated=options.mode&&options.mode!=='traditional'&&['unknown','blocked'].includes(traditional.type);
    if(estimated){
      const study=f.blockStudy;
      const choices=options.mode==='block'?study?.approaches:study?.simpleApproaches;
      if(!choices?.length){const sourceCount=options.mode==='block'?study?.sourceApproachCount:study?.sourceSimpleApproachCount;if(sourceCount>0)notReachedWithinBudget++;else connectionUnavailableCount++;continue;}
      for(const s of choices){const e=s.edge;if(g.heldRoadEdges?.has(e))continue;const q=s.offsetMeters,a=g.edgeFrom[e],b=g.edgeTo[e],length=lengthOf(g,e);let c=d[a]+q,v=a,dr=false;
        if((g.flags[e]&1)&&d[b]+length-q<c){c=d[b]+length-q;v=b;}
        if(e===oe&&((g.flags[e]&1)||q>=origin.offsetMeters)&&Math.abs(q-origin.offsetMeters)<c){c=Math.abs(q-origin.offsetMeters);dr=true;}
        if(c<cost){cost=c;end=v;direct=dr;endpoint=s;}
      }
      connection={type:options.mode==='block'?'block-estimate':'nearest-road-estimate',reason:'facility-access-unverified',gapMeters:null,blockKind:study.kind,blockOsm:study.osm,facilityOffsetMeters:endpoint?.facilityOffsetMeters,warnings:study.warnings};
    }
    else if(f.nodes){for(const v of f.nodes)if(v<n&&d[v]<cost){cost=d[v];end=v;}}
    else if(f.snap){const e=f.snap.edge;if(g.heldRoadEdges?.has(e)){notReachedWithinBudget++;continue;}const q=f.snap.offsetMeters,a=g.edgeFrom[e],b=g.edgeTo[e],length=lengthOf(g,e);if(d[a]+q<cost){cost=d[a]+q;end=a;}if((g.flags[e]&1)&&d[b]+length-q<cost){cost=d[b]+length-q;end=b;}if(e===oe&&((g.flags[e]&1)||q>=origin.offsetMeters)&&Math.abs(q-origin.offsetMeters)<cost){cost=Math.abs(q-origin.offsetMeters);direct=true;}}
    if(!Number.isFinite(cost)){notReachedWithinBudget++;continue;}roadReachedProjectionCount++;
    const quality=connection.type;
    // This last straight connector is only an estimate on positively mapped
    // pedestrian surface. It never changes facility coordinates or GPS arrival.
    const approachEstimateMeters=quality==='mapped-walk-connection'?connection.gapMeters:null;
    const evaluatedDistanceMeters=cost+(approachEstimateMeters||0);
    if(evaluatedDistanceMeters<min||evaluatedDistanceMeters>max){outsideRangeCount++;continue;}
    connectionCounts[quality]=(connectionCounts[quality]||0)+1;
    if(quality==='blocked'){blocked++;continue;}
    if(quality==='unknown'&&!includeRoadPoints){held++;continue;}
    candidates.push({id:f.id,name:f.name,lat:f.lat,lon:f.lon,quality,distanceMeters:cost,approachEstimateMeters,evaluatedDistanceMeters,connection,endNode:end,direct,index,endpoint});
  }
  timings.candidateFilterMs=performance.now()-clock;clock=performance.now();
  const originSupported=originConnection.type==='mapped-walk-connection',reachabilityCounts={'osm-evidence-complete':0,'origin-unverified':0,'destination-estimate':0,'destination-unverified':0};
  for(const c of candidates){c.reachability=!originSupported?'origin-unverified':c.quality.endsWith('estimate')?'destination-estimate':c.quality==='unknown'?'destination-unverified':'osm-evidence-complete';reachabilityCounts[c.reachability]++;}
  let picked=null,path=[],routeEdges=[];
  if(candidates.length){picked=candidates[Math.floor(random()*candidates.length)];const f=g.facilities[picked.index];
    if(picked.direct){path=piece(g,oe,origin.offsetMeters,picked.endpoint.offsetMeters);routeEdges.push(oe);}
    else {const chain=[];let v=picked.endNode;for(let guard=0;parent[v]>=0&&guard<n;guard++){chain.push([pe[v],parent[v],v]);v=parent[v];}
      path=piece(g,oe,origin.offsetMeters,v===from?0:len);routeEdges.push(oe);
      for(const [e,a]of chain.reverse()){path.push(...piece(g,e,a===g.edgeFrom[e]?0:lengthOf(g,e),a===g.edgeFrom[e]?lengthOf(g,e):0));routeEdges.push(e);}
      if(picked.endpoint){const e=picked.endpoint.edge;path.push(...piece(g,e,picked.endNode===g.edgeFrom[e]?0:lengthOf(g,e),picked.endpoint.offsetMeters));routeEdges.push(e);}
    }
  }
  timings.selectionPathMs=performance.now()-clock;
  return {status:'ok',kind:'osm-study',candidates,picked,path,routeEdges,origin,originConnection,originAlternative:originSelection.alternative,reachabilityCounts,visited,held,blocked,connectionCounts,notReachedWithinBudget,matchedFacilityCount,roadReachedProjectionCount,outsideRangeCount,connectionUnavailableCount,searchMs:performance.now()-start,timings,networkReused:Boolean(cached),
    typedArrayBytes:g.buffer.byteLength+d.byteLength+parent.byteLength+pe.byteLength,
    lengthErrorMax:g.lengthErrorMax,bridgeEdges:routeEdges.filter(e=>g.flags[e]&2).length,stepsEdges:routeEdges.filter(e=>g.flags[e]&4).length,
    memoryNote:'道路バッファと距離・前駆配列のサイズです。施設・街区JSON、探索ヒープ、ブラウザー全体は含みません。'};
}
