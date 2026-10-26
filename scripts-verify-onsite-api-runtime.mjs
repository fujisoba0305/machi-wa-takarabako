import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';

// Run plain Node against the official Vercel builder's files, never a TS/Vite loader.
if(process.argv[2]==='--run-output'){
 const {default:handler}=await import(pathToFileURL(process.argv[3]).href);
 const nativeFetch=globalThis.fetch;let rpcCalls=[],authUser={id:'fixture-user',identities:[{provider:'google'}]},rpcFailure=null;
 process.env.ONSITE_POSTING_ENABLED='on';process.env.SUPABASE_URL='https://posting-runtime.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='fixture-public';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-server';
 globalThis.fetch=async(input,options)=>{const url=new URL(input);assert.equal(url.origin,'https://posting-runtime.invalid','Unexpected external network attempt');if(url.pathname==='/auth/v1/user')return Response.json(authUser);assert.match(url.pathname,/^\/rest\/v1\/rpc\/onsite_post_(prepare|commit)$/);assert.equal(options.headers.apikey,'fixture-server');const body=JSON.parse(options.body);rpcCalls.push(body);assert.equal(body.p_uid,'fixture-user');if(rpcFailure)return Response.json({message:rpcFailure.code},{status:rpcFailure.status});return Response.json(url.pathname.endsWith('prepare')?{}:{id:42});};
 const server=createServer(async(req,res)=>{try{let raw='';for await(const b of req)raw+=b;req.body=raw?JSON.parse(raw):{};res.status=function(code){this.statusCode=code;return this;};res.json=function(body){this.setHeader('Content-Type','application/json');this.end(JSON.stringify(body));return this;};await handler(req,res);}catch{res.statusCode=500;res.end('{}');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let checks=0;
 const value={name:'Runtime fixture',comment:'',category:'🍜 グルメ',latitude:35,longitude:139,image_url:null};
 const payload=extra=>({action:'prepare',requestId:'f6fed846-a013-4a60-993e-ce16696625ce',mode:'daily',uid:'untrusted-user',value,fix:{latitude:35,longitude:139,accuracy:5,timestamp:Date.now()},...extra});
 const request=async(body,auth=true,method='POST')=>{const r=await nativeFetch('http://127.0.0.1:'+server.address().port+'/api/treasure-post',{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer fixture-token'}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
 const check=(result,status,code)=>{assert.equal(result.status,status);if(code)assert.equal(result.body.code,code);checks++;};
 try{
  check(await request({},false,'GET'),405,'POST_INVALID');
  process.env.ONSITE_POSTING_ENABLED='off';check(await request(payload()),503,'POST_DISABLED');process.env.ONSITE_POSTING_ENABLED='on';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;check(await request(payload()),503,'POST_DISABLED');process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-server';
  check(await request(payload(),false),401,'POST_AUTH');
  check(await request(payload({fix:{latitude:35,longitude:139,accuracy:5,timestamp:Date.now()-31500}})),422,'POST_STALE');
  check(await request(payload({fix:{latitude:35,longitude:139,accuracy:51,timestamp:Date.now()}})),422,'POST_ACCURACY');
  check(await request(payload({fix:{latitude:36,longitude:139,accuracy:5,timestamp:Date.now()}})),422,'POST_DISTANCE');assert.equal(rpcCalls.length,0);
  authUser={id:'fixture-user',identities:[{provider:'email'}]};check(await request(payload()),401,'POST_AUTH');authUser={id:'fixture-user',identities:[{provider:'google'}]};
  const ready=await request(payload());check(ready,200);assert.match(ready.body.token,/^[a-f0-9]{64}$/);assert.notEqual(rpcCalls.at(-1).p_token,ready.body.token);assert.equal(ready.body.expiresIn,60);assert.doesNotMatch(JSON.stringify(ready.body),/fixture-user|latitude|longitude|fixture-server/);
  check(await request(payload({action:'commit',token:ready.body.token})),200);assert.equal(rpcCalls.at(-1).p_uid,'fixture-user');
  const repeated=await request(payload({action:'commit',token:ready.body.token}));check(repeated,200);assert.equal(repeated.body.id,42);
  rpcFailure={code:'POST_EXPIRED',status:400};check(await request(payload({action:'commit',token:ready.body.token})),409,'POST_EXPIRED');
  rpcFailure={code:'unknown gateway',status:503};check(await request(payload({action:'commit',token:ready.body.token})),503,'POST_NETWORK');
  console.log(JSON.stringify({plainNode:true,httpChecks:checks,externalNetworkCalls:0}));
 }finally{await new Promise(resolve=>server.close(resolve));}
}else{
 const repo=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
 const {build}=require('@vercel/node');const {FileFsRef}=require('@vercel/build-utils');
 const root=process.env.ONSITE_RUNTIME_VERIFY_ROOT||await fs.mkdtemp(path.join(tmpdir(),'onsite-api-runtime-'));
 await fs.mkdir(root,{recursive:true});
 const inputs=['api/treasure-post.ts','src/features/onsitePosting.ts','src/features/distance.ts','src/features/treasureCategories.ts','tsconfig.json','tsconfig.node.json'];
 const pkg=JSON.parse(await fs.readFile(path.join(repo,'package.json'),'utf8'));pkg.scripts={};
 const env=Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','TEMP','TMP','HOME','USERPROFILE'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 async function compileAndRun(label,baseline){
  const work=path.join(root,label),out=path.join(work,'function');await fs.mkdir(work,{recursive:true});
  for(const name of inputs){const dest=path.join(work,name);await fs.mkdir(path.dirname(dest),{recursive:true});let data=await fs.readFile(path.join(repo,name));if(baseline){const r=spawnSync('git',['show','HEAD:'+name],{cwd:repo,encoding:'utf8'});assert.equal(r.status,0,r.stderr);data=r.stdout;}await fs.writeFile(dest,data);}
  await fs.writeFile(path.join(work,'package.json'),JSON.stringify(pkg));
  // Reuse installed type definitions for compilation; nothing is downloaded or deployed.
  try{await fs.symlink(path.join(repo,'node_modules'),path.join(work,'node_modules'),process.platform==='win32'?'junction':'dir');}catch(e){if(e.code!=='EEXIST')throw e;}
  const files=Object.fromEntries([...inputs,'package.json'].map(name=>[name,new FileFsRef({fsPath:path.join(work,name)})]));
  const built=await build({files,entrypoint:'api/treasure-post.ts',workPath:work,config:{projectSettings:{installCommand:''}},considerBuildCommand:true});
  for(const [name,file]of Object.entries(built.output.files)){const dest=path.join(out,name);await fs.mkdir(path.dirname(dest),{recursive:true});if(file.type==='FileBlob')await fs.writeFile(dest,file.data);else if(file.type==='FileFsRef')await fs.copyFile(file.fsPath,dest);else throw Error('Unsupported builder output '+file.type);}
  const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--run-output',path.join(out,'api/treasure-post.js')],{cwd:out,env,encoding:'utf8',timeout:20000});
  await fs.writeFile(path.join(work,'node-start.log'),result.stdout+result.stderr);
  const report={builder:require('@vercel/node/package.json').version,node:process.version,runtime:built.output.runtime,handler:built.output.handler,files:Object.keys(built.output.files),exit:result.status};
  if(baseline){assert.notEqual(result.status,0);assert.match(result.stderr,/ERR_MODULE_NOT_FOUND/);assert.match(result.stderr,/features[/\\]onsitePosting['\s]/);report.expectedFailure='ERR_MODULE_NOT_FOUND';}
  else{assert.equal(result.status,0,result.stdout+result.stderr);report.checks=JSON.parse(result.stdout.trim());}
  await fs.writeFile(path.join(work,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({label,...report}));return report;
 }
 if(process.argv.includes('--compare-head'))await compileAndRun('before',true);
 await compileAndRun('after',false);
}
