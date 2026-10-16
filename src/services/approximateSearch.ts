import { authorizeWalkingTrial } from './walkingTrial';
import { loadLocalStaticFacilities, resolveStaticCondition, resetStaticFacilityCache } from './staticFacilities';
import { calculateDistance } from '../features/distance';
import { getEligibleRegisteredTreasures, selectNormalSearchCandidate } from '../features/normalTreasureCandidates';
import type { Treasure } from './treasures';
function waitForStatic<T>(task:Promise<T>,signal:AbortSignal):Promise<T> {
 return new Promise((resolve,reject)=>{
 let done=false;
 const finish=(value:T|undefined,error?:Error)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);if(error)reject(error);else resolve(value as T);};
 const abort=()=>finish(undefined,Error('検索を中止しました。条件を保って再試行できます。'));
 const timer=setTimeout(()=>finish(undefined,Error('静的施設データの読み込みに時間がかかっています。条件を保って再試行してください。')),20000);
 signal.addEventListener('abort',abort,{once:true});task.then(v=>finish(v),()=>finish(undefined,Error('静的施設データを読み込めませんでした。条件を保って再試行してください。')));if(signal.aborted)abort();
 });
}
export const approximateRanges: Record<string,{min:number;max:number}> = {'1km':{min:0,max:2},'3km':{min:2,max:4},'5km':{min:4,max:6},'10km':{min:9,max:11}};
export function matchesApproximateScope(c:{distance:string;mood:string}) { return Object.prototype.hasOwnProperty.call(approximateRanges,c.distance)&&c.mood!=='デート'; }
export async function searchApproximate(point:{latitude:number;longitude:number}, choices:{distance:string;mood:string;foodGenre?:string;eventGenre?:string;shrineGenre?:string},treasures:Treasure[]|(()=>Promise<Treasure[]|null>),signal:AbortSignal,random=Math.random) {
 const started=performance.now();
 const times={authorization:null as number|null,facilities:null as number|null,treasures:null as number|null,selection:null as number|null,finalAuthorization:null as number|null};let stage='本人確認';
 const report=()=>['直線距離・試験版（座標・住所・氏名なし）','処理段階：'+stage,...Object.entries(times).map(([k,v])=>({authorization:'本人確認',facilities:'施設データ読込・条件検索',treasures:'登録宝物取得',selection:'距離判定・抽選',finalAuthorization:'結果の本人確認'}[k]+': '+(v===null?'未完了・未実行':v.toFixed(1)+'ms'))),'検索合計：'+(performance.now()-started).toFixed(1)+'ms','道路データ取得・徒歩距離API呼び出し：なし'].join('\n');
 const timed=async<T>(key:keyof typeof times,task:()=>Promise<T>)=>{const at=performance.now();try{return await task();}finally{times[key]=performance.now()-at;}};
 try {
 const check=()=>{if(signal.aborted)throw Error('検索を中止しました。条件を保って再試行できます。');};check();
 if(!matchesApproximateScope(choices))throw Error('この条件は直線距離試験版の対象外です。');
 if(!Number.isFinite(point.latitude)||Math.abs(point.latitude)>90||!Number.isFinite(point.longitude)||Math.abs(point.longitude)>180)throw Error('現在地を確認してください。');
 if(!await timed('authorization',()=>authorizeWalkingTrial(signal)))throw Error('本人限定試験版の権限を確認できません。');check();
 const range=approximateRanges[choices.distance],conditionRandom=choices.mood==='おまかせ'?random():0,condition=resolveStaticCondition(choices,()=>conditionRandom);
 stage='施設・登録宝物の並行取得';
 const [rows,treasureRows]=await Promise.all([
 timed('facilities',()=>waitForStatic(loadLocalStaticFacilities(point,{...choices,distance:'？km'},range.max*1000,()=>conditionRandom),signal).catch(error=>{resetStaticFacilityCache();throw error;})),
 timed('treasures',()=>typeof treasures==='function'?treasures():Promise.resolve(treasures))
 ]);check();
 if(treasureRows===null)throw Error('登録宝物を読み込めませんでした。条件を保って再試行してください。');
 if(rows===null)throw Error('この地域は静的施設検索の対象外です。試験版をOFFにして従来検索へ戻せます。');
 stage='距離判定・抽選';const selectionStarted=performance.now();
 const general=rows.flatMap(spot=>{const lat=spot.lat??spot.center?.lat,lon=spot.lon??spot.center?.lon;if(!Number.isFinite(lat)||!Number.isFinite(lon))return [];const distanceKm=calculateDistance(point.latitude,point.longitude,lat!,lon!);return distanceKm>=range.min&&distanceKm<=range.max?[{spot,distanceKm}]:[];});
 const registered=getEligibleRegisteredTreasures(treasureRows,point,choices.mood,range,choices.foodGenre).filter(c=>Math.abs(c.treasure.latitude)<=90&&Math.abs(c.treasure.longitude)<=180);
 times.selection=performance.now()-selectionStarted;stage='結果の本人確認';
 if(!await timed('finalAuthorization',()=>authorizeWalkingTrial(signal)))throw Error('本人限定試験版の権限が変更されました。');check();
 const selected=selectNormalSearchCandidate(general,registered,random);
 if(!selected)throw Error('この直線距離・ジャンル条件に合う候補がありませんでした。条件は変更していません。');
 return {spot:selected.source==='overpass'?selected.candidate.spot:null,treasure:selected.source==='treasure'?selected.treasure:null,distanceKm:selected.source==='treasure'?selected.distanceKm:selected.candidate.distanceKm,report:[report(),'距離条件：'+choices.distance,'検索カテゴリ：'+condition.mood,'一般施設候補：'+general.length+'件','登録宝物候補：'+registered.length+'件','抽選元：'+(selected.source==='treasure'?'登録宝物':'OSM施設'),'実際の徒歩距離・所要時間はGoogleマップで確認してください。'].join('\n')};
 }catch(error){if(error instanceof Error)throw Object.assign(error,{report:report()});throw Object.assign(Error('検索を完了できませんでした。条件を保って再試行してください。'),{report:report()});}
}
