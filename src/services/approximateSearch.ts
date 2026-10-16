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
export async function searchApproximate(point:{latitude:number;longitude:number}, choices:{distance:string;mood:string;foodGenre?:string;eventGenre?:string;shrineGenre?:string},treasures:Treasure[],signal:AbortSignal,random=Math.random) {
 const started=performance.now();
 const check=()=>{if(signal.aborted)throw Error('検索を中止しました。条件を保って再試行できます。');};check();
 if(!matchesApproximateScope(choices))throw Error('この条件は直線距離試験版の対象外です。');
 if(!Number.isFinite(point.latitude)||Math.abs(point.latitude)>90||!Number.isFinite(point.longitude)||Math.abs(point.longitude)>180)throw Error('現在地を確認してください。');
 if(!await authorizeWalkingTrial(signal))throw Error('本人限定試験版の権限を確認できません。');check();
 const range=approximateRanges[choices.distance],conditionRandom=choices.mood==='おまかせ'?random():0,condition=resolveStaticCondition(choices,()=>conditionRandom);
 const rows=await waitForStatic(loadLocalStaticFacilities(point,{...choices,distance:'？km'},range.max*1000,()=>conditionRandom),signal).catch(error=>{resetStaticFacilityCache();throw error;});check();
 if(rows===null)throw Error('この地域は静的施設検索の対象外です。試験版をOFFにして従来検索へ戻せます。');
 const general=rows.flatMap(spot=>{const lat=spot.lat??spot.center?.lat,lon=spot.lon??spot.center?.lon;if(!Number.isFinite(lat)||!Number.isFinite(lon))return [];const distanceKm=calculateDistance(point.latitude,point.longitude,lat!,lon!);return distanceKm>=range.min&&distanceKm<=range.max?[{spot,distanceKm}]:[];});
 const registered=getEligibleRegisteredTreasures(treasures,point,choices.mood,range,choices.foodGenre).filter(c=>Math.abs(c.treasure.latitude)<=90&&Math.abs(c.treasure.longitude)<=180);
 if(!await authorizeWalkingTrial(signal))throw Error('本人限定試験版の権限が変更されました。');check();
 const selected=selectNormalSearchCandidate(general,registered,random);
 if(!selected)throw Error('この直線距離・ジャンル条件に合う候補がありませんでした。条件は変更していません。');
 return {spot:selected.source==='overpass'?selected.candidate.spot:null,treasure:selected.source==='treasure'?selected.treasure:null,distanceKm:selected.source==='treasure'?selected.distanceKm:selected.candidate.distanceKm,report:['直線距離・試験版（座標・住所・氏名なし）','距離条件：'+choices.distance,'検索カテゴリ：'+condition.mood,'一般施設候補：'+general.length+'件','登録宝物候補：'+registered.length+'件','抽選元：'+(selected.source==='treasure'?'登録宝物':'OSM施設'),'検索合計：'+(performance.now()-started).toFixed(1)+'ms','道路データ取得・徒歩距離API呼び出し：なし','実際の徒歩距離・所要時間はGoogleマップで確認してください。'].join('\n')};
}
