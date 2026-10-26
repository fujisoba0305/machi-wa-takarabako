import {getAccountClient} from './accountAuth';
import {PostingError,canonicalPostingValue,validatePostingFix,type PostingValue,type PostingFix,type PostingMode} from '../features/onsitePosting';
export type PostingContext={uid:string;mode:PostingMode;requestId:string;fix:PostingFix};
async function tokenFor(uid:string){
 const {data,error}=await getAccountClient().auth.getSession();const s=data.session;
 if(error||!s||s.user.is_anonymous||s.user.id!==uid||(s.expires_at&&s.expires_at*1000<=Date.now()))throw new PostingError('POST_AUTH','ログインが変わりました。入力を保持したままGoogleログインを確認してください。');
 return s.access_token;
}
async function call(body:unknown,uid:string,uncertain=false){
 const token=await tokenFor(uid);const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const r=await fetch('/api/treasure-post',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:controller.signal});
  let data:{code?:string;message?:string;token?:string;id?:number};try{data=await r.json();}catch{throw new PostingError('POST_NETWORK','保存結果を確認できません。同じ内容で再確認してください。',uncertain);}
  if(!r.ok)throw new PostingError(data.code??'POST_NETWORK',data.message??'投稿を確認できません。入力は残っています。',uncertain&&r.status>=500&&data.code!=='POST_DISABLED');
  try{await tokenFor(uid);}catch{throw new PostingError('POST_AUTH','アカウントが変わりました。元のアカウントで保存結果を再確認してください。',uncertain);}return data;
 }catch(e){if(e instanceof PostingError)throw e;throw new PostingError('POST_NETWORK','通信結果を確認できません。入力は残っています。同じ内容で再確認してください。',uncertain);}
 finally{clearTimeout(timeout);}
}
/** Never INSERT directly from the browser. Same requestId + same body is idempotent. */
export const pendingPostingKey=(uid:string)=>'machiPendingOnsitePost.v1:'+uid;
export type PendingPosting={requestId:string;mode:PostingMode;value:PostingValue};
export function readPendingPosting(uid:string):PendingPosting|null{
 try{const raw=localStorage.getItem(pendingPostingKey(uid));if(!raw)return null;const p=JSON.parse(raw);if(!/^[-a-f0-9]{36}$/i.test(p.requestId)||!['daily','adventure'].includes(p.mode))throw Error();canonicalPostingValue(p.value);return p;}catch{throw new PostingError('POST_STORAGE','前回の投稿控えを読み取れません。上書きせず停止しました。');}
}
export async function saveOnsiteTreasure(value:PostingValue,context:PostingContext){
 const v=canonicalPostingValue(value);validatePostingFix(context.fix,v);
 await tokenFor(context.uid);
 const pending=readPendingPosting(context.uid);const next={requestId:context.requestId,mode:context.mode,value:v};
 if(pending&&JSON.stringify(pending)!==JSON.stringify(next))throw new PostingError('POST_CONFLICT','前回の投稿結果を先に再確認してください。',true);
 try{const raw=JSON.stringify(next);localStorage.setItem(pendingPostingKey(context.uid),raw);if(localStorage.getItem(pendingPostingKey(context.uid))!==raw)throw Error();}catch{throw new PostingError('POST_STORAGE','二重登録防止の控えを保存できません。ブラウザーの保存設定を確認してください。');}
 const body={value:v,fix:context.fix,mode:context.mode,requestId:context.requestId};
 try{
 // A previous response may have been lost after commit. This creates no new registration.
 const ready=await call({action:'prepare',...body},context.uid,true);
 if(ready.id){localStorage.removeItem(pendingPostingKey(context.uid));return;}
 if(!ready.token)throw new PostingError('POST_NETWORK','投稿確認情報を受け取れませんでした。',true);
 validatePostingFix(context.fix,v);
 await call({action:'commit',...body,token:ready.token},context.uid,true);
 localStorage.removeItem(pendingPostingKey(context.uid));
 }catch(e){if(pending&&e instanceof PostingError)throw new PostingError(e.code,e.message,true);if(e instanceof PostingError&&!e.uncertain){try{localStorage.removeItem(pendingPostingKey(context.uid));}catch{/* Keep a conservative recovery record if removal fails. */}}throw e;}
}
export async function postingAccount(){const {data,error}=await getAccountClient().auth.getSession();const s=data.session;if(error||!s||s.user.is_anonymous)throw new PostingError('POST_AUTH','Googleログインしてから投稿してください。');await tokenFor(s.user.id);return s.user.id;}
