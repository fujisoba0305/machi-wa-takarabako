import {useEffect,useState} from 'react';
import {authorizeWalkingTrial} from '../services/walkingTrial';
import {getAccountClient} from '../services/accountAuth';
export function ApproximateSearchControls({enabled,onChange,locked}:{enabled:boolean;onChange:(value:boolean)=>void;locked:boolean}) {
 const [allowed,setAllowed]=useState(false);
 useEffect(()=>{let alive=true,generation=0;const controller=new AbortController();const check=async()=>{const n=++generation;try{const ok=await authorizeWalkingTrial(controller.signal);if(alive&&n===generation){setAllowed(ok);if(!ok)onChange(false);}}catch{if(alive&&n===generation){setAllowed(false);onChange(false);}}};void check();let stop=()=>{};try{const {data}=getAccountClient().auth.onAuthStateChange(()=>{setAllowed(false);onChange(false);void check();});stop=()=>data.subscription.unsubscribe();}catch{}return()=>{alive=false;controller.abort();stop();};},[]);
 if(!allowed)return null;
 return <section className="walking-trial-controls" aria-label="直線距離・試験版"><h2>直線距離・試験版</h2><label><input type="checkbox" checked={enabled} disabled={locked&&!enabled} onChange={e=>onChange(e.target.checked)}/>距離の目安で目的地を選ぶ（本人限定）</label><p>距離は直線距離の目安です。1・3・5・10kmが対象。初期OFFです。「？km」とデートは従来どおりです。</p><p>道路接続や徒歩経路は判定しません。実際の徒歩距離・所要時間はGoogleマップで確認してください。OFFで従来検索へ戻ります。</p><p>© OpenStreetMap contributors · <a href="https://www.openstreetmap.org/copyright">ODbL</a></p></section>;
}
