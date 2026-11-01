import {CARD_GROWTH_PRODUCTION_RELEASE_READY} from '../src/features/cardGrowthRelease.js';
// Server-only entrypoint. Default OFF; never uses browser-prefixed secrets.
import type {VercelRequest,VercelResponse} from '@vercel/node';
import {createCardHandler} from '../server/cardGrowth/cardHandler.js';
export default async function handler(req:VercelRequest,res:VercelResponse){
 if(!CARD_GROWTH_PRODUCTION_RELEASE_READY||process.env.CARD_GROWTH_ENABLED!=='on'){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(503).send(JSON.stringify({code:'CARD_DISABLED',message:'カード育成の訪問・評価は準備中です。'}));
 }

 const handle=createCardHandler({enabled:process.env.CARD_GROWTH_ENABLED==='on',supabaseUrl:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY,serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,appOrigin:process.env.CARD_APP_ORIGIN});
 const headers=new Headers();for(const name of ['origin','content-type','authorization']){const value=req.headers[name];if(typeof value==='string')headers.set(name,value);}
 const method=req.method??'GET';
 const request=new Request('https://card-api.invalid/api/treasure-card',{method,headers,...(['GET','HEAD'].includes(method)?{}:{body:typeof req.body==='string'?req.body:JSON.stringify(req.body??null)})});
 const response=await handle(request);response.headers.forEach((v,k)=>res.setHeader(k,v));res.status(response.status).send(await response.text());
}
