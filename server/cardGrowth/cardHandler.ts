import {createHash,randomBytes,randomUUID} from 'node:crypto';

export type CardOptions={enabled?:boolean;supabaseUrl?:string;publishableKey?:string;serviceKey?:string;appOrigin?:string;timeoutMs?:number;fetcher?:typeof fetch;allowLoopbackTest?:boolean};
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const id=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const validDate=(s:unknown):s is string=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const messages:Record<string,string>={CARD_DISABLED:'カード育成の訪問・評価は準備中です。',CARD_AUTH:'Googleログインを確認してください。',CARD_INVALID:'送信内容を確認してください。',CARD_FIX_EXPIRED_OR_INVALID:'新しいGPSを取得して再確認してください。',CARD_TOO_FAR:'対象の100m以内で再確認してください。',CARD_UNCERTAIN:'保存結果を確認できません。同じ送信内容で再試行してください。',CARD_NETWORK:'通信を確認して再試行してください。',CARD_VISIT_REQUIRED:'確認済みの訪問が必要です。',CARD_INELIGIBLE:'この宝物は現在、確認済み集計の対象外です。',CARD_ADVENTURE_INVALID:'冒険対象を再登録してください。',CARD_TARGET_CHANGED:'目的地の情報が変更されています。',CARD_INVALID_PROOF:'到着確認情報を確認できません。',CARD_REPLAY_CONFLICT:'同じ確認情報の内容を変更できません。',CARD_RATING_CONFLICT:'この宝物の評価は登録済みか、送信内容が変更されています。',CARD_RATE_LIMIT:'少し待ってから再試行してください。'};
class ApiError extends Error{status:number;code:string;constructor(status:number,code:string){super(code);this.status=status;this.code=code;}}
const error=(status:number,code:string):never=>{throw new ApiError(status,code);};

