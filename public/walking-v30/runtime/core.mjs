export function validPoint(p) {
  return p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180;
}
export function meters(a, b) {
  const rad = Math.PI / 180, x = Math.sin((b.lat-a.lat)*rad/2)**2 +
    Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1,x)), Math.sqrt(Math.max(0,1-x)));
}
export function regionFor(point, regions) {
  if (!validPoint(point)) throw Error('緯度・経度を正しく入力してください。');
  return regions.find(r => Array.isArray(r.bounds) && r.bounds.length === 4 &&
    r.bounds.every(Number.isFinite) && point.lon >= r.bounds[0] && point.lat >= r.bounds[1] &&
    point.lon <= r.bounds[2] && point.lat <= r.bounds[3]) ?? null;
}
const ranges = { 1: [0,2000], 3: [2000,4000], 5: [4000,6000], 10: [9000,11000] };
export function distanceRange(km) {
  if (!ranges[km]) throw Error('距離は1・3・5・10kmから選んでください。');
  return ranges[km];
}
// Synthetic data is deliberate: no invented street/OSM results are presented as real.
export function demoGraph(point) {
  if (!validPoint(point)) throw Error('不正な座標です。');
  const nodes = Array.from({length:12},(_,i)=>({lat:point.lat,lon:point.lon}));
  return { kind:'synthetic', nodes, edges:Array.from({length:11},(_,i)=>({from:i,to:i+1,meters:1000,bidirectional:true})),
    facilities:Array.from({length:11},(_,i)=>({id:'demo-'+(i+1),name:'人工テスト地点 '+(i+1),node:i+1})), sourceNode:0 };
}
export class Heap {
  a=[];
  push(item) {
    let i=this.a.length; this.a.push(item);
    while(i>0) { const p=(i-1)>>1; if(this.a[p][0]<=item[0])break; this.a[i]=this.a[p]; i=p; }
    this.a[i]=item;
  }
  pop() {
    const first=this.a[0], last=this.a.pop();
    if(this.a.length) {
      let i=0;
      while(i*2+1<this.a.length) {
        let c=i*2+1; if(c+1<this.a.length&&this.a[c+1][0]<this.a[c][0])c++;
        if(this.a[c][0]>=last[0])break; this.a[i]=this.a[c]; i=c;
      }
      this.a[i]=last;
    }
    return first;
  }
}
export function prepareGraph(graph) {
  if(graph?.kind!=='synthetic') throw Error('実道路データの処理は地域指定・品質検証後に追加します。');
  if(!Array.isArray(graph.nodes)||!graph.nodes.length||graph.nodes.length>1_000_000||!graph.nodes.every(validPoint)) throw Error('不正な道路点です。');
  if(!Array.isArray(graph.edges)||graph.edges.length>3_000_000) throw Error('不正な道路区間です。');
  const adj=Array.from({length:graph.nodes.length},()=>[]);
  const index=i=>Number.isInteger(i)&&i>=0&&i<adj.length;
  if(!index(graph.sourceNode))throw Error('起点がありません。');
  for(const e of graph.edges) {
    if(!index(e.from)||!index(e.to)||!Number.isFinite(e.meters)||e.meters<0)throw Error('不正な道路区間です。');
    if(e.blocked===true)continue;
    adj[e.from].push([e.to,e.meters]);
    if(e.bidirectional===true)adj[e.to].push([e.from,e.meters]);
  }
  if(!Array.isArray(graph.facilities)||graph.facilities.some(f=>!index(f.node)||typeof f.id!=='string'||typeof f.name!=='string'))throw Error('不正な候補です。');
  return { ...graph, adj };
}
export function searchGraph(graph, km) {
  const started=performance.now(), [min,max]=distanceRange(km), d=new Float64Array(graph.nodes.length);
  d.fill(Infinity); d[graph.sourceNode]=0;
  const heap=new Heap(); heap.push([0,graph.sourceNode]); let visited=0;
  while(heap.a.length) {
    const [cost,node]=heap.pop(); if(cost!==d[node])continue; if(cost>max)break; visited++;
    for(const [to,length] of graph.adj[node]) {
      const next=cost+length; if(next>max||next>=d[to])continue;
      d[to]=next; heap.push([next,to]);
    }
  }
  const seen=new Set(), candidates=[];
  for(const f of graph.facilities) if(!seen.has(f.id)&&d[f.node]>=min&&d[f.node]<=max) {
    seen.add(f.id); candidates.push({...f,distanceMeters:d[f.node]});
  }
  return { kind:graph.kind,candidates,visited,searchMs:performance.now()-started,
    distanceArrayBytes:d.byteLength,range:[min,max],
    memoryNote:'距離配列のみのサイズです。グラフ・ヒープ・ブラウザー全体のメモリ使用量ではありません。' };
}
