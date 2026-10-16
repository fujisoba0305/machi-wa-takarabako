const messages = {
 permission: '位置情報が許可されていません。Safariのサイト設定とiPhoneの「設定 → プライバシーとセキュリティ → 位置情報サービス」を確認して、再取得してください。',
 unavailable: '現在地を確認できませんでした。通信状態を確認し、位置情報を取得できる場所で再取得してください。',
 timeout: '現在地の取得に時間がかかりました。古い位置は使っていません。少し待って再取得してください。',
 'no-callback': '現在地の取得に時間がかかりました。ブラウザから結果が届かないため待機を終了しました。再取得してください。',
 stale: '新しい現在地を確認できませんでした。取得日時が30秒より古いため使っていません。再取得してください。',
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
 constructor(readonly reason: FailureReason, elapsedMs: number, info: {providerCode?:number;ageMs?:number;accuracy?:number;clockShiftMs?:number} = {}) {
  super(messages[reason]); this.name='StartupLocationFailure';
  const number=(v:unknown,scale=1)=>typeof v==='number'&&Number.isFinite(v)?(v/scale).toFixed(1):'未取得';
  this.report=['現在地取得の診断（座標・住所・氏名・アカウント情報なし）','処理：冒険開始・検索用の現在地取得','停止理由：'+reason,'ブラウザのエラー番号：'+(info.providerCode??'なし（ブラウザの成功応答またはアプリ側停止）'),'経過：'+number(elapsedMs,1000)+'秒','位置の取得日時と現在時刻の差：'+number(info.ageMs,1000)+'秒（正は過去、負は未来）','取得された精度：'+number(info.accuracy)+'m','取得中の端末時計の変化：'+number(info.clockShiftMs,1000)+'秒','設定：高精度ON／キャッシュ許容0ms／取得期限10秒／無応答監視12秒','判定：この結果を現在地として使用していません。'].join('\n');
 }
}
export function locationFailureMessage(error: unknown): string {
 if(error instanceof StartupLocationFailure)return error.message;
 const code=error&&typeof error==='object'&&'code'in error?error.code:undefined;
 if(code===1)return messages.permission;if(code===2)return messages.unavailable;if(code===3)return messages.timeout;
 return error instanceof Error?error.message:'現在地を取得できませんでした。位置情報の設定を確認して、再取得してください。';
}
/** Fresh search fixes stay in memory. Arrival checks use their unchanged, separate implementation. */
export function requestFreshSearchPosition(options: {signal?:AbortSignal} = {}): Promise<{latitude:number;longitude:number;accuracy:number;timestamp:number}> {
 return new Promise((resolve,reject)=>{
  const started=performance.now(),wallStart=Date.now();let settled=false,timer:ReturnType<typeof setTimeout>|undefined;
  const finish=(fn:()=>void)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);fn();};
  const fail=(reason:FailureReason,info:ConstructorParameters<typeof StartupLocationFailure>[2]={})=>finish(()=>reject(new StartupLocationFailure(reason,performance.now()-started,info)));
  const abort=()=>fail('cancelled');
  if(options.signal?.aborted){abort();return;}
  if(!navigator.geolocation){fail('unsupported');return;}
  options.signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>fail('no-callback'),12000);
  try{navigator.geolocation.getCurrentPosition(position=>{
   if(settled)return;
   const latitude=position?.coords?.latitude,longitude=position?.coords?.longitude,accuracy=position?.coords?.accuracy,timestamp=position?.timestamp;
   const now=Date.now(),ageMs=now-timestamp,clockShiftMs=(now-wallStart)-(performance.now()-started),info={ageMs,accuracy,clockShiftMs};
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){fail('invalid-position',info);return;}
   if(!Number.isFinite(accuracy)||accuracy<0){fail('invalid-accuracy',info);return;}
   if(!Number.isFinite(timestamp)||timestamp<=0){fail('invalid-time',info);return;}
   if(Math.abs(clockShiftMs)>5000 && (ageMs>30000 || ageMs < -5000)){fail('clock-changed',info);return;}
   if(ageMs>30000){fail('stale',info);return;}
   if(ageMs < -5000){fail('future',info);return;}
   finish(()=>resolve({latitude,longitude,accuracy,timestamp}));
  },error=>{const code=error?.code;fail(code===1?'permission':code===2?'unavailable':code===3?'timeout':'exception',{providerCode:[1,2,3].includes(code)?code:undefined});},{enableHighAccuracy:true,maximumAge:0,timeout:10000});}
  catch{fail('exception');}
 });
}