/** Server only. No caller UID or arbitrary RPC name/URL is accepted. */
export function createCardHandler(options:CardOptions={}){
 return async(request:Request):Promise<Response>=>{
  const respond=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'}});
  const fail=(status:number,code:string)=>respond(status,{code,message:messages[code]??messages.CARD_NETWORK});
  if(options.enabled!==true)return fail(503,'CARD_DISABLED');
  if(request.method!=='POST')return fail(405,'CARD_INVALID');
  let backend:URL;
  try{
   backend=new URL(options.supabaseUrl??'');
   const local=options.allowLoopbackTest===true&&backend.protocol==='http:'&&backend.hostname==='127.0.0.1';
   if((backend.protocol!=='https:'&&!local)||backend.username||backend.password||backend.pathname!=='/'||backend.search||backend.hash||!options.publishableKey||!options.serviceKey||!options.appOrigin||new URL(options.appOrigin).origin!==options.appOrigin)throw Error();
  }catch{return fail(503,'CARD_DISABLED');}
  if(request.headers.get('Origin')!==options.appOrigin||request.headers.get('Content-Type')?.split(';')[0]!=='application/json')return fail(403,'CARD_INVALID');
  const bearer=/^Bearer ([A-Za-z0-9._-]{1,4096})$/.exec(request.headers.get('Authorization')??'');
  if(!bearer)return fail(401,'CARD_AUTH');
  const controller=new AbortController();let writing=false;
  const abort=()=>controller.abort();
  request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
  const timer=setTimeout(abort,options.timeoutMs??8000);
  const fetcher=options.fetcher??fetch;
  try{
   const reader=request.body?.getReader();let text='',size=0;
   if(!reader)throw new ApiError(400,'CARD_INVALID');
   const decoder=new TextDecoder();
   const cancelBody=()=>{void reader.cancel().catch(()=>{});};
   controller.signal.addEventListener('abort',cancelBody,{once:true});
   if(controller.signal.aborted)cancelBody();
   try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>8192){await reader.cancel();error(413,'CARD_INVALID');}text+=decoder.decode(chunk.value,{stream:true});if(controller.signal.aborted)throw Error();}}
   finally{controller.signal.removeEventListener('abort',cancelBody);}
   if(controller.signal.aborted)throw Error();
   text+=decoder.decode();let body:unknown;try{body=JSON.parse(text);}catch{error(400,'CARD_INVALID');}
   if(!object(body)||typeof body.action!=='string')error(400,'CARD_INVALID');
   const value=body as Record<string,unknown>;
   let rpc='',args:Record<string,unknown>={};
   if(value.action==='start'&&exact(value,['action','requestId','treasureId'])&&uuid(value.requestId)&&id(value.treasureId)){
    rpc='card_v2_start';args={p_request:value.requestId,p_id:randomUUID(),p_treasure:value.treasureId};
   }else if(value.action==='prepare'&&exact(value,['action','adventureId'])&&uuid(value.adventureId)){
    rpc='card_v2_prepare';args={p_adventure:value.adventureId,p_challenge:randomUUID(),p_token_hash:''};
   }else if(value.action==='confirm'&&exact(value,['action','adventureId','challengeId','token','fix'])&&uuid(value.adventureId)&&uuid(value.challengeId)&&typeof value.token==='string'&&/^[a-f0-9]{64}$/.test(value.token)&&object(value.fix)&&exact(value.fix,['latitude','longitude','accuracy','timestamp'])){
    const f=value.fix;
    if(![f.latitude,f.longitude,f.accuracy,f.timestamp].every(x=>typeof x==='number'&&Number.isFinite(x))||Number(f.timestamp)<=0||Math.abs(Number(f.latitude))>90||Math.abs(Number(f.longitude))>180||Number(f.accuracy)<0)error(400,'CARD_INVALID');
    let measured:string;try{measured=new Date(Number(f.timestamp)).toISOString();}catch{error(400,'CARD_INVALID');}
    const canonical={adventureId:value.adventureId,challengeId:value.challengeId,token:value.token,latitude:f.latitude,longitude:f.longitude,accuracy:f.accuracy,timestamp:f.timestamp};
    rpc='card_v2_confirm';args={p_adventure:value.adventureId,p_challenge:value.challengeId,p_token_hash:digest(value.token),p_payload_hash:digest(JSON.stringify(canonical)),p_lat:f.latitude,p_lon:f.longitude,p_accuracy:f.accuracy,p_measured:measured!};
   }else if(value.action==='rate'&&exact(value,['action','treasureId','requestId','rating'])&&id(value.treasureId)&&uuid(value.requestId)&&Number.isInteger(value.rating)&&Number(value.rating)>=1&&Number(value.rating)<=5){
    rpc='card_v1_rate';args={p_treasure:value.treasureId,p_request:value.requestId,p_rating:value.rating};
   }else if((value.action==='summary'||value.action==='metadata')&&exact(value,['action','treasureIds'])&&Array.isArray(value.treasureIds)&&value.treasureIds.length<=100&&value.treasureIds.every(id)){
    rpc='card_v3_summary';args={p_treasures:[...new Set(value.treasureIds)],p_own_only:value.action==='summary'};
   }else if(value.action==='profile'&&exact(value,['action'])){rpc='card_v3_profile';args={p_nickname:null};}else if(value.action==='nickname'&&exact(value,['action','nickname'])&&typeof value.nickname==='string'&&value.nickname.trim().length<=32&&!/[\x00-\x1f\x7f<>]/.test(value.nickname)){rpc='card_v3_profile';args={p_nickname:value.nickname.trim()};}else error(400,'CARD_INVALID');
   // Authoritative user identity is read from Auth, not decoded or body-supplied.
   const auth=await fetcher(new URL('/auth/v1/user',backend),{headers:{apikey:options.publishableKey!,Authorization:'Bearer '+bearer[1]},signal:controller.signal,redirect:'error'});
   if(!auth.ok)error(auth.status===401||auth.status===403?401:503,auth.status===401||auth.status===403?'CARD_AUTH':'CARD_NETWORK');
   const user:unknown=await auth.json();
   if(!object(user)||!uuid(user.id)||user.is_anonymous!==false||!Array.isArray(user.identities)||!user.identities.some(i=>object(i)&&i.provider==='google'))error(401,'CARD_AUTH');
   args.p_uid=(user as Record<string,unknown>).id;
   let rawToken:string|undefined;
   if(value.action==='prepare'){rawToken=randomBytes(32).toString('hex');args.p_token_hash=digest(rawToken);}
   if(controller.signal.aborted)throw Error();
   writing=!['summary','metadata','profile'].includes(String(value.action));
   const response=await fetcher(new URL('/rest/v1/rpc/'+rpc,backend),{method:'POST',headers:{apikey:options.serviceKey!,Authorization:'Bearer '+options.serviceKey!,'Content-Type':'application/json'},body:JSON.stringify(args),signal:controller.signal,redirect:'error'});
   const data:unknown=await response.json();
   if(!response.ok){
    const code=object(data)&&typeof data.message==='string'&&Object.hasOwn(messages,data.message)?data.message:object(data)&&['55P03','57014'].includes(String(data.code))?'CARD_UNCERTAIN':'CARD_NETWORK';
    error(code==='CARD_NETWORK'||code==='CARD_UNCERTAIN'?503:code==='CARD_RATE_LIMIT'?429:code.endsWith('CONFLICT')?409:403,code);
   }
   if(value.action==='profile'||value.action==='nickname'){
    if(!object(data)||typeof data.nickname!=='string'||data.nickname.length>32||!Array.isArray(data.ownedIds)||data.ownedIds.length>10000||!data.ownedIds.every(id))throw Error();
    return respond(200,{nickname:data.nickname,ownedIds:data.ownedIds});
   }
   if(value.action==='prepare'){
    if(!validDate(data))throw Error();
    return respond(200,{challengeId:args.p_challenge,token:rawToken,expiresAt:data});
   }
   if(value.action==='start'){
    if(!object(data)||!uuid(data.adventureId)||data.treasureId!==value.treasureId||!validDate(data.expiresAt))throw Error();
    return respond(200,{adventureId:data.adventureId,treasureId:data.treasureId,expiresAt:data.expiresAt});
   }
   if(value.action==='confirm'){
    if(!object(data)||!id(data.treasureId)||!validDate(data.verifiedAt)||typeof data.replayed!=='boolean')throw Error();
    return respond(200,{treasureId:data.treasureId,verifiedAt:data.verifiedAt,replayed:data.replayed});
   }
   if(value.action==='rate'){
    if(!object(data)||data.treasureId!==value.treasureId||data.rating!==value.rating||!validDate(data.createdAt))throw Error();
    return respond(200,{treasureId:data.treasureId,rating:data.rating,createdAt:data.createdAt});
   }
   if(!Array.isArray(data)||data.length>100)throw Error();
   const requested=new Set(args.p_treasures as number[]),seen=new Set<number>();
   const summaries=data.map(row=>{
    if(!object(row))throw Error();const treasureId=Number(row.treasure_id),visitors=Number(row.visitor_count),ratings=Number(row.rating_count),sum=Number(row.rating_sum),average=row.average_rating===null?null:Number(row.average_rating);
    if(!id(treasureId)||!requested.has(treasureId)||seen.has(treasureId)||![visitors,ratings,sum].every(x=>Number.isSafeInteger(x)&&x>=0)||ratings>visitors||(ratings===0?(average!==null||sum!==0):(average===null||!Number.isFinite(average)||average<1||average>5||sum<ratings||sum>5*ratings)))throw Error();seen.add(treasureId);
    if(!['bronze','silver','gold'].includes(String(row.rank))||(row.nickname!==null&&(typeof row.nickname!=='string'||row.nickname.length>32))||typeof row.is_own!=='boolean')throw Error();return {treasureId,visitorCount:visitors,ratingCount:ratings,ratingSum:sum,averageRating:average,rank:row.rank,nickname:row.nickname??'',isOwn:row.is_own};
   });
   return respond(200,{summaries});
  }catch(e){return e instanceof ApiError?fail(e.status,e.code):fail(503,writing?'CARD_UNCERTAIN':'CARD_NETWORK');}
  finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);}
 };
}
