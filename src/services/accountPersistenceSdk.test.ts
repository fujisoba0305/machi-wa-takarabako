// @vitest-environment jsdom
import {createClient} from '@supabase/supabase-js';
import {afterEach,expect,it,vi} from 'vitest';
import {ACCOUNT_STORAGE_KEY,createAccountSessionStorage,accountPersistenceReport} from './accountSessionStorage';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
it('real SDK saves before SIGNED_IN, restores with a fresh client, and removes only on explicit signout',async()=>{
 localStorage.clear();vi.stubGlobal('BroadcastChannel',undefined);
 const network=vi.fn(async(input:any)=>String(input).includes('/user')?new Response(JSON.stringify({id:'fixture-account',aud:'authenticated',role:'authenticated',email:'',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}),{status:200,headers:{'Content-Type':'application/json'}}):new Response(null,{status:204}));
 const options=()=>({global:{fetch:network},auth:{storageKey:ACCOUNT_STORAGE_KEY,storage:createAccountSessionStorage(),persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
 const first=createClient('https://fixture.invalid','fixture-public-key',options());
 let savedAtSignIn=false;first.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN')savedAtSignIn=localStorage.getItem(ACCOUNT_STORAGE_KEY)!==null;});
 const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:'fixture-account',exp:Math.floor(Date.now()/1000)+3600}))+'.fixture';
 const signed=await first.auth.setSession({access_token:token,refresh_token:'fixture-refresh'});expect(signed.error).toBeNull();expect(savedAtSignIn).toBe(true);expect(accountPersistenceReport()).toContain('セッション保存・読み戻し一致');
 const second=createClient('https://fixture.invalid','fixture-public-key',options());const restored=await second.auth.getSession();expect(restored.error).toBeNull();expect(restored.data.session?.access_token).toBe(token);expect(network).toHaveBeenCalledTimes(1);
 const out=await second.auth.signOut({scope:'local'});expect(out.error).toBeNull();expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBeNull();expect(accountPersistenceReport()).toContain('SDKからセッション削除');
 expect(accountPersistenceReport()).not.toContain(token);expect(accountPersistenceReport()).not.toContain('fixture-account');
});

it('real SDK completes PKCE, persists the session and restores the matching name in a fresh runtime',async()=>{
 localStorage.clear();vi.stubGlobal('BroadcastChannel',undefined);
 const {assertPersistedAccountSession}=await import('./accountSessionStorage');const {saveAdventurerProfile,readStartupAdventurerProfile}=await import('../features/adventurerProfile');
 const expires=Math.floor(Date.now()/1000)+3600,user={id:'oauth-fixture-user',aud:'authenticated',role:'authenticated',email:'',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:expires}))+'.fixture';
 const network=vi.fn(async(input:any)=>{if(!String(input).includes('/token'))throw Error('Unexpected request');return new Response(JSON.stringify({access_token:token,refresh_token:'oauth-fixture-refresh',expires_in:3600,expires_at:expires,token_type:'bearer',user}),{status:200,headers:{'Content-Type':'application/json'}});});
 const options=()=>({global:{fetch:network},auth:{storageKey:ACCOUNT_STORAGE_KEY,storage:createAccountSessionStorage(),flowType:'pkce' as const,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
 const first=createClient('https://oauth-fixture.invalid','fixture-public-key',options());createAccountSessionStorage().setItem(ACCOUNT_STORAGE_KEY+'-code-verifier',JSON.stringify('fixture-verifier'));
 const callback=await first.auth.exchangeCodeForSession('fixture-code');expect(callback.error).toBeNull();assertPersistedAccountSession(callback.data.session);saveAdventurerProfile(localStorage,user.id,{name:'fixture-name',started:true});
 const storedBefore=localStorage.getItem(ACCOUNT_STORAGE_KEY),namesBefore=localStorage.getItem('machiAdventurerProfiles.v1');
 const second=createClient('https://oauth-fixture.invalid','fixture-public-key',options());const restored=await second.auth.getSession();expect(restored.error).toBeNull();assertPersistedAccountSession(restored.data.session);expect(readStartupAdventurerProfile(localStorage,restored.data.session!.user.id)).toEqual({name:'fixture-name',started:true});expect(readStartupAdventurerProfile(localStorage,'other-account')).toBeNull();expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBe(storedBefore);expect(localStorage.getItem('machiAdventurerProfiles.v1')).toBe(namesBefore);expect(network).toHaveBeenCalledTimes(1);
 expect(accountPersistenceReport()).not.toMatch(/oauth-fixture-user|fixture-name|oauth-fixture-refresh/);
});
