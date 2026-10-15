import {meters,validPoint,distanceRange,Heap} from './core.mjs';
export function prepareStudy(g) {
  if(g?.version!==1||g.kind!=='osm-study'||g.policy!=='conservative-foot-v1'||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||!Array.isArray(g.facilities))throw Error('道路データの形式が不正です。');
  if(g.nodes.length>1_000_000||g.edges.length>3_000_000||!g.nodes.every(validPoint))throw Error('道路データの点数または座標が不正です。');
  const degrees=new Uint32Array(g.nodes.length),idx=n=>Number.isInteger(n)&&n>=0&&n<g.nodes.length;
  let lengthErrorMax=0;
  for(const e of g.edges) {
    if(!idx(e.from)||!idx(e.to)||!Number.isFinite(e.meters)||e.meters<=0||!Array.isArray(e.geometry)||e.geometry.length<2||e.geometry.some(p=>!validPoint({lat:p[0],lon:p[1]})))throw Error('道路区間が不正です。');
    const a=e.geometry[0],b=e.geometry.at(-1);
    if(meters(g.nodes[e.from],{lat:a[0],lon:a[1]})>.02||meters(g.nodes[e.to],{lat:b[0],lon:b[1]})>.02)throw Error('道路端点が一致しません。');
    const measured=e.geometry.slice(1).reduce((s,p,i)=>s+meters({lat:e.geometry[i][0],lon:e.geometry[i][1]},{lat:p[0],lon:p[1]}),0);
    lengthErrorMax=Math.max(lengthErrorMax,Math.abs(measured-e.meters));if(Math.abs(measured-e.meters)>1)throw Error('道路長を保持できていません。');
    degrees[e.from]++;if(e.bidirectional)degrees[e.to]++;
  }
  const offsets=new Uint32Array(g.nodes.length+1);for(let i=0;i<degrees.length;i++)offsets[i+1]=offsets[i]+degrees[i];
  const to=new Uint32Array(offsets.at(-1)),weights=new Float64Array(to.length),edgeIds=new Uint32Array(to.length),cursor=offsets.slice();
  for(let i=0;i<g.edges.length;i++){const e=g.edges[i];let p=cursor[e.from]++;to[p]=e.to;weights[p]=e.meters;edgeIds[p]=i;if(e.bidirectional){p=cursor[e.to]++;to[p]=e.from;weights[p]=e.meters;edgeIds[p]=i;}}
  const cells=new Map();
  for(let i=0;i<g.edges.length;i++){
    const geo=g.edges[i].geometry;
    for(let j=0;j<geo.length-1;j++) {
      const a=geo[j],b=geo[j+1];
      for(let y=Math.floor(Math.min(a[0],b[0])*1000);y<=Math.floor(Math.max(a[0],b[0])*1000);y++)for(let x=Math.floor(Math.min(a[1],b[1])*1000);x<=Math.floor(Math.max(a[1],b[1])*1000);x++){
        const key=y+':'+x;if(!cells.has(key))cells.set(key,[]);cells.get(key).push([i,j]);
      }
    }
  }
  return {...g,offsets,to,weights,edgeIds,cells,lengthErrorMax,typedGraphBytes:offsets.byteLength+to.byteLength+weights.byteLength+edgeIds.byteLength};
}
export function nearestRoad(g,p) {
  if(!validPoint(p))throw Error('座標が不正です。');const seen=new Set();let best=null;
  const latCell=Math.floor(p.lat*1000),lonCell=Math.floor(p.lon*1000),scale=Math.cos(p.lat*Math.PI/180);
  for(let y=latCell-1;y<=latCell+1;y++)for(let x=lonCell-1;x<=lonCell+1;x++)for(const [i,j] of g.cells.get(y+':'+x)||[]) {
    const key=i+':'+j;if(seen.has(key))continue;seen.add(key);const e=g.edges[i],a=e.geometry[j],b=e.geometry[j+1];
    const vx=(b[1]-a[1])*scale,vy=b[0]-a[0],den=vx*vx+vy*vy;
    const fraction=den===0?0:Math.max(0,Math.min(1,((p.lon-a[1])*scale*vx+(p.lat-a[0])*vy)/den));
    const point={lat:a[0]+fraction*(b[0]-a[0]),lon:a[1]+fraction*(b[1]-a[1])},gap=meters(p,point);
    if(gap<=50&&(!best||gap<best.gapMeters)){
      let before=0;for(let k=0;k<j;k++)before+=meters({lat:e.geometry[k][0],lon:e.geometry[k][1]},{lat:e.geometry[k+1][0],lon:e.geometry[k+1][1]});
      best={edge:i,offsetMeters:before+fraction*meters({lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]}),gapMeters:gap,...point};
    }
  }
  return best;
}
export function coverageMargin(g,p) {
  if(!validPoint(p))return -1;
  const [w,s,e,n]=g.bounds;return Math.min(g.coverageRadiusMeters?g.coverageRadiusMeters-meters(g.sourceCenter,p):Infinity,(p.lat-s)*110000,(n-p.lat)*110000,(p.lon-w)*110000*Math.cos(p.lat*Math.PI/180),(e-p.lon)*110000*Math.cos(p.lat*Math.PI/180));
}
function match(f,clauses){return clauses.some(c=>f.type===c.type&&c.predicates.every(p=>p.op==='exists'?f.tags[p.key]!==undefined:p.op==='='?f.tags[p.key]===p.value:typeof f.tags[p.key]==='string'&&new RegExp(p.value).test(f.tags[p.key])));}
export function condition(definitions,mood,random=Math.random) {
  const selected=mood==='おまかせ'?['カフェ','自然','グルメ','イベント','写真','ストレス解消'][Math.floor(random()*6)]:mood;
  const d=definitions.find(d=>d.choices.mood===selected&&!d.choices.foodGenre&&(!d.choices.eventGenre||d.choices.eventGenre==='おまかせ')&&(!d.choices.shrineGenre||d.choices.shrineGenre==='おまかせ'));
  if(!d)throw Error('カテゴリに対応する条件がありません。');return {selected,clauses:d.clauses};
}
function part(e,start,end) {
  const backwards=start>end,low=Math.min(start,end),high=Math.max(start,end),points=[];let sum=0;
  for(let i=0;i<e.geometry.length-1;i++) {
    const a=e.geometry[i],b=e.geometry[i+1],length=meters({lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]});
    if(sum+length>=low&&sum<=high&&length>0) {
      for(const v of [Math.max(low,sum),Math.min(high,sum+length)]) {
        const t=Math.max(0,Math.min(1,(v-sum)/length));points.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
      }
    }
    sum+=length;
  }
  return backwards?points.reverse():points;
}
export function searchStudy(g,p,km,clauses,includeRoadPoints=false,random=Math.random) {
  const start=performance.now(),[min,max]=distanceRange(km);
  if(coverageMargin(g,p)<max+100)return {status:'coverage-incomplete',message:'この座標・距離条件では道路データの端に近すぎます。範囲不足を候補0件として扱いません。'};
  const origin=nearestRoad(g,p);if(!origin)return {status:'origin-unconnected',message:'現在地から50m以内の利用可能な道路を確認できませんでした。起点座標またはGPS精度を確認してください。'};
  const d=new Float64Array(g.nodes.length);d.fill(Infinity);const parent=new Int32Array(g.nodes.length),parentEdge=new Int32Array(g.nodes.length);parent.fill(-1);parentEdge.fill(-1);
  const heap=new Heap(),oe=g.edges[origin.edge];
  const initial=[[oe.to,Math.max(0,oe.meters-origin.offsetMeters)]];if(oe.bidirectional)initial.push([oe.from,origin.offsetMeters]);
  for(const [node,cost] of initial)if(cost<d[node]){d[node]=cost;heap.push([cost,node]);}
  let visited=0;
  while(heap.a.length){const [cost,node]=heap.pop();if(cost!==d[node])continue;if(cost>max)break;visited++;
    for(let i=g.offsets[node];i<g.offsets[node+1];i++){const next=cost+g.weights[i],to=g.to[i];if(next>max||next>=d[to])continue;d[to]=next;parent[to]=node;parentEdge[to]=g.edgeIds[i];heap.push([next,to]);}}
  const candidates=[];let held=0,unreachable=0;
  for(const f of g.facilities){if(!match(f,clauses))continue;let length=Infinity,endNode=-1,direct=false;
    if(f.nodes){for(const n of f.nodes)if(d[n]<length){length=d[n];endNode=n;}}
    else if(f.snap){const e=g.edges[f.snap.edge],q=f.snap.offsetMeters;
      if(d[e.from]+q<length){length=d[e.from]+q;endNode=e.from;}
      if(e.bidirectional&&d[e.to]+e.meters-q<length){length=d[e.to]+e.meters-q;endNode=e.to;}
      if(f.snap.edge===origin.edge&&(e.bidirectional||q>=origin.offsetMeters)&&Math.abs(q-origin.offsetMeters)<length){length=Math.abs(q-origin.offsetMeters);direct=true;}
    }
    if(!Number.isFinite(length)){unreachable++;continue;}if(length<min||length>max)continue;
    if(f.quality==='road-point-only'&&!includeRoadPoints){held++;continue;}
    candidates.push({...f,distanceMeters:length,endNode,direct});
  }
  let picked=null,path=[],pathEdges=[];
  if(candidates.length){picked=candidates[Math.floor(random()*candidates.length)];
    if(picked.direct){path=part(oe,origin.offsetMeters,picked.snap.offsetMeters);pathEdges=[origin.edge];}
    else {const chain=[];let n=picked.endNode;for(let guard=0;parent[n]!==-1&&guard<g.nodes.length;guard++){const eId=parentEdge[n],previous=parent[n];chain.push({edge:eId,from:previous,to:n});n=previous;}
      path=part(oe,origin.offsetMeters,n===oe.from?0:oe.meters);pathEdges.push(origin.edge);
      for(const c of chain.reverse()){const e=g.edges[c.edge];path.push(...(c.from===e.from?e.geometry:e.geometry.slice().reverse()));pathEdges.push(c.edge);}
      if(picked.snap){const e=g.edges[picked.snap.edge];path.push(...part(e,picked.endNode===e.from?0:e.meters,picked.snap.offsetMeters));pathEdges.push(picked.snap.edge);}
    }
  }
  return {status:'ok',kind:'osm-study',candidates:candidates.map(({tags,osmNodeIds, ...f})=>f),picked,path,origin,
    visited,held,notReachedWithinBudget:unreachable,searchMs:performance.now()-start,
    typedArrayBytes:g.typedGraphBytes+d.byteLength+parent.byteLength+parentEdge.byteLength,
    bridgeEdges:pathEdges.filter(i=>g.edges[i].bridge).length,stepsEdges:pathEdges.filter(i=>g.edges[i].highway==='steps').length,
    lengthErrorMax:g.lengthErrorMax,
    memoryNote:'型付き配列の確定サイズのみ。JSONオブジェクト、空間索引、ヒープ、ブラウザー全体は含みません。'};
}
