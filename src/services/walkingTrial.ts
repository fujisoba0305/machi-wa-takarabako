import staticManifest from '../data/staticFacilityManifest.json';
import { getAccountClient } from './accountAuth';
import { resolveStaticCondition, isInsideStaticRegion } from './staticFacilities';
import { getEligibleRegisteredTreasures, selectNormalSearchCandidate } from '../features/normalTreasureCandidates';
import type { Spot } from './overpass';
import type { Treasure } from './treasures';
export type TrialDistance = { roadMeters: number; estimated: true; origin: string; quality: string };
export type TrialResult = { spot: Spot | null; treasure: Treasure | null; distance: TrialDistance; report: string };
let permittedDistances=[1];
export async function authorizeWalkingTrial(signal?: AbortSignal) {
  const { data, error } = await getAccountClient().auth.getSession();
  if (error || !data.session?.access_token) return false;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch('/api/walking-trial-access', { headers: { Authorization: 'Bearer ' + data.session.access_token }, cache: 'no-store', signal: controller.signal });
    const config=await response.json();const allowed=response.ok&&config.allowed===true;permittedDistances=allowed&&Array.isArray(config.distances)&&config.distances.includes(3)?[1,3]:[1];return allowed;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
type Point = { latitude: number; longitude: number };
type Choice = { distance: string; mood: string; foodGenre?: string; eventGenre?: string; shrineGenre?: string };
type Candidate = { id: string; lat: number; lon: number; name: string; distanceMeters: number; evaluatedDistanceMeters?: number; approachEstimateMeters?: number|null; quality: string };
type WorkerResult = { extraMs?:number; bodyBytes?:number; generalPicked?:Candidate|null;treasurePicked?:Candidate|null;generalCount?:number;treasureCount?:number;counts?:{osmMapped:number;blockEstimate:number};bytes?:Record<string,number>;timings?:{totalMs:number};status: string; candidates: Candidate[]; connectionCounts?: Record<string,number>; originConnection?: {type: string}; loadMs: number; totalMs: number; searchMs: number; decodedBytes: number; brotliBytes: number; measurement?: {downloads: unknown[]}; treasureInputCount?: number; treasureConnectedCount?: number };
let firstWorkerLoadMs:number|null=null,idle:ReturnType<typeof setTimeout>|undefined,lastCondition='',conditionChanges=0;
let worker: Worker | null = null, pendingCancel: (() => void) | null = null, sequence = 0, manifest: Promise<{regions: {bounds:number[]}[];coverage:Parameters<typeof isInsideStaticRegion>[1]}> | null = null;
let operation:AbortController|null=null;
export function cancelWalkingTrial() { operation?.abort();pendingCancel?.(); }
function releaseWorker(){clearTimeout(idle);lastCondition='';conditionChanges=0;worker?.terminate();worker=null;firstWorkerLoadMs=null;}
export function disposeWalkingTrial(){cancelWalkingTrial();releaseWorker();}
async function loadManifest(signal?: AbortSignal): Promise<{regions: {bounds:number[]}[];coverage:Parameters<typeof isInsideStaticRegion>[1]}> {
  if(!manifest){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();manifest=fetch('/walking-v30/manifest.json', { signal:controller.signal }).then(async response => { if (!response.ok) throw Error(); const data = await response.json(); if(data.version!==30||data.poiCount!==56701)throw Error();const coverageResponse=await fetch(staticManifest.region.url,{signal:controller.signal,integrity:'sha256-'+btoa(staticManifest.region.sha256.match(/../g)!.map(h=>String.fromCharCode(parseInt(h,16))).join(''))});if(!coverageResponse.ok)throw Error();const coverage=await coverageResponse.json();if(!Array.isArray(coverage.features)||!coverage.features.length)throw Error();return {regions:[{bounds:[138,34,141,37]}],coverage}; }).catch(() => {manifest=null;throw Error('徒歩検索データ一覧を読み込めませんでした。再試行してください。');}).finally(()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);});}return manifest;
}
export function matchesTrialScope(choices: Choice) { return permittedDistances.includes(Number(choices.distance.replace('km',''))) && choices.mood !== 'デート'; }
export async function searchWalkingTrial(point: Point, choices: Choice, treasures: Treasure[], signal: AbortSignal, progress: (message:string)=>void = () => {}): Promise<TrialResult | null> {
 if(operation)throw Error('検索中です。完了または中止してから再試行してください。');const controller=new AbortController(),abort=()=>controller.abort();operation=controller;signal.addEventListener('abort',abort,{once:true});if(signal.aborted)controller.abort();const timer=setTimeout(()=>controller.abort(),90000);let stop:()=>void=()=>{};const interrupted=new Promise<never>((_,reject)=>{stop=()=>reject(Error('検索を中止しました。待機上限またはSafariの画面切替を含みます。条件を保って再試行できます。'));controller.signal.addEventListener('abort',stop,{once:true});if(controller.signal.aborted)stop();});try{return await Promise.race([executeTrial(point,choices,treasures,controller.signal,progress),interrupted]);}finally{clearTimeout(timer);controller.signal.removeEventListener('abort',stop);signal.removeEventListener('abort',abort);if(operation===controller)operation=null;}
}
async function executeTrial(point:Point,choices:Choice,treasures:Treasure[],signal:AbortSignal,progress:(message:string)=>void):Promise<TrialResult|null>{
  if (!matchesTrialScope(choices)) throw Error('この条件は徒歩検索試験版の対象外です。');
  if (!await authorizeWalkingTrial(signal)) throw Error('試験版の権限を確認できません。通常検索へ切り替えるか、ログイン状態を確認してください。');
  if(!matchesTrialScope(choices))throw Error('この距離は試験版では無効です。従来検索をお使いください。');
  if (signal.aborted) throw Error('検索を中止しました。');
  if (typeof DecompressionStream === 'undefined' || typeof Worker === 'undefined') throw Error('このSafariでは徒歩データを展開できません。Safariを更新するか通常検索をお使いください。');
  const data = await loadManifest(signal), region = data.regions.find(r => point.longitude>=r.bounds[0]&&point.longitude<=r.bounds[2]&&point.latitude>=r.bounds[1]&&point.latitude<=r.bounds[3]);
  if (!region || !isInsideStaticRegion(point,data.coverage)) throw Error('この地域の徒歩道路データは未準備です。通常検索へ切り替えてください。');
  const condition=resolveStaticCondition(choices),km=Number(choices.distance.replace('km',''));
  const registered=getEligibleRegisteredTreasures(treasures,point,choices.mood,{min:0,max:km+1},choices.foodGenre).filter(c=>Number.isSafeInteger(c.treasure.id)&&Number(c.treasure.id)>0);
  if(pendingCancel)throw Error('検索中です。完了または中止してから再試行してください。');
  clearTimeout(idle);const cacheCondition=JSON.stringify([choices.distance,choices.mood,choices.foodGenre,choices.eventGenre,choices.shrineGenre]);if(lastCondition&&lastCondition!==cacheCondition)conditionChanges++;if(conditionChanges>=3){releaseWorker();}lastCondition=cacheCondition;
  const result=await new Promise<WorkerResult>((resolve,reject)=>{
    const owned=worker??=new Worker('/walking-v30/runtime/worker.mjs',{type:'module'}),id=++sequence;
    let finished=false,timer:ReturnType<typeof setTimeout>,currentStage='worker';const workerStarted=performance.now();
    const hard=setTimeout(()=>fail('初回データ読込を含む待機上限に達しました。再試行できます。'),90000);
    const clean=()=>{clearTimeout(timer);clearTimeout(hard);signal.removeEventListener('abort',abort);pendingCancel=null;};
    const fail=(message:string)=>{if(finished)return;finished=true;clean();owned.terminate();if(worker===owned){worker=null;firstWorkerLoadMs=null;}reject(Object.assign(Error(message),{name:'WalkingTrialFailure',report:['徒歩検索・試験版（座標・施設名なし）','結果：中断・失敗','段階：'+safeStage(currentStage),'経過：'+((performance.now()-workerStarted)/1000).toFixed(3)+'秒','案内：'+message].join('\n')}));};
    const abort=()=>fail('検索を中止しました。');pendingCancel=abort;signal.addEventListener('abort',abort,{once:true});
    const refresh=(stage:string)=>{currentStage=stage;clearTimeout(timer);timer=setTimeout(()=>fail('徒歩データの読込・計算がタイムアウトしました。再試行できます。'),['road','roadTile','roadIndex','blocks','facilities','tile','roadSafety','conditions','index','manifest','evidence'].includes(stage)?90000:30000);};refresh('worker');
    owned.onerror=()=>fail('徒歩検索の計算処理を維持できませんでした。再試行できます。');
    owned.onmessage=({data})=>{if(finished||data.id!==id)return;if(data.progress){refresh(data.progress.stage);progress('徒歩検索・試験版：'+safeStage(data.progress.stage)+'中…');return;}if(data.error)return fail(data.error==='coverage-incomplete'?'この距離に必要な道路データが不足するため未対応です。条件は変更していません。':data.error==='resource-budget-exceeded'?'必要データが試験用の上限を超えました。試験版をOFFにして従来検索へ戻せます。':'徒歩検索の'+safeStage(data.stage)+'で失敗しました。条件を保って再試行してください。');finished=true;clean();idle=setTimeout(()=>disposeWalkingTrial(),30000);resolve(data.result);};
    try{owned.postMessage({id,choices:{...choices,mood:condition.mood},type:'study',point:{lat:point.latitude,lon:point.longitude},region,km,mood:condition.mood,condition:{selected:condition.mood,clauses:condition.clauses},roadMode:'partitioned',searchMode:'block',treasures:registered.map(c=>({id:'treasure:'+c.treasure.id,name:c.treasure.name,lat:c.treasure.latitude,lon:c.treasure.longitude}))});if(signal.aborted)abort();}catch{fail('徒歩検索を起動できませんでした。再試行してください。');}
  });
  if(signal.aborted)throw Error('検索を中止しました。');
  if(!await authorizeWalkingTrial(signal)||!matchesTrialScope(choices))throw Error('試験版の権限が変更されました。通常検索へ切り替えてください。');
  result.candidates??=[result.generalPicked,result.treasurePicked].filter((c):c is Candidate=>Boolean(c));
  if(!['ok','estimated-candidates','no-candidates'].includes(result.status))throw Error(result.status==='origin-unconnected'?'現在地付近の利用可能道路に接続できません。':result.status==='origin-blocked'?'現在地と道路の間に障害物があり、安全な接続を確認できません。': '選択距離に必要な道路データの範囲が不足しています。条件は変更していません。');
  if(firstWorkerLoadMs===null)firstWorkerLoadMs=result.loadMs;
  const general=result.candidates.filter(c=>!c.id.startsWith('treasure:'));
  const eligible=result.candidates.filter(c=>c.id.startsWith('treasure:')).flatMap(c=>{const t=registered.find(t=>'treasure:'+t.treasure.id===c.id);return t?[{...t,distanceKm:c.distanceMeters/1000}]:[];});
  const selected=selectNormalSearchCandidate(general,eligible);if(!selected)throw Object.assign(Error('この徒歩距離・カテゴリ条件に合う候補がありませんでした。条件は変更していません。'),{name:'WalkingTrialEmpty',report:['徒歩検索・試験版（座標・施設名なし）','結果：候補0件（条件は変更していません）','距離条件：'+choices.distance,'カテゴリ：'+choices.mood,'今回の準備：'+(result.loadMs/1000).toFixed(3)+'秒','Worker合計：'+(result.totalMs/1000).toFixed(3)+'秒','今回の圧縮区画データ量：'+(Object.values(result.bytes||{}).reduce((a,b)=>a+b,0)/1e6).toFixed(3)+'MB（索引・プログラムは別）','起点接続：'+(result.originConnection?.type||'unknown')].join('\n')});
  const picked=selected.source==='treasure'?result.candidates.find(c=>c.id==='treasure:'+selected.treasure.id)!:selected.candidate;
  const evaluated=picked.evaluatedDistanceMeters??picked.distanceMeters;
  if(!Number.isFinite(picked.distanceMeters)||!Number.isFinite(evaluated)||evaluated<Math.max(0,km-1)*1000||evaluated>(km+1)*1000)throw Error('距離条件を確認できませんでした。');
  const parts=/^([nwr])\/(\d+)$/.exec(picked.id);
  if(selected.source==='overpass'&&!parts)throw Error('施設識別子を確認できませんでした。');
  const type=parts?({n:'node',w:'way',r:'relation'}[parts[1]]||'node'):'node',id=parts?.[2]||'0';
  const report=['徒歩検索・試験版（座標・施設名なし）','距離条件：'+choices.distance,'カテゴリ：'+choices.mood,'このWorkerの初回準備：'+(firstWorkerLoadMs===null?'未測定':(firstWorkerLoadMs/1000).toFixed(3)+'秒'),'今回の準備：'+(result.loadMs/1000).toFixed(3)+'秒','Worker合計：'+(result.totalMs/1000).toFixed(3)+'秒','検索処理：'+result.searchMs.toFixed(1)+'ms','登録宝物の接続確認：'+(result.extraMs||0).toFixed(1)+'ms','今回の読込本文量（キャッシュ含む）：'+((result.bodyBytes??Object.values(result.bytes||{}).reduce((a,b)=>a+b,0))/1e6).toFixed(3)+'MB','候補：'+((result.generalCount??general.length)+(result.treasureCount??eligible.length))+'件','施設側のOSM接続根拠あり：'+(result.counts?.osmMapped??['osm-node','osm-entrance','mapped-walk-connection'].reduce((n,k)=>n+(result.connectionCounts?.[k]||0),0))+'件（現地未確認）','街区推定：'+(result.counts?.blockEstimate??result.connectionCounts?.['block-estimate']??0)+'件','起点接続：'+(result.originConnection?.type||'unknown'),'起点接続がunknownの場合、現在地からの総徒歩距離も未確認です。','選択候補：'+(picked.quality==='block-estimate'?'街区外周までの推定':'OSM接続根拠による推定・現地未確認'),'推定徒歩距離（道路網部分）：'+Math.round(picked.distanceMeters)+'m','道路から施設の接続推定：'+(picked.approachEstimateMeters==null?'未確認・加算なし':Math.round(picked.approachEstimateMeters)+'m（道路距離とは別）'),'登録宝物の道路接続根拠あり：'+(result.treasureConnectedCount||0)+' / '+(result.treasureInputCount||0)+'件','道路から施設への到達、実際の徒歩距離との一致は未確認です。'].join('\n');
  return {spot:selected.source==='overpass'?{type,id:Number(id),lat:picked.lat,lon:picked.lon,tags:{name:picked.name}}:null,treasure:selected.source==='treasure'?selected.treasure:null,distance:{roadMeters:picked.distanceMeters,estimated:true,origin:result.originConnection?.type||'unknown',quality:picked.quality},report};
}
function safeStage(stage:string){return ({manifest:'データ版確認',index:'一覧読込',evidence:'道路接続根拠の確認',search:'経路計算',treasures:'登録宝物の徒歩接続確認',worker:'起動',road:'道路読込',roadTile:'道路区画読込',facilities:'施設読込',blocks:'街区読込',distance:'距離計算',tile:'接続根拠読込',roadSafety:'通行制限確認'} as Record<string,string>)[stage]||'データ確認';}
export function withWalkingTrialDeadline<T>(task: Promise<T>, signal: AbortSignal, timeoutMs = 15000): Promise<T> {
 return new Promise((resolve,reject)=>{let done=false;const finish=(value:T|undefined,error?:Error)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);if(error)reject(error);else resolve(value as T);};const abort=()=>finish(undefined,Error('検索を中止しました。'));const timer=setTimeout(()=>finish(undefined,Error('登録宝物の読み込みがタイムアウトしました。再試行できます。')),timeoutMs);signal.addEventListener('abort',abort,{once:true});task.then(value=>finish(value),()=>finish(undefined,Error('登録宝物を読み込めませんでした。再試行できます。')));if(signal.aborted)abort();});
}

// A backgrounded iPhone tab must not retain an unbounded in-flight calculation.
if(typeof window!=='undefined'){window.addEventListener('pagehide',()=>disposeWalkingTrial());window.addEventListener('pageshow',event=>{if(event.persisted)disposeWalkingTrial();});}
