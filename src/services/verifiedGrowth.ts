import {getAccountClient} from './accountAuth';
import {cardGrowthEnabled} from './cardGrowthFlag';
export const verifiedGrowthEnabled=cardGrowthEnabled;
export async function verifiedCardRequest(body:Record<string,unknown>,expectedUid?:string,signal?:AbortSignal):Promise<any>{
 if(!verifiedGrowthEnabled())throw Error('カード育成は準備中です。');
 const session=async()=>{const {data,error}=await getAccountClient().auth.getSession(),s=data.session;if(error||!s||s.user.is_anonymous||!s.user.identities?.some(i=>i.provider==='google')||(expectedUid&&s.user.id!==expectedUid)||(s.expires_at&&s.expires_at*1000<=Date.now()))throw Error('Googleログインを確認してください。');return s;};
 const before=await session(),controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,10000);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 try{const r=await fetch('/api/treasure-card',{method:'POST',headers:{Authorization:'Bearer '+before.access_token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store',redirect:'error'});const after=await session();if(after.user.id!==before.user.id||controller.signal.aborted)throw Error('アカウントが変更されました。');if(!r.ok)throw Error('カード確認を完了できませんでした。同じ内容で再試行できます。');return await r.json();}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function readPublicCardProfile(uid?:string,signal?:AbortSignal){const d=await verifiedCardRequest({action:'profile'},uid,signal);if(typeof d.nickname!=='string'||d.nickname.length>32||!Array.isArray(d.ownedIds)||d.ownedIds.length>10000||d.ownedIds.some((id:unknown)=>!Number.isSafeInteger(id)||Number(id)<=0))throw Error('本人の投稿情報を確認できません。');return d as {nickname:string;ownedIds:number[]};}
export async function excludeOwnRegisteredTreasures<T extends {id?:number}>(rows:T[]){if(!verifiedGrowthEnabled())return rows;const profile=await readPublicCardProfile();const own=new Set(profile.ownedIds);return rows.filter(t=>t.id===undefined||!own.has(t.id));}
