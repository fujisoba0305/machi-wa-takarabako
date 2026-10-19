import { describe, it, expect, vi, afterEach } from 'vitest';
import handler from '../../api/walking-trial-access';import type {VercelRequest,VercelResponse} from '@vercel/node';
const owner='11111111-1111-4111-8111-111111111111';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function response(){const r={status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis(),setHeader:vi.fn()};return r;}
async function run(token='Bearer test.token.value',query={}){const r=response();await handler({method:'GET',headers:{authorization:token},query} as unknown as VercelRequest,r as unknown as VercelResponse);return r;}
function configure(){vi.stubEnv('WALKING_TRIAL_ENABLED','on');vi.stubEnv('WALKING_TRIAL_USER_IDS',owner);vi.stubEnv('VITE_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','test-public');}
it('未設定・無効設定・URLパラメータだけでは許可しない',async()=>{vi.stubEnv('WALKING_TRIAL_ENABLED','off');const f=vi.fn();vi.stubGlobal('fetch',f);const r=await run('',{trial:'1',user:owner});expect(r.status).toHaveBeenCalledWith(403);expect(f).not.toHaveBeenCalled();});
it('トークンなしでは本人IDを指定しても拒否',async()=>{configure();const f=vi.fn();vi.stubGlobal('fetch',f);expect((await run('',{user:owner})).status).toHaveBeenCalledWith(401);expect(f).not.toHaveBeenCalled();});
for(const [id,anonymous,status] of [[owner,false,200],['another-account',false,403],[owner,true,403]] as const)it('認証サーバーで検証したID '+id+' anonymous='+anonymous,async()=>{configure();const f=vi.fn().mockResolvedValue({ok:true,json:async()=>({id,is_anonymous:anonymous})});vi.stubGlobal('fetch',f);const r=await run();expect(r.status).toHaveBeenCalledWith(status);expect(r.json).toHaveBeenCalledWith(status===200?{allowed:true,distances:[1]}:{allowed:false});expect(r.setHeader).toHaveBeenCalledWith('Cache-Control','no-store');expect(f.mock.calls[0][0].pathname).toBe('/auth/v1/user');});
it('認証失効・通信切断は許可扱いにしない',async()=>{configure();vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401}));expect((await run()).status).toHaveBeenCalledWith(401);vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('offline')));expect((await run()).status).toHaveBeenCalledWith(503);});

it('3kmは初期無効、サーバー専用設定on時だけ許可距離に含める',async()=>{configure();vi.stubEnv('WALKING_TRIAL_3KM_ENABLED','on');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({id:owner,is_anonymous:false})}));const r=await run();expect(r.json).toHaveBeenCalledWith({allowed:true,distances:[1,3]});});

it('standard straight search allows any verified non-anonymous user without enabling legacy road trials',async()=>{
 configure();vi.stubEnv('WALKING_TRIAL_ENABLED','off');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'another-account',is_anonymous:false})}));
 const result=await run('Bearer test.token.value',{mode:'straight'});expect(result.status).toHaveBeenCalledWith(200);expect(result.json).toHaveBeenCalledWith({allowed:true,mode:'straight'});expect(fetch).toHaveBeenCalledOnce();
 expect((await run()).status).toHaveBeenCalledWith(403);
});
it('standard mode never grants access from the URL alone, anonymous accounts or expired tokens',async()=>{
 configure();expect((await run('',{mode:'straight'})).status).toHaveBeenCalledWith(401);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({id:owner,is_anonymous:true})}));expect((await run('Bearer test.token.value',{mode:'straight'})).status).toHaveBeenCalledWith(403);
 vi.mocked(fetch).mockResolvedValue({ok:false,status:401} as Response);expect((await run('Bearer test.token.value',{mode:'straight'})).status).toHaveBeenCalledWith(401);
});
