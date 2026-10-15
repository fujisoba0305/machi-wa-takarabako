// Geometry evidence for a final approach, never an arrival or rewards decision.
// All distance units here are meters. Unknown is deliberately distinct from blocked.
const SCALE=111195;
const metric=(p,lat)=>[p[0]*SCALE*Math.cos(lat*Math.PI/180),p[1]*SCALE];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function pointSegment(p,a,b){const x=b[0]-a[0],y=b[1]-a[1],v=x*x+y*y,t=v?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/v)):0;return distance(p,[a[0]+t*x,a[1]+t*y]);}
function cross(a,b){return a[0]*b[1]-a[1]*b[0];}
function intersection(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],v=cross(r,s),u=[c[0]-a[0],c[1]-a[1]];if(Math.abs(v)<1e-10)return null;const t=cross(u,s)/v,q=cross(u,r)/v;return t>=-1e-9&&t<=1+1e-9&&q>=-1e-9&&q<=1+1e-9?Math.max(0,Math.min(1,t)):null;}
function segmentGap(a,b,c,d){return intersection(a,b,c,d)!==null?0:Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));}
function ringContains(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if(pointSegment(p,a,b)<1e-9)return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function contains(p,f){return ringContains(p,f.points)&&!(f.holes||[]).some(h=>ringContains(p,h));}
function cuts(a,b,ring){const out=[];for(let i=1;i<ring.length;i++){const t=intersection(a,b,ring[i-1],ring[i]);if(t!==null)out.push(t);}return out;}
function covers(a,b,f){const ts=[0,1,...cuts(a,b,f.points),...(f.holes||[]).flatMap(h=>cuts(a,b,h))].sort((x,y)=>x-y);for(let i=0;i<ts.length-1;i++){const t=(ts[i]+ts[i+1])/2;if(!contains([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],f))return false;}return contains(a,f)&&contains(b,f);}
function circleInterval(a,b,c,r){const v=[b[0]-a[0],b[1]-a[1]],u=[a[0]-c[0],a[1]-c[1]],aa=v[0]*v[0]+v[1]*v[1];if(!aa)return distance(a,c)<=r?[[0,1]]:[];const bb=2*(u[0]*v[0]+u[1]*v[1]),cc=u[0]*u[0]+u[1]*u[1]-r*r,disc=bb*bb-4*aa*cc;if(disc<0)return [];const root=Math.sqrt(disc),lo=Math.max(0,(-bb-root)/(2*aa)),hi=Math.min(1,(-bb+root)/(2*aa));return hi>=lo?[[lo,hi]]:[];}
function capsuleIntervals(a,b,c,d,r){const v=[d[0]-c[0],d[1]-c[1]],len=distance(c,d);if(!len)return circleInterval(a,b,c,r);const ux=v[0]/len,uy=v[1]/len,along=p=>(p[0]-c[0])*ux+(p[1]-c[1])*uy,side=p=>-(p[0]-c[0])*uy+(p[1]-c[1])*ux;let lo=0,hi=1;
  for(const [start,end,min,max] of [[along(a),along(b),0,len],[side(a),side(b),-r,r]]){const delta=end-start;if(Math.abs(delta)<1e-12){if(start<min||start>max){lo=1;hi=0;break;}}else{const t0=(min-start)/delta,t1=(max-start)/delta;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}}
  return [...(hi>=lo?[[lo,hi]]:[]),...circleInterval(a,b,c,r),...circleInterval(a,b,d,r)];
}
function surfaceIntervals(a,b,f){if(f.kind==='pedestrian-area'){const ts=[0,1,...cuts(a,b,f.points),...(f.holes||[]).flatMap(h=>cuts(a,b,h))].sort((x,y)=>x-y),out=[];for(let i=0;i<ts.length-1;i++){const t=(ts[i]+ts[i+1])/2;if(contains([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],f))out.push([ts[i],ts[i+1]]);}return out;}
  if(f.kind==='walk-surface'){
    // width=1 in old extraction may be a fallback, not an explicit OSM width.
    // New promotions use only line coincidence for such ambiguous widths.
    const r=f.width>1?f.width/2:.02;return f.points.slice(1).flatMap((p,i)=>capsuleIntervals(a,b,f.points[i],p,r));
  }return [];
}
function continuousUnion(a,b,features){const intervals=features.flatMap(f=>surfaceIntervals(a,b,f).map(range=>({range,osm:f.osm}))).sort((x,y)=>x.range[0]-y.range[0]),ids=new Set();let end=0,started=false;for(const item of intervals){const [lo,hi]=item.range;if(lo>end+1e-10)break;if(hi>=end){end=hi;started=true;if(item.osm)ids.add(item.osm);}if(started&&end>=1-1e-10)return [...ids];}return null;}
export function connectionExplanation(result){
  const labels={'evidence-missing':'接続を調べる地図情報がありません。','elevated-road':'地上と橋・高架・地下の高さの対応が未確認です。','no-positive-pedestrian-geometry':'道路まで近くても、間を歩ける面・通路の根拠が不足しています。','mapped-road-coincidence':'徒歩道路として抽出した地図上の道路線と一致しています。','mapped-connected-surfaces':'接続区間全体が、連続した歩行可能な地図形状に含まれます。','mapped-pedestrian-area':'接続区間全体が、地図にある歩行者広場に含まれます。','mapped-footway-surface':'接続区間全体が、地図にある歩道形状に含まれます。','building':'建物を横断する接続になるため保留します。','water':'水路を横断する接続になるため保留します。','water-area':'水域を横断する接続になるため保留します。','rail':'線路を横断する接続になるため保留します。','barrier':'柵・壁などを横断する接続になるため保留します。','restricted':'通行制限のある道路を横断する接続になるため保留します。','restricted-area':'立入制限のある敷地を横断する接続になるため保留します。'};
  return labels[result?.reason]||'この接続は現地で未確認です。';
}
export function prepareEvidence(data){
  if(data?.version!==1||data.policy!=='positive-ground-walk-surface-v1'||!Array.isArray(data.features))throw Error('接続根拠の形式が不正です。');
  const cells=new Map(),scale=500;
  data.features.forEach((f,i)=>{if(!Array.isArray(f.points)||f.points.length<2||f.points.some(p=>p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90))throw Error('接続根拠の座標が不正です。');
    let xmin=Infinity,ymin=Infinity,xmax=-Infinity,ymax=-Infinity;for(const [x,y] of f.points){xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}const pad=.002,b=data.bounds;
    if(b){xmin=Math.max(xmin,b[0]);xmax=Math.min(xmax,b[2]);ymin=Math.max(ymin,b[1]);ymax=Math.min(ymax,b[3]);}
    for(let y=Math.floor((ymin-pad)*scale);y<=Math.floor((ymax+pad)*scale);y++)for(let x=Math.floor((xmin-pad)*scale);x<=Math.floor((xmax+pad)*scale);x++){const key=y+':'+x;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);}
  });return {...data,cells,scale};
}
export function assessConnection(evidence,from,to,{elevated=false,ignoreBuildingIds=null,projectionOnly=false,roadSupport=null,legacy=false}={}){
  const a=metric([from.lon,from.lat],to.lat),b=metric([to.lon,to.lat],to.lat),gap=distance(a,b);
  if(elevated)return {type:'unknown',reason:'elevated-road',gapMeters:gap};
  if(!evidence)return {type:'unknown',reason:'evidence-missing',gapMeters:gap};
  const seen=new Set(),features=[];
  for(let y=Math.floor(Math.min(from.lat,to.lat)*evidence.scale);y<=Math.floor(Math.max(from.lat,to.lat)*evidence.scale);y++)for(let x=Math.floor(Math.min(from.lon,to.lon)*evidence.scale);x<=Math.floor(Math.max(from.lon,to.lon)*evidence.scale);x++)for(const i of evidence.cells.get(y+':'+x)||[]){if(seen.has(i))continue;seen.add(i);const raw=evidence.features[i];features.push({...raw,points:raw.points.map(p=>metric(p,to.lat)),holes:raw.holes?.map(h=>h.map(p=>metric(p,to.lat)))});}
  // A connector is rejected if it crosses mapped obstacles. No straight-line hop
  // through a river, railway, private area, building or wall is added to the graph.
  for(const f of features){if(['walk-surface','pedestrian-area'].includes(f.kind))continue;
    // Only independent block/projection studies opt in. This never certifies
    // walking through a building, and never skips rails, water or fences.
    if(f.kind==='building'&&(projectionOnly||ignoreBuildingIds?.has(f.osm)))continue;
    const blocked=f.polygon?(contains(a,f)||contains(b,f)||cuts(a,b,f.points).length>0||(f.holes||[]).some(h=>cuts(a,b,h).length>0)):
      f.points.slice(1).some((p,i)=>segmentGap(a,b,f.points[i],p)<=((f.width||1)/2));
    if(blocked)return {type:'blocked',reason:f.kind,obstacle:f.osm,gapMeters:gap};
  }
  for(const f of features){if(f.kind==='pedestrian-area'&&covers(a,b,f))return {type:'mapped-walk-connection',reason:'mapped-pedestrian-area',evidence:f.osm,gapMeters:gap};
    if(f.kind==='walk-surface'&&f.points.slice(1).some((p,i)=>Math.max(pointSegment(a,f.points[i],p),pointSegment(b,f.points[i],p))<=(f.width||1)/2))return {type:'mapped-walk-connection',reason:'mapped-footway-surface',evidence:f.osm,gapMeters:gap};
  }
  if(!legacy){
    const surfaces=features.filter(f=>['pedestrian-area','walk-surface'].includes(f.kind)),ids=continuousUnion(a,b,surfaces);
    if(ids)return {type:'mapped-walk-connection',reason:'mapped-connected-surfaces',evidence:ids,gapMeters:gap};
    // 2cm is coordinate rounding tolerance, NOT GPS accuracy or a road width.
    // Never use this for an off-road GPS fix (e.g. 4.1m away).
    if(roadSupport?.policy==='conservative-foot-v1'&&Array.isArray(roadSupport.points)&&roadSupport.points.length>=2){const points=roadSupport.points.map(p=>metric(p,to.lat));if(points.slice(1).some((p,i)=>Math.max(pointSegment(a,points[i],p),pointSegment(b,points[i],p))<=.02))return {type:'mapped-walk-connection',reason:'mapped-road-coincidence',evidence:'validated-foot-graph',gapMeters:gap};}
  }
  return {type:'unknown',reason:'no-positive-pedestrian-geometry',gapMeters:gap};
}
