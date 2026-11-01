import {cardGrowthEnabled} from './cardGrowthFlag';
import {getAccountClient} from './accountAuth';

export type VerifiedCardSummary={treasureId:number;visitorCount:number;ratingCount:number;ratingSum:number;averageRating:number|null;rank?:'bronze'|'silver'|'gold'|'legend';nickname?:string;isOwn?:boolean};
export type CardSummaryLoader=(uid:string,ids:number[],signal?:AbortSignal)=>Promise<VerifiedCardSummary[]>;
export type CardSummaryConnection={enabled?:boolean;load?:CardSummaryLoader};
export function cardSummaryUiEnabled(){return cardGrowthEnabled();}

const loader=(action:'summary'|'metadata'):CardSummaryLoader=>async(uid,ids,signal)=>{
 if(!cardSummaryUiEnabled())return [];
 if(ids.length>100||ids.some(n=>!Number.isSafeInteger(n)||n<=0))throw Error('集計対象を確認できません。');
 if(!ids.length)return [];
 const session=async()=>{
  const {data,error}=await getAccountClient().auth.getSession(),s=data.session;
  if(error||!s||s.user.id!==uid||s.user.is_anonymous||!s.user.identities?.some(i=>i.provider==='google')||(s.expires_at&&s.expires_at*1000<=Date.now()))throw Error('Googleログインを確認してください。');
  return s.access_token;
 };
 const token=await session(),controller=new AbortController(),cancel=()=>controller.abort(),timer=setTimeout(cancel,10000);
 signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 try{
  if(controller.signal.aborted)throw Error('集計を中止しました。');
  const response=await fetch('/api/treasure-card',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,treasureIds:[...new Set(ids)]}),signal:controller.signal,cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error('確認済み集計を取得できませんでした。');
  const data=await response.json();await session();
  if(controller.signal.aborted||!Array.isArray(data.summaries)||data.summaries.length>100)throw Error('集計を確認できません。');
  const requested=new Set(ids),seen=new Set<number>();
  return data.summaries.map((row:VerifiedCardSummary)=>{
   if(!row||!Number.isSafeInteger(row.treasureId)||!requested.has(row.treasureId)||seen.has(row.treasureId)||![row.visitorCount,row.ratingCount,row.ratingSum].every(n=>Number.isSafeInteger(n)&&n>=0)||row.ratingCount>row.visitorCount||(row.ratingCount===0?(row.averageRating!==null||row.ratingSum!==0):(typeof row.averageRating!=='number'||!Number.isFinite(row.averageRating)||row.averageRating<1||row.averageRating>5||row.ratingSum<row.ratingCount||row.ratingSum>5*row.ratingCount||Math.abs(row.averageRating-row.ratingSum/row.ratingCount)>1e-6))||(row.rank!==undefined&&!['bronze','silver','gold','legend'].includes(row.rank)))throw Error('集計を確認できません。');
   if(row.nickname!==undefined&&(typeof row.nickname!=='string'||row.nickname.length>32))throw Error('公開名を確認できません。');if(row.isOwn!==undefined&&typeof row.isOwn!=='boolean')throw Error('所有者判定を確認できません。');seen.add(row.treasureId);
   return {treasureId:row.treasureId,visitorCount:row.visitorCount,ratingCount:row.ratingCount,ratingSum:row.ratingSum,averageRating:row.averageRating,...(row.rank?{rank:row.rank}:{}),...(row.nickname!==undefined?{nickname:row.nickname}:{}),...(row.isOwn!==undefined?{isOwn:row.isOwn}:{})};
  });
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
};

export const loadVerifiedCardSummaries=loader('summary');
export const loadPublicCardSummaries=loader('metadata');
