export function applyRoadSafety(graph,data,graphSha256,policySha256){
  const count=graph.sourceEdgeCount||graph.edgeFrom.length;
  if(data?.version!==1||data.policy!=='hold-mapped-restricted-ground-area-v1'||data.graphSha256!==graphSha256||data.sourceEdgeCount!==count||!Array.isArray(data.records))throw Error('通行制限データの版が一致しません。');
  const source=new Set(),held=new Set();for(const row of data.records){if(!Number.isInteger(row.edge)||row.edge<0||row.edge>=count||source.has(row.edge)||row.reason!=='held-mapped-restricted-ground-area'||!Array.isArray(row.areas)||!row.areas.length||!row.areas.every(x=>typeof x==='string'))throw Error('通行制限道路の値が不正です。');source.add(row.edge);const local=graph.sourceEdgeMap?graph.sourceEdgeMap.get(row.edge):row.edge;if(Number.isInteger(local))held.add(local);}
  graph.heldRoadEdges=held;graph.roadSafetySHA=policySha256;delete graph.networkCache;
}
