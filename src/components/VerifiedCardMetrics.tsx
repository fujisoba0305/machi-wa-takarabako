import {useEffect,useState} from 'react';
import {cardSummaryUiEnabled,loadVerifiedCardSummaries,type CardSummaryConnection,type VerifiedCardSummary} from '../services/cardSummaries';

export function useCardSummaries(uid:string,ids:number[],connection?:CardSummaryConnection){
 const enabled=connection?.enabled??cardSummaryUiEnabled(),load=connection?.load??loadVerifiedCardSummaries;
 const key=[...new Set(ids)].sort((a,b)=>a-b).join(',');
 const [attempt,retry]=useState(0),[state,setState]=useState<{uid:string;key:string;rows:VerifiedCardSummary[];failed:boolean;busy:boolean}>({uid:'',key:'',rows:[],failed:false,busy:false});
 useEffect(()=>{
  if(!enabled)return;
  let active=true;const controller=new AbortController();
  setState({uid,key,rows:[],failed:false,busy:Boolean(key)});
  const run=async()=>{
   try{
    const targets=key?key.split(',').map(Number):[],rows:VerifiedCardSummary[]=[];
    for(let offset=0;offset<targets.length;offset+=100){rows.push(...await load(uid,targets.slice(offset,offset+100),controller.signal));if(!active)return;}
    if(active)setState({uid,key,rows,failed:false,busy:false});
   }catch{if(active)setState({uid,key,rows:[],failed:true,busy:false});}
  };
  void run();return()=>{active=false;controller.abort();};
 },[uid,key,enabled,load,attempt]);
 const current=enabled&&state.uid===uid&&state.key===key;
 return {enabled,rows:new Map((current?state.rows:[]).map(r=>[r.treasureId,r])),failed:current&&state.failed,busy:current&&state.busy,retry:()=>retry(n=>n+1)};
}

export function VerifiedCardMetrics({enabled,data}:{enabled:boolean;data?:VerifiedCardSummary}){
 if(!enabled)return null;
 if(!data)return <span className="verified-card-metrics">確認済み集計はまだありません</span>;
 const rankLabels={bronze:'ブロンズ',silver:'シルバー',gold:'ゴールド',legend:'レジェンド'};
 return <span className="verified-card-metrics" aria-label="確認済みの訪問と評価"><span style={{display:'block'}}>確認済み訪問：{data.visitorCount}人</span><span style={{display:'block'}}>{data.ratingCount===0?'評価：まだありません':`評価：${data.averageRating!.toFixed(1)} / 5（${data.ratingCount}件）`}</span>{data.nickname!==undefined&&<span style={{display:'block'}}>投稿者：{data.nickname||'公開名未設定'}</span>}{data.rank&&<span style={{display:'block'}}>ランク：{rankLabels[data.rank]}</span>}</span>;
}
