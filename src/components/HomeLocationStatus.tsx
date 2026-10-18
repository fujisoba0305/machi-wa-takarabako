import {LocationDiagnostic} from './LocationDiagnostic';
export type HomeLocationState='idle'|'checking'|'confirmed'|'prompt'|'denied'|'unavailable'|'error';
export function HomeLocationStatus({state,busy,message,diagnostic,onRetry}:{state:HomeLocationState;busy:boolean;message:string;diagnostic:string;onRetry:()=>void}){
 const status=busy?'現在地を確認しています…':({idle:'現在地の利用を準備しています',checking:'位置情報の許可を確認しています…',confirmed:'現在地を確認しました',prompt:'初回はボタンを押して、位置情報を許可してください',denied:'位置情報が許可されていません',unavailable:'このブラウザでは許可状態を確認できません。ボタンから現在地を取得してください',error:'現在地を確認できませんでした'})[state];
 return <section className="home-location-status" aria-label="現在地の確認"><p role="status">{status}</p>{state==='denied'&&<p>Safariのサイト設定とiPhoneの位置情報設定を確認後、再試行してください。</p>}{message&&<p>{message}</p>}<button type="button" disabled={busy} onClick={onRetry}>{busy?'取得中…':state==='confirmed'?'現在地を再取得する':state==='prompt'?'位置情報を許可して取得する':'現在地を取得・再試行する'}</button><small>ガチャ検索時は最新のGPSを自動で確認します。取得できない場合は以前の位置で検索しません。</small>{diagnostic&&<LocationDiagnostic report={diagnostic}/>}</section>;
}
