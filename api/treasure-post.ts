import type {VercelRequest,VercelResponse} from '@vercel/node';
import {createHash,randomBytes} from 'node:crypto';
import {canonicalPostingValue,validatePostingFix,PostingError,type PostingValue,type PostingFix} from '../src/features/onsitePosting';
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
const messages:Record<string,string>={POST_DISABLED:'現地限定投稿は準備中です。入力は残っています。',POST_AUTH:'Googleログインを確認して再試行してください。',POST_EXPIRED:'位置確認の期限が切れました。GPSを再取得してください。',POST_CONFLICT:'前の投稿の保存結果を確認してください。内容を変更せず再試行してください。',POST_INVALID:'投稿内容または写真の所有者を確認できません。入力は残っています。',POST_NETWORK:'保存結果を確認できません。同じ内容で再確認してください。'};
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','no-store');
 const fail=(status:number,code:string)=>res.status(status).json({code,message:messages[code]??'投稿を確認できません。GPSを再取得してください。'});
 if(req.method!=='POST')return fail(405,'POST_INVALID');
 if(process.env.ONSITE_POSTING_ENABLED!=='on')return fail(503,'POST_DISABLED');
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!secret)return fail(503,'POST_DISABLED');
 const authorization=/^Bearer ([A-Za-z0-9._-]+)$/.exec(String(req.headers.authorization||''));if(!authorization)return fail(401,'POST_AUTH');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const body=(typeof req.body==='string'?JSON.parse(req.body):req.body) as {action:string;requestId:string;mode:string;value:PostingValue;fix:PostingFix;token?:string};
  if(!body||JSON.stringify(body).length>16384||!['prepare','commit'].includes(body.action)||!['daily','adventure'].includes(body.mode)||!/^[-a-f0-9]{36}$/i.test(body.requestId))return fail(400,'POST_INVALID');
  const value=canonicalPostingValue(body.value);validatePostingFix(body.fix,value);
  const auth=await fetch(new URL('/auth/v1/user',url),{headers:{apikey:key,Authorization:'Bearer '+authorization[1]},signal:controller.signal});
  if(!auth.ok)return fail(auth.status===401||auth.status===403?401:503,auth.status===401||auth.status===403?'POST_AUTH':'POST_NETWORK');
  const user=await auth.json();if(!user.id||user.is_anonymous||!Array.isArray(user.identities)||!user.identities.some((i:{provider?:string})=>i.provider==='google'))return fail(401,'POST_AUTH');
  const token=body.action==='prepare'?randomBytes(32).toString('hex'):body.token;
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return fail(400,'POST_INVALID');
  const response=await fetch(new URL('/rest/v1/rpc/onsite_post_'+body.action,url),{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({p_uid:user.id,p_request:body.requestId,p_hash:digest(JSON.stringify(value)+':'+body.mode),p_token:digest(token),p_value:value,p_fix:body.fix,p_mode:body.mode}),signal:controller.signal});
  const result=await response.json();
  if(!response.ok){const code=response.status>=400&&response.status<500&&typeof result.message==='string'&&/^POST_(EXPIRED|CONFLICT|INVALID)$/.test(result.message)?result.message:'POST_NETWORK';if(code==='POST_INVALID'||code==='POST_EXPIRED')validatePostingFix(body.fix,value);return fail(code==='POST_NETWORK'?503:409,code);}
  if(result?.id)return res.status(200).json({id:result.id});
  if(body.action==='prepare')return res.status(200).json({token,expiresIn:60});
  return fail(503,'POST_NETWORK');
 }catch(e){if(e instanceof PostingError)return res.status(422).json({code:e.code,message:e.message});return fail(503,'POST_NETWORK');}
 finally{clearTimeout(timeout);}
}
