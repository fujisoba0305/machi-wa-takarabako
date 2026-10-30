import type {VercelRequest,VercelResponse} from '@vercel/node';
// Read-only: ownership comes from the private committed posting receipt, not photos or a caller UID.
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');
 const fail=(status:number)=>res.status(status).json({message:status===401?'Googleログインを確認してください。':'投稿を読み込めませんでした。再試行してください。'});
 if(req.method!=='GET')return fail(405);
 const cursor=req.query?.before;
 if(Object.keys(req.query||{}).some(k=>k!=='before')||(cursor!==undefined&&(typeof cursor!=='string'||!/^\d{1,15}$/.test(cursor)||Number(cursor)<=0)))return fail(400);
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!secret)return fail(503);
 const authorization=/^Bearer ([A-Za-z0-9._-]+)$/.exec(String(req.headers.authorization||''));if(!authorization)return fail(401);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const auth=await fetch(new URL('/auth/v1/user',url),{headers:{apikey:key,Authorization:'Bearer '+authorization[1]},signal:controller.signal});
  if(!auth.ok)return fail(auth.status===401||auth.status===403?401:503);
  const user=await auth.json();
  if(typeof user.id!=='string'||!/^[-a-f0-9]{36}$/i.test(user.id)||user.is_anonymous||!Array.isArray(user.identities)||!user.identities.some((i:{provider?:string})=>i.provider==='google'))return fail(401);
  const endpoint=new URL('/rest/v1/onsite_post_requests',url);
  endpoint.searchParams.set('select','treasure_id,treasure:treasures!inner(id,name,comment,category,image_url,additional_image_url,created_at)');
  endpoint.searchParams.set('uid','eq.'+user.id);
  endpoint.searchParams.set('treasure_id',cursor?'lt.'+cursor:'not.is.null');
  endpoint.searchParams.set('order','treasure_id.desc');endpoint.searchParams.set('limit','21');
  const response=await fetch(endpoint,{headers:{apikey:secret,Authorization:'Bearer '+secret},signal:controller.signal});if(!response.ok)return fail(503);
  const rows=await response.json();if(!Array.isArray(rows)||rows.length>21)return fail(503);
  const seen=new Set<number>(),items:Record<string,unknown>[]=[];
  for(const row of rows){const t=row?.treasure;if(!Number.isSafeInteger(row?.treasure_id)||row.treasure_id<=0||!t||t.id!==row.treasure_id||typeof t.name!=='string'||typeof t.category!=='string')return fail(503);if(seen.has(t.id))continue;seen.add(t.id);items.push({id:t.id,name:t.name,comment:typeof t.comment==='string'?t.comment:'',category:t.category,image_url:typeof t.image_url==='string'?t.image_url:null,additional_image_url:typeof t.additional_image_url==='string'?t.additional_image_url:null,created_at:typeof t.created_at==='string'?t.created_at:null});}
  const page=items.slice(0,20);return res.status(200).json({items:page,next:items.length>20?String(page[page.length-1].id):null});
 }catch{return fail(503);}finally{clearTimeout(timeout);}
}
