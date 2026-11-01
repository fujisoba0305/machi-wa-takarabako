import {useEffect,useRef,useState} from 'react';
import {useCardSummaries,VerifiedCardMetrics} from './VerifiedCardMetrics';
import {loadPublicCardSummaries} from '../services/cardSummaries';
import {verifiedCardRequest,verifiedGrowthEnabled} from '../services/verifiedGrowth';
import {requestFreshSearchPosition} from '../services/startupLocation';
export function VerifiedTreasureCard({uid,id,arrived=false}:{uid:string;id:number;arrived?:boolean}){
 const metrics=useCardSummaries(uid,[id],{enabled:verifiedGrowthEnabled(),load:loadPublicCardSummaries}),row=metrics.rows.get(id);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[rating,setRating]=useState(5);
 const scope=uid+':'+id,scopeRef=useRef(scope),pending=useRef(false);scopeRef.current=scope;
 const attempt=useRef<{action:string;adventureId:string;challengeId:string;token:string;fix:unknown}|null>(null),ratingRequest=useRef<{id:string;rating:number}|null>(null),active=useRef(true),cancel=useRef<AbortController|null>(null);
 useEffect(()=>{active.current=true;pending.current=false;attempt.current=null;ratingRequest.current=null;setBusy(false);setMessage('');return()=>{active.current=false;cancel.current?.abort();};},[uid,id]);
 if(!verifiedGrowthEnabled())return null;
 async function visit(){if(pending.current)return;pending.current=true;setBusy(true);const c=new AbortController();cancel.current=c;try{
  let body=attempt.current;
  if(!body){const a=await verifiedCardRequest({action:'start',requestId:crypto.randomUUID(),treasureId:id},uid,c.signal);const p=await verifiedCardRequest({action:'prepare',adventureId:a.adventureId},uid,c.signal);const fix=await requestFreshSearchPosition({signal:c.signal});body={action:'confirm',adventureId:a.adventureId,challengeId:p.challengeId,token:p.token,fix};attempt.current=body;}
  await verifiedCardRequest(body,uid,c.signal);if(active.current&&scopeRef.current===scope){attempt.current=null;setMessage('確認済み訪問を保存しました。EXP・図鑑・育成の加算とは別です。');metrics.retry();}
 }catch{if(active.current&&scopeRef.current===scope)setMessage('訪問を確認できませんでした。通信結果が不明な場合は同じ内容で再確認できます。期限切れなら新しいGPSでやり直してください。');}finally{if(active.current&&scopeRef.current===scope){pending.current=false;setBusy(false);}}}
 return <section aria-label="確認済み宝物カード"><VerifiedCardMetrics enabled data={row}/><button type="button" disabled={busy||metrics.busy} onClick={metrics.retry}>カードを更新する</button>{arrived&&!row?.isOwn&&<><button type="button" disabled={busy} onClick={()=>void visit()}>カードの訪問をGPSで確認する</button><button type="button" disabled={busy} onClick={()=>{attempt.current=null;setMessage('次回は新しいGPSで確認します。');}}>新しいGPSでやり直す</button><label>確認済み訪問の評価<select value={rating} disabled={busy} onChange={e=>{setRating(Number(e.target.value));ratingRequest.current=null;}}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}点</option>)}</select></label><button type="button" disabled={busy} onClick={async()=>{if(pending.current)return;pending.current=true;setBusy(true);const c=new AbortController();cancel.current=c;const r=ratingRequest.current??{id:crypto.randomUUID(),rating};ratingRequest.current=r;try{await verifiedCardRequest({action:'rate',treasureId:id,requestId:r.id,rating:r.rating},uid,c.signal);if(active.current&&scopeRef.current===scope){setMessage('評価を保存しました。');metrics.retry();}}catch{if(active.current&&scopeRef.current===scope)setMessage('評価できませんでした。訪問未確認・自己評価・登録済み評価は保存されません。');}finally{if(active.current&&scopeRef.current===scope){pending.current=false;setBusy(false);}}}}>評価を保存する（1人1回）</button></>}{row?.isOwn&&<p>自分の投稿には評価できません。</p>}<p role="status">{message}</p></section>;
}
