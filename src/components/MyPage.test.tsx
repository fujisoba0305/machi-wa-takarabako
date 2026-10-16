// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ session: vi.fn(), init: vi.fn(), login: vi.fn(), logout: vi.fn(), unsubscribe: vi.fn(), change: null as null | ((e: string,s: unknown) => void) }));
vi.mock('../services/accountAuth', () => ({
  initializeAccount: auth.init, loginWithGoogle: auth.login, logoutAccount: auth.logout,
  googleAvatar: (s: unknown) => typeof s === 'string' ? s : undefined,
  getAccountClient: () => ({ auth: { getSession: auth.session, onAuthStateChange: (cb: typeof auth.change) => { auth.change=cb; return { data: { subscription: { unsubscribe: auth.unsubscribe } } }; } } }),
}));
import { MyPage } from './MyPage';
import { readAdventurerProfile, saveAdventurerProfile } from '../features/adventurerProfile';
let root: Root; let container: HTMLDivElement;
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); auth.init.mockResolvedValue(undefined); auth.session.mockResolvedValue({data:{session:null},error:null}); auth.login.mockResolvedValue(undefined); auth.logout.mockResolvedValue(undefined); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); container=document.createElement('div'); document.body.append(container); root=createRoot(container); });
afterEach(() => { act(()=>root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render(inProgress=false) { await act(async()=>root.render(<MyPage adventureInProgress={inProgress} onBack={vi.fn()} />)); }
describe('MyPage', () => {
  it('edits the account adventurer name without changing another account or guest EXP', async () => {
    localStorage.clear(); localStorage.setItem('machiTakarabakoExp','120');saveAdventurerProfile(localStorage,'a',{name:'旧名',started:true});saveAdventurerProfile(localStorage,'b',{name:'別の人',started:true});auth.session.mockResolvedValue({data:{session:{user:{id:'a',user_metadata:{}}}},error:null});const changed=vi.fn();
    await act(async()=>root.render(<MyPage adventureInProgress={false} onBack={vi.fn()} onNameChange={changed}/>));
    const input=container.querySelector<HTMLInputElement>('#adventurer-name-edit')!;
    const {Simulate}=await import('react-dom/test-utils');await act(async()=>Simulate.change(input,{target:{value:'新しい名前'}} as never));await act(async()=>Simulate.submit(container.querySelector('form')!));
    expect(container.querySelector('.my-page-card h2')?.textContent).toBe('新しい名前');expect(changed).toHaveBeenCalledWith('新しい名前');expect(readAdventurerProfile(localStorage,'a')).toEqual({name:'新しい名前',started:true});expect(readAdventurerProfile(localStorage,'b')?.name).toBe('別の人');expect(localStorage.getItem('machiTakarabakoExp')).toBe('120');
  });
  it('shows optional guest login and explicitly no cloud records; leaves guest storage intact', async () => {
    localStorage.setItem('machiTakarabakoExp','120'); const before={...localStorage}; await render();
    expect(container.textContent).toContain('ゲストで利用中'); expect(container.textContent).toContain('まだ利用できません'); expect({...localStorage}).toEqual(before);
  });
  it('reflects account changes, handles image failures and clears profile on logout', async () => {
    await render(); await act(async()=>auth.change?.('SIGNED_IN',{user:{id:'a',user_metadata:{full_name:'冒険者A',avatar_url:'https://lh3.googleusercontent.com/a'}}}));
    expect(container.querySelector('.my-page-card h2')?.textContent).toBe('冒険者名は未登録です');expect(container.textContent).not.toContain('冒険者A');
    act(()=>container.querySelector('img')!.dispatchEvent(new Event('error'))); expect(container.querySelector('img')).toBeNull();
    await act(async()=>container.querySelector<HTMLButtonElement>('.my-page-login')!.click());
    expect(auth.logout).toHaveBeenCalledOnce(); expect(container.textContent).not.toContain('冒険者A');
  });
  it('prevents duplicate clicks and reports login failure', async () => {
    let reject!: (e: Error)=>void; auth.login.mockImplementation(()=>new Promise((_r,j)=>{reject=j;})); await render();
    act(()=>{container.querySelector<HTMLButtonElement>('.my-page-login')!.click(); container.querySelector<HTMLButtonElement>('.my-page-login')!.click();});
    expect(auth.login).toHaveBeenCalledOnce(); await act(async()=>reject(new Error('ログインできません')));
    expect(container.querySelector('[role=status]')?.textContent).toContain('ログインできません'); expect(container.querySelector<HTMLButtonElement>('.my-page-login')!.disabled).toBe(false);
  });
  it('blocks authentication while walking', async () => { await render(true); expect(container.querySelector<HTMLButtonElement>('.my-page-login')!.disabled).toBe(true); expect(auth.login).not.toHaveBeenCalled(); });
  it('restores an existing session on remount and unsubscribes on leaving', async () => {
    saveAdventurerProfile(localStorage,'b',{name:'fujisoba',started:true});auth.session.mockResolvedValue({data:{session:{user:{id:'b',user_metadata:{full_name:'Google表示名B'}}}},error:null}); await render();
    expect(container.querySelector('.my-page-card h2')?.textContent).toBe('fujisoba');expect(container.textContent).not.toContain('Google表示名B'); act(()=>root.render(<div />)); expect(auth.unsubscribe).toHaveBeenCalledOnce(); await render(); expect(container.querySelector('.my-page-card h2')?.textContent).toBe('fujisoba');expect(container.textContent).not.toContain('Google表示名B');
  });
  it('shows callback failure without blocking guest return', async () => { auth.init.mockRejectedValue(new Error('expired')); await render(); expect(container.textContent).toContain('同じブラウザ'); expect(container.querySelector<HTMLButtonElement>('.my-page-back')!.disabled).toBe(false); });
});

it('switches the name editor to the matching account without copying a prior name',async()=>{localStorage.clear();saveAdventurerProfile(localStorage,'a',{name:'名前A',started:true});saveAdventurerProfile(localStorage,'b',{name:'名前B',started:true});auth.session.mockResolvedValue({data:{session:{user:{id:'a',user_metadata:{}}}},error:null});await act(async()=>root.render(<MyPage adventureInProgress={false} onBack={vi.fn()} onNameChange={vi.fn()}/>));expect(container.querySelector<HTMLInputElement>('#adventurer-name-edit')?.value).toBe('名前A');await act(async()=>auth.change?.('SIGNED_IN',{user:{id:'b',user_metadata:{}}}));expect(container.querySelector<HTMLInputElement>('#adventurer-name-edit')?.value).toBe('名前B');await act(async()=>auth.change?.('SIGNED_IN',{user:{id:'c',user_metadata:{}}}));expect(container.querySelector<HTMLInputElement>('#adventurer-name-edit')?.value).toBe('');});

it('shows only the saved name while editing, and refreshes it only after a successful save',async()=>{saveAdventurerProfile(localStorage,'a',{name:'fujisoba',started:true});auth.session.mockResolvedValue({data:{session:{user:{id:'a',user_metadata:{full_name:'Google表示名'}}}},error:null});await act(async()=>root.render(<MyPage adventureInProgress={false} onBack={vi.fn()} onNameChange={vi.fn()}/>));const {Simulate}=await import('react-dom/test-utils');await act(async()=>Simulate.change(container.querySelector('input')!,{target:{value:'未保存の名前'}} as never));expect(container.querySelector('.my-page-card h2')?.textContent).toBe('fujisoba');await act(async()=>Simulate.change(container.querySelector('input')!,{target:{value:' '}} as never));await act(async()=>Simulate.submit(container.querySelector('form')!));expect(container.querySelector('.my-page-card h2')?.textContent).toBe('fujisoba');expect(readAdventurerProfile(localStorage,'a')?.name).toBe('fujisoba');});
it('does not show a previous account or guest name when the next account has no profile',async()=>{saveAdventurerProfile(localStorage,'a',{name:'fujisoba',started:true});saveAdventurerProfile(localStorage,'b',{name:'別アカウント名',started:true});saveAdventurerProfile(localStorage,null,{name:'ゲスト名',started:true});auth.session.mockResolvedValue({data:{session:{user:{id:'a',user_metadata:{full_name:'Google名A'}}}},error:null});await render();expect(container.querySelector('.my-page-card h2')?.textContent).toBe('fujisoba');await act(async()=>auth.change?.('SIGNED_IN',{user:{id:'b',user_metadata:{full_name:'Google名B'}}}));expect(container.querySelector('.my-page-card h2')?.textContent).toBe('別アカウント名');expect(container.textContent).not.toContain('fujisoba');await act(async()=>auth.change?.('SIGNED_IN',{user:{id:'c',user_metadata:{full_name:'Google名C'}}}));expect(container.querySelector('.my-page-card h2')?.textContent).toBe('冒険者名は未登録です');expect(container.textContent).not.toMatch(/fujisoba|別アカウント名|ゲスト名|Google名/);});

it('waits for the OAuth persistence check before exposing the signed-in profile',async()=>{let complete!:()=>void;auth.init.mockImplementation(()=>new Promise<void>(r=>{complete=r;}));saveAdventurerProfile(localStorage,'a',{name:'fixture-name',started:true});await render();await act(async()=>auth.change?.('SIGNED_IN',{user:{id:'a',user_metadata:{}}}));expect(container.querySelector('h2')?.textContent).toBe('確認中…');auth.session.mockResolvedValue({data:{session:{user:{id:'a',user_metadata:{}}}},error:null});await act(async()=>complete());expect(container.querySelector('h2')?.textContent).toBe('fixture-name');});
it('does not treat INITIAL_SESSION null as the final result before a saved session loads',async()=>{let complete!:(v:any)=>void;auth.session.mockImplementation(()=>new Promise(r=>{complete=r;}));saveAdventurerProfile(localStorage,'a',{name:'fixture-name',started:true});await render();await act(async()=>auth.change?.('INITIAL_SESSION',null));await act(async()=>complete({data:{session:{user:{id:'a',user_metadata:{}}}},error:null}));expect(container.querySelector('h2')?.textContent).toBe('fixture-name');});
