import {requestFreshSearchPosition,StartupLocationFailure} from './startupLocation';
import {MAX_ACCURACY_METERS,type PositionFix} from '../features/activeAdventure';
/** Departure only: never supplies a previous fix to arrival checks. */
export async function requestDeparturePosition(options:{signal?:AbortSignal}={}):Promise<PositionFix>{
 const first=await requestFreshSearchPosition(options);if(first.accuracy<=MAX_ACCURACY_METERS)return first;
 if(!navigator.geolocation.watchPosition)throw Error('出発地点のGPS精度が不足しています。目的地は保持しています。もう一度お試しください。');
 return new Promise((resolve,reject)=>{
 let done=false,watch:number|undefined;const at=performance.now();
 const finish=(fix?:PositionFix,error?:Error)=>{if(done)return;done=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);if(watch!==undefined)navigator.geolocation.clearWatch(watch);if(fix)resolve(fix);else reject(error);};
 const abort=()=>finish(undefined,new StartupLocationFailure('cancelled',performance.now()-at));
 const timer=setTimeout(()=>finish(undefined,Object.assign(Error('出発地点のGPS精度が50m以内になりませんでした。目的地を保持したまま再試行できます。'),{report:'出発GPS診断（座標・住所・氏名なし）\n停止段階：精度改善待機\n基準：精度50m以内・新しい取得日時\n結果：精度を緩めず停止'})),10000);
 options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted){abort();return;}
 try{watch=navigator.geolocation.watchPosition(position=>{const p=position.coords,t=position.timestamp;const age=Date.now()-t;if(!p||![p.latitude,p.longitude,p.accuracy,t].every(Number.isFinite)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||p.accuracy<0||t<=0||age>30000||age < -5000||p.accuracy>MAX_ACCURACY_METERS)return;finish({latitude:p.latitude,longitude:p.longitude,accuracy:p.accuracy,timestamp:t});},error=>finish(undefined,new StartupLocationFailure(error.code===1?'permission':error.code===2?'unavailable':error.code===3?'timeout':'exception',performance.now()-at,{providerCode:[1,2,3].includes(error.code)?error.code:undefined})),{enableHighAccuracy:true,maximumAge:0,timeout:10000});if(done&&watch!==undefined)navigator.geolocation.clearWatch(watch);}catch{finish(undefined,Error('出発地点の現在地確認を開始できませんでした。目的地は保持しています。'));}
 });
}
