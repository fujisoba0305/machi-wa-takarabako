import {validPoint} from './core.mjs';
export function attachBlockStudy(graph,data,expected){
 if(data?.version!==1||data.policy!=='block-perimeter-estimate-v1'||data.graphSha256!==expected.graphSha256||data.facilitiesSha256!==expected.facilitiesSha256||!Array.isArray(data.records))throw Error('街区データの形式・道路版・施設版が一致しません。');
 const ids=new Set(graph.facilities.map(f=>f.id)),rows=new Map();
 const decode=s=>{
  if(!Array.isArray(s))return s;
  if(data.endpointEncoding!=='edge-mm-latE7-lonE7-gapCm-perimeterCm-v1'||s.length!==6||!s.every(Number.isSafeInteger))throw Error('街区投影の圧縮形式が不正です。');
  return {edge:s[0],offsetMeters:s[1]/1000,lat:s[2]/1e7,lon:s[3]/1e7,facilityOffsetMeters:s[4]/100,perimeterGapMeters:s[5]/100};
 };
 for(const source of data.records){
  if(!Array.isArray(source.approaches)||!Array.isArray(source.simpleApproaches))throw Error('街区接続形式が不正です。');
  const row={...source,approaches:source.approaches.map(decode),simpleApproaches:source.simpleApproaches.map(decode)};
  if(!ids.has(row.id)||rows.has(row.id)||!Array.isArray(row.approaches)||!Array.isArray(row.simpleApproaches))throw Error('街区施設IDが不正です。');
  if(row.approaches.length>32||row.simpleApproaches.length>1)throw Error('街区接続候補数が不正です。');
  for(const s of [...row.approaches,...row.simpleApproaches]){
   const length=graph.edgeMillimeters?graph.edgeMillimeters[s.edge]/1000:graph.edgeMeters[s.edge];
   if(!Number.isInteger(s.edge)||s.edge<0||s.edge>=graph.edgeFrom.length||!validPoint(s)||!Number.isFinite(s.offsetMeters)||s.offsetMeters<0||s.offsetMeters>length+1||!Number.isFinite(s.facilityOffsetMeters)||s.facilityOffsetMeters<0||s.facilityOffsetMeters>500)throw Error('街区道路投影の値が不正です。');
  }
  if(row.restricted&&(row.approaches.length||row.simpleApproaches.length))throw Error('立入制限施設に推定接続が設定されています。');
  rows.set(row.id,row);
 }
 if(rows.size!==ids.size)throw Error('街区施設データの件数が一致しません。');
 // Validate everything before mutating the Worker graph.
 for(const f of graph.facilities)f.blockStudy=rows.get(f.id);
}
