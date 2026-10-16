// @vitest-environment jsdom
import React from 'react';import {act} from 'react-dom/test-utils';import {createRoot,type Root} from 'react-dom/client';import {beforeEach,afterEach,it,expect,vi} from 'vitest';import {ApproximateSearchControls} from './ApproximateSearchControls';import {authorizeWalkingTrial} from '../services/walkingTrial';
const auth=vi.hoisted(()=>({listener:null as null|(()=>void)}));vi.mock('../services/walkingTrial',()=>({authorizeWalkingTrial:vi.fn()}));vi.mock('../services/accountAuth',()=>({
 getAccountClient:()=>({auth:{onAuthStateChange:(cb:()=>void)=>{
 auth.listener=cb;
 return {data:{subscription:{unsubscribe:()=>{}}}};
 }}})
}));let box:HTMLDivElement,root:Root;const change=vi.fn();beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);box=document.createElement('div');document.body.append(box);root=createRoot(box);});afterEach(async()=>{await act(async()=>root.unmount());box.remove();vi.unstubAllGlobals();});
it.each([false,true])('shows the switch only with server permission: %s',async allowed=>{vi.mocked(authorizeWalkingTrial).mockResolvedValue(allowed);await act(async()=>root.render(<ApproximateSearchControls enabled={false} onChange={change} locked={false}/>));expect(box.querySelector('input')!==null).toBe(allowed);if(allowed)expect(box.querySelector<HTMLInputElement>('input')!.checked).toBe(false);});
it('hides and turns OFF on account change or permission failure',async()=>{vi.mocked(authorizeWalkingTrial).mockResolvedValue(true);await act(async()=>root.render(<ApproximateSearchControls enabled={true} onChange={change} locked={false}/>));vi.mocked(authorizeWalkingTrial).mockResolvedValue(false);await act(async()=>auth.listener?.());expect(box.querySelector('input')).toBeNull();expect(change).toHaveBeenCalledWith(false);});
