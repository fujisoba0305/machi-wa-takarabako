import {readTrialAsset} from './read-trial-asset.mjs';
import {safeDiagnostic} from './diagnostics.mjs';
import {demoGraph,prepareGraph,searchGraph} from './core.mjs';
import {prepareStudy,searchStudy,condition} from './osm-core.mjs';
import {packedSnap,decodePacked,searchPacked} from './packed-core.mjs';
import {assessConnection,prepareEvidence} from './connections.mjs';
import {attachBlockStudy} from './block-data.mjs';
import {decodeRoadTransport} from './road-transport.mjs';
import {planPartition,loadPartition,readVerifiedJson} from './partition-loader.mjs';
import {remapBlockStudy} from './partition-road.mjs';
import {applyRoadSafety} from './road-safety.mjs';
let prepared=null,study=null,studyURL=null,definitions=null,loadTask=null,evidenceTile=null,blocksURL=null;
let roadSafetyCache=null;
self.onmessage=async({data})=>{
  let stage='worker';const begin=performance.now(),stageTimes={},downloads=[];let stageClock=begin;
  const progress=(value,details={})=>{const now=performance.now();stageTimes[stage]=(stageTimes[stage]||0)+now-stageClock;stageClock=now;stage=value;postMessage({id:data.id,progress:safeDiagnostic(stage,{elapsedMs:now-begin,...details})});};
  const asset=async(url,value)=>{progress(value);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);try{const start=performance.now(),response=await fetch(url.startsWith('/data/')?'/walking-trial'+url+'.gz':'/walking-trial'+url,{signal:controller.signal}),headersMs=performance.now()-start;if(!response.ok)throw Error('HTTP '+response.status);const bodyStart=performance.now(),buffer=await readTrialAsset(response,url.startsWith('/data/'));downloads.push({stage:value,headersMs,bodyAndBrowserDecompressionMs:performance.now()-bodyStart,decodedBytes:buffer.byteLength});progress(value,{bytes:buffer.byteLength});return buffer;}finally{clearTimeout(timer);}};
  try {
    if(data.type==='prepare-demo') { prepared=prepareGraph(demoGraph(data.point)); postMessage({id:data.id,ready:true,kind:'synthetic'}); }
    else if(data.type==='search'&&prepared)postMessage({id:data.id,result:searchGraph(prepared,data.km)});
    else if(data.type==='study') {
      const started=performance.now();let loadMs=0,decodedBytes=0;
      let partition=null;
      if(data.roadMode==='partitioned')partition=await planPartition(data.region,data.point,data.km,asset);
      if(partition&&partition.plan.status!=='ok'){postMessage({id:data.id,result:{...partition.plan}});return;}
      const usePartition=partition&&!partition.fallback;
      const versionKey=usePartition?data.region.partitionRoads.sha256+':'+partition.plan.key+':'+(data.region.roadSafety?.sha256||'none'):[data.region.url,data.region.facilitiesSha256,data.region.connectionEvidence?.sha256,data.region.roadTransport?.sha256,data.region.roadSafety?.sha256].join(':');
      const roadDataReused=Boolean(study&&studyURL===versionKey);
      if(usePartition&&(!study||studyURL!==versionKey)){
        study=await loadPartition(partition.index,partition.plan,data.region,asset,progress);
        if(!definitions)definitions=JSON.parse(new TextDecoder().decode(await asset('/conditions.json','conditions')));
        studyURL=versionKey;evidenceTile=null;blocksURL=null;loadMs=performance.now()-started;
        decodedBytes=downloads.reduce((sum,x)=>sum+x.decodedBytes,0);
      }
      if(!study||studyURL!==versionKey){
        if(!/^\/data\/[a-z0-9-]+-[a-f0-9]{12}\.(json|bin)$/.test(data.region.url))throw Error('地域ファイル名が不正です。');
        if(!loadTask)loadTask=(async()=>{
          const transport=data.region.roadTransport;
          if(transport&&(transport.format!=='lossless-arrays-v1'||!/^\/data\/[a-z0-9-]+-[a-f0-9]{12}\.bin$/.test(transport.url)))throw Error('道路通信形式が不正です。');
          let buffer=await asset(transport?.url||data.region.url,'road');decodedBytes=buffer.byteLength;progress('roadHash');
          if(transport){
            const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join('');
            if(hash!==transport.sha256)throw Error('道路通信データの整合性を確認できませんでした。');
            progress('roadUnpack');buffer=decodeRoadTransport(buffer);progress('roadHash');
          }
          const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join('');
          if(digest!==data.region.sha256)throw Error('道路データの整合性を確認できませんでした。');
          if(data.region.format==='packed-v1'){
            if(!/^\/data\/[a-z0-9-]+-[a-f0-9]{12}\.json$/.test(data.region.facilitiesUrl))throw Error('施設ファイル名が不正です。');
            const fb=await asset(data.region.facilitiesUrl,'facilities');progress('facilityHash');
            const fh=[...new Uint8Array(await crypto.subtle.digest('SHA-256',fb))].map(x=>x.toString(16).padStart(2,'0')).join('');if(fh!==data.region.facilitiesSha256)throw Error('施設データの整合性を確認できませんでした。');
            let evidence=null;
            if(data.region.connectionEvidence&&data.region.connectionEvidence.format!=='tiles-v1'){const descriptor=data.region.connectionEvidence;if(!/^\/data\/[a-z0-9-]+-[a-f0-9]{12}\.json$/.test(descriptor.url))throw Error('接続根拠ファイル名が不正です。');const er=await fetch(descriptor.url);if(!er.ok)throw Error('接続根拠を読み込めませんでした。');const eb=await er.arrayBuffer();const eh=[...new Uint8Array(await crypto.subtle.digest('SHA-256',eb))].map(x=>x.toString(16).padStart(2,'0')).join('');if(eh!==descriptor.sha256)throw Error('接続根拠の整合性を確認できませんでした。');evidence=JSON.parse(new TextDecoder().decode(eb));decodedBytes+=eb.byteLength;}
            progress('decode');study=decodePacked(buffer,JSON.parse(new TextDecoder().decode(fb)).facilities,evidence);decodedBytes+=fb.byteLength;
          }else study=prepareStudy(JSON.parse(new TextDecoder().decode(buffer)));
          definitions=JSON.parse(new TextDecoder().decode(await asset('/conditions.json','conditions')));
          studyURL=versionKey;evidenceTile=null;blocksURL=null;
        })().finally(()=>{loadTask=null;});
        await loadTask;loadMs=performance.now()-started;
      }
      let evidenceDescriptor=data.region.connectionEvidence;
      if(evidenceDescriptor?.format==='tiles-v1'){
        const key=Math.floor(data.point.lat*evidenceDescriptor.scale)+':'+Math.floor(data.point.lon*evidenceDescriptor.scale);evidenceDescriptor=evidenceDescriptor.tiles[key];
        if(!evidenceDescriptor)throw Error('この起点の接続根拠タイルが未準備です。');
        if(evidenceTile!==evidenceDescriptor.url){const es=performance.now();if(!/^\/data\/[a-z0-9-]+-[a-f0-9]{12}\.json$/.test(evidenceDescriptor.url))throw Error('接続根拠タイル名が不正です。');const eb=await asset(evidenceDescriptor.url,'tile');progress('tileHash');const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',eb))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==evidenceDescriptor.sha256)throw Error('接続根拠タイルの整合性を確認できませんでした。');const tileData=JSON.parse(new TextDecoder().decode(eb));study.connectionEvidence=prepareEvidence(tileData);study.elevatedEdges=new Set((tileData.elevatedEdges||[]).map(e=>study.sourceEdgeMap?study.sourceEdgeMap.get(e):e).filter(Number.isInteger));evidenceTile=evidenceDescriptor.url;decodedBytes+=eb.byteLength;loadMs+=performance.now()-es;}
      }
      const mode=data.searchMode||'traditional',blockDescriptor=mode!=='traditional'?data.region.blockStudy:null;
      const blockDataReused=Boolean(blockDescriptor&&blocksURL===blockDescriptor.sha256);
      if(mode!=='traditional'){
        if(!blockDescriptor)throw Error('街区方式の検証データがありません。従来方式へ切り替えてください。');
        if(blocksURL!==blockDescriptor.sha256){
          if(!/^\/data\/[a-z0-9-]+-[a-f0-9]{12}\.json$/.test(blockDescriptor.url))throw Error('街区ファイル名が不正です。');
          const bs=performance.now(),bb=await asset(blockDescriptor.url,'blocks');progress('blockHash');const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bb))].map(x=>x.toString(16).padStart(2,'0')).join('');
          if(hash!==blockDescriptor.sha256)throw Error('街区データの整合性を確認できませんでした。');
          progress('blockAssign');const parsed=JSON.parse(new TextDecoder().decode(bb));attachBlockStudy(study,remapBlockStudy(study,parsed),{graphSha256:data.region.sha256,facilitiesSha256:data.region.facilitiesSha256});blocksURL=blockDescriptor.sha256;decodedBytes+=bb.byteLength;loadMs+=performance.now()-bs;
        }
      }
      if(data.region.roadSafety&&study.roadSafetySHA!==data.region.roadSafety.sha256){const start=performance.now();if(roadSafetyCache?.sha256!==data.region.roadSafety.sha256)roadSafetyCache={sha256:data.region.roadSafety.sha256,data:await readVerifiedJson(data.region.roadSafety,'roadSafety',asset)};applyRoadSafety(study,roadSafetyCache.data,data.region.sha256,data.region.roadSafety.sha256);loadMs+=performance.now()-start;}
      if(data.roadMode==='partitioned'||data.region.roadSafety){decodedBytes=downloads.reduce((sum,x)=>sum+x.decodedBytes,0);if(downloads.length)loadMs=performance.now()-started;}
      const roadGzip=usePartition?partition.plan.selected.reduce((s,t)=>s+t.gzipBytes,0):(data.region.roadTransport?.gzipBytes||data.region.gzipBytes);
      const roadBrotli=usePartition?partition.selectedBrotli:(data.region.roadTransport?.brotliBytes||data.region.brotliBytes||0);
      const indexGzip=partition?(data.region.partitionRoads.gzipBytes||0):0,indexBrotli=partition?(data.region.partitionRoads.brotliBytes||0):0;
      progress('connection');const c=data.condition||condition(definitions,data.mood);progress('distance');const originalFacilities=study.facilities;
      const extras=(data.treasures||[]).map(t=>{const snap=packedSnap(study,t);if(!snap)return null;const e=snap.edge;const points=[];for(let j=study.geoOffsets[e];j<study.geoOffsets[e+1];j++)points.push([study.geoLat[j]/1e7,study.geoLon[j]/1e7]);const connection=assessConnection(study.connectionEvidence,snap,t,{elevated:study.elevatedEdges?.has(e)||Boolean(study.flags[e]&2),roadSupport:{policy:study.policy,points}});if(connection.type!=='mapped-walk-connection')return null;return {...t,type:'treasure',tags:{},snap,connection};}).filter(Boolean);study.facilities=[...originalFacilities,...extras];
      let result;try{result=(data.region.format==='packed-v1'?searchPacked:searchStudy)(study,data.point,data.km,[...c.clauses,{type:'treasure',predicates:[]}],false,Math.random,{mode});}finally{study.facilities=originalFacilities;}
      result.treasureInputCount=data.treasures?.length||0;result.treasureConnectedCount=extras.length;
      progress('result',{count:result.candidates?.length||0});postMessage({id:data.id,result:{...result,searchMode:mode,selectedMood:c.selected,loadMs,decodedBytes,gzipBytes:roadGzip+indexGzip+(data.region.roadSafety?.gzipBytes||0)+(data.region.facilitiesGzipBytes||0)+(evidenceDescriptor?.gzipBytes||0)+(blockDescriptor?.gzipBytes||0),brotliBytes:roadBrotli+indexBrotli+(data.region.roadSafety?.brotliBytes||0)+(data.region.facilitiesBrotliBytes||0)+(evidenceDescriptor?.brotliBytes||0)+(blockDescriptor?.brotliBytes||0),totalMs:performance.now()-started,roadLoading:usePartition?'partitioned':partition?'bulk-fallback':'bulk',roadTileCount:usePartition?partition.plan.selected.length:0,heldRoadEdgeCount:study.heldRoadEdges?.size||0,loadedEdgeCount:study.edgeFrom.length,sourceEdgeCount:partition?.index.edgeCount||study.edgeFrom.length,measurement:{stageTimes,downloads,roadDataReused,blockDataReused,networkReused:result.networkReused||false,coreTimes:result.timings||{}}}});
    }
    else throw Error('先に人工グラフを準備してください。');
  }catch(error){postMessage({id:data.id,error:error.message,stage});}
};
