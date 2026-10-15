// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const auth=vi.hoisted(()=>({session:vi.fn()}));
vi.mock('./accountAuth',()=>({getAccountClient:()=>({auth:{getSession:auth.session}})}));
import {requestAccountPosition} from './accountPosition';
const locate=vi.fn();beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();locate.mockResolvedValue({accuracy:3.2});});afterEach(()=>vi.useRealTimers());
it.each([null,{user:{id:'a',is_anonymous:true}},{user:{id:'a'},expires_at:1}])('never invokes GPS with missing, anonymous or expired authentication: %s',async(session)=>{auth.session.mockResolvedValue({data:{session},error:null});await expect(requestAccountPosition(locate)).rejects.toThrow('Googleログイン');expect(locate).not.toHaveBeenCalled();});
it('does not acquire GPS while session restoration is pending or after its timeout',async()=>{let done!:(s:any)=>void;auth.session.mockImplementation(()=>new Promise(r=>{done=r;}));const outcome=requestAccountPosition(locate).catch(e=>e);expect(locate).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(8000);expect(((await outcome) as Error).message).toContain('ログイン状態');done({data:{session:{user:{id:'a'}}},error:null});await Promise.resolve();expect(locate).not.toHaveBeenCalled();});
it('acquires GPS only after successful session validation',async()=>{auth.session.mockResolvedValue({data:{session:{user:{id:'a'},expires_at:Date.now()/1000+3600}},error:null});await expect(requestAccountPosition(locate,'a')).resolves.toEqual({accuracy:3.2});expect(locate).toHaveBeenCalledOnce();});
it('never invokes GPS for an account that changed during registration',async()=>{auth.session.mockResolvedValue({data:{session:{user:{id:'b'}}},error:null});await expect(requestAccountPosition(locate,'a')).rejects.toThrow('Googleログイン');expect(locate).not.toHaveBeenCalled();});
