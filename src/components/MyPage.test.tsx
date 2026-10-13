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
let root: Root; let container: HTMLDivElement;
beforeEach(() => { vi.clearAllMocks(); auth.init.mockResolvedValue(undefined); auth.session.mockResolvedValue({data:{session:null},error:null}); auth.login.mockResolvedValue(undefined); auth.logout.mockResolvedValue(undefined); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); container=document.createElement('div'); document.body.append(container); root=createRoot(container); });
afterEach(() => { act(()=>root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render(inProgress=false) { await act(async()=>root.render(<MyPage adventureInProgress={inProgress} onBack={vi.fn()} />)); }
describe('MyPage', () => {
  it('shows optional guest login and explicitly no cloud records; leaves guest storage intact', async () => {
    localStorage.setItem('machiTakarabakoExp','120'); const before={...localStorage}; await render();
    expect(container.textContent).toContain('ゲストで利用中'); expect(container.textContent).toContain('まだ利用できません'); expect({...localStorage}).toEqual(before);
  });
  it('reflects account changes, handles image failures and clears profile on logout', async () => {
    await render(); await act(async()=>auth.change?.('SIGNED_IN',{user:{id:'a',user_metadata:{full_name:'冒険者A',avatar_url:'https://lh3.googleusercontent.com/a'}}}));
    expect(container.textContent).toContain('冒険者A');
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
    auth.session.mockResolvedValue({data:{session:{user:{id:'b',user_metadata:{full_name:'冒険者B'}}}},error:null}); await render();
    expect(container.textContent).toContain('冒険者B'); act(()=>root.render(<div />)); expect(auth.unsubscribe).toHaveBeenCalledOnce(); await render(); expect(container.textContent).toContain('冒険者B');
  });
  it('shows callback failure without blocking guest return', async () => { auth.init.mockRejectedValue(new Error('expired')); await render(); expect(container.textContent).toContain('同じブラウザ'); expect(container.querySelector<HTMLButtonElement>('.my-page-back')!.disabled).toBe(false); });
});
