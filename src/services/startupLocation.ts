const messages = {
 permission: '位置情報が許可されていません。Safariのサイト設定とiPhoneの「設定 → プライバシーとセキュリティ → 位置情報サービス」を確認して、再取得してください。',
 unavailable: '現在地を確認できませんでした。通信状態を確認し、位置情報を取得できる場所で再取得してください。',
 timeout: '現在地の取得に時間がかかりました。古い位置は使っていません。少し待って再取得してください。',
 'no-callback': '現在地の取得に時間がかかりました。ブラウザから結果が届かないため待機を終了しました。再取得してください。',
 stale: '新しい現在地を確認できませんでした。古い位置情報は使わず停止しました。少し待って再取得してください。',
 future: '新しい現在地を確認できませんでした。取得日時が端末の現在時刻より先のため使っていません。再取得してください。',
 'invalid-time': '新しい現在地を確認できませんでした。取得日時を確認できないため使っていません。再取得してください。',
 'invalid-position': '新しい現在地を確認できませんでした。位置データの形式を確認できないため使っていません。再取得してください。',
 'invalid-accuracy': '新しい現在地を確認できませんでした。位置の精度情報を確認できないため使っていません。再取得してください。',
 'clock-changed': '新しい現在地を確認できませんでした。取得中に端末時刻が変化したため使っていません。再取得してください。',
 unsupported: 'このブラウザでは位置情報を利用できません。HTTPSで開いているか確認してください。',
 cancelled: '現在地の取得を中止しました。以前の位置は使っていません。',
 exception: '現在地の取得を開始できませんでした。ブラウザと位置情報の設定を確認して再取得してください。',
} as const;
type FailureReason = keyof typeof messages;
export class StartupLocationFailure extends Error {
 readonly report: string;
 constructor(readonly reason: FailureReason, elapsedMs: number, info: {providerCode?:number;ageMs?:number;accuracy?:number;clockShiftMs?:number;staleCount?:number;freshWaitMs?:number} = {}) {
  super(messages[reason]); this.name='StartupLocationFailure';
  const number=(v:unknown,scale=1)=>typeof v==='number'&&Number.isFinite(v)?(v/scale).toFixed(1):'未取得';
  this.report=['現在地取得の診断（座標・住所・氏名・アカウント情報なし）','処理：冒険開始・検索用の現在地取得','停止理由：'+reason,'ブラウザのエラー番号：'+(info.providerCode??'なし（ブラウザの成功応答またはアプリ側停止）'),'経過：'+number(elapsedMs,1000)+'秒','位置の取得日時と現在時刻の差：'+number(info.ageMs,1000)+'秒（正は過去、負は未来）','取得された精度：'+number(info.accuracy)+'m','取得中の端末時計の変化：'+number(info.clockShiftMs,1000)+'秒','設定：高精度ON／キャッシュ許容0ms／取得期限10秒／無応答監視12秒','古い測位の破棄回数：'+(info.staleCount??0),'新しい測位の待機：'+number(info.freshWaitMs??0,1000)+'秒（最大6秒・全体最大12秒）','判定：この結果を現在地として使用していません。'].join('\n');
 }
}
export function locationFailureMessage(error: unknown): string {
 if(error instanceof StartupLocationFailure)return error.message;
 const code=error&&typeof error==='object'&&'code'in error?error.code:undefined;
 if(code===1)return messages.permission;if(code===2)return messages.unavailable;if(code===3)return messages.timeout;
 return error instanceof Error?error.message:'現在地を取得できませんでした。位置情報の設定を確認して、再取得してください。';
}
type FreshFix = {latitude:number;longitude:number;accuracy:number;timestamp:number};
type Timing = {totalMs:number;firstResponseMs:number;freshWaitMs:number;staleCount:number};
const timings = new WeakMap<object, Timing>();
export function freshPositionTiming(fix:object){return timings.get(fix);}
export function freshPositionReport(fix:object){const t=timings.get(fix);return t?['GPS測位合計：'+t.totalMs.toFixed(1)+'ms','GPS最初の応答：'+t.firstResponseMs.toFixed(1)+'ms','新しいGPS待機：'+t.freshWaitMs.toFixed(1)+'ms','古い測位の破棄回数：'+t.staleCount,'GPS取得方式：getCurrentPosition'+(t.staleCount?' → 短時間watchPosition':'')].join('\n'):'GPS単独測定：未計測';}
/** One-shot normally; only stale replies trigger a bounded fresh-fix watch. Never used for arrival checks. */
export function requestFreshSearchPosition(options: {signal?:AbortSignal;onProgress?:()=>void} = {}): Promise<FreshFix> {
 return new Promise((resolve,reject)=>{
  const started=performance.now(),wallStart=Date.now();
  let settled=false,responded=false,waiting=false,staleCount=0,firstResponseMs=0,watchStarted=0;
  let timer:ReturnType<typeof setTimeout>|undefined,watchTimer:ReturnType<typeof setTimeout>|undefined,watchId:number|undefined;
  let firstStale:ConstructorParameters<typeof StartupLocationFailure>[2]={};
  const clearWatch=()=>{if(watchId!==undefined){try{navigator.geolocation.clearWatch(watchId);}catch{}watchId=undefined;}};
  const finish=(fn:()=>void)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(watchTimer);clearWatch();options.signal?.removeEventListener('abort',abort);fn();};
  const fail=(reason:FailureReason,info:ConstructorParameters<typeof StartupLocationFailure>[2]={})=>finish(()=>reject(new StartupLocationFailure(reason,performance.now()-started,{...info,staleCount,freshWaitMs:waiting?performance.now()-watchStarted:0})));
  const abort=()=>fail('cancelled');
  const onError=(error:GeolocationPositionError)=>{const code=error?.code;fail(code===1?'permission':code===2?'unavailable':code===3?'timeout':'exception',{providerCode:[1,2,3].includes(code)?code:undefined});};
  const receive=(position:GeolocationPosition,source:'initial'|'watch')=>{
   if(settled || (source==='initial'&&responded))return;
   if(source==='initial'){responded=true;firstResponseMs=performance.now()-started;}
   const latitude=position?.coords?.latitude,longitude=position?.coords?.longitude,accuracy=position?.coords?.accuracy,timestamp=position?.timestamp;
   const now=Date.now(),ageMs=now-timestamp,clockShiftMs=(now-wallStart)-(performance.now()-started),info={ageMs,accuracy,clockShiftMs};
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){fail('invalid-position',info);return;}
   if(!Number.isFinite(accuracy)||accuracy<0){fail('invalid-accuracy',info);return;}
   if(!Number.isFinite(timestamp)||timestamp<=0){fail('invalid-time',info);return;}
   if(Math.abs(clockShiftMs)>5000 && (ageMs>30000 || ageMs < -5000)){fail('clock-changed',info);return;}
   if(ageMs < -5000){fail('future',info);return;}
   if(ageMs>30000 || (source==='watch'&&timestamp<wallStart)){
    staleCount++;
    if(source==='watch')return;
    firstStale=info;
    if(typeof navigator.geolocation.watchPosition!=='function'||typeof navigator.geolocation.clearWatch!=='function'){fail('stale',info);return;}
    waiting=true;watchStarted=performance.now();
    try{options.onProgress?.();}catch{/* UI reporting never changes GPS validation. */}
    if(settled)return;
    watchTimer=setTimeout(()=>fail('stale',firstStale),Math.max(0,Math.min(6000,12000-(performance.now()-started))));
    try{watchId=navigator.geolocation.watchPosition(p=>receive(p,'watch'),onError,{enableHighAccuracy:true,maximumAge:0,timeout:6000});if(settled)clearWatch();}catch{fail('exception');}
    return;
   }
   const fix={latitude,longitude,accuracy,timestamp};
   timings.set(fix,{totalMs:performance.now()-started,firstResponseMs,freshWaitMs:waiting?performance.now()-watchStarted:0,staleCount});
   finish(()=>resolve(fix));
  };
  if(options.signal?.aborted){abort();return;}
  if(!navigator.geolocation){fail('unsupported');return;}
  options.signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>fail(waiting?'stale':'no-callback',waiting?firstStale:{}),12000);
  try{navigator.geolocation.getCurrentPosition(p=>receive(p,'initial'),error=>{if(!responded)onError(error);},{enableHighAccuracy:true,maximumAge:0,timeout:10000});}
  catch{fail('exception');}
 });
}
