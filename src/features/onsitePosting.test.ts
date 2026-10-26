import {describe,it,expect} from 'vitest';
import {validatePostingFix,canonicalPostingValue} from './onsitePosting';
const now=1700000000000,target={latitude:35,longitude:139},fix={...target,accuracy:10,timestamp:now};
describe('posting-only location rules (arrival rules unchanged)',()=>{
 it('accepts a fresh accurate onsite fix including exactly 50m and 30 seconds',()=>{expect(()=>validatePostingFix({...fix,accuracy:50,timestamp:now-30000},target,now)).not.toThrow();});
 it.each([51,-1,NaN,Infinity])('rejects accuracy %s',accuracy=>{expect(()=>validatePostingFix({...fix,accuracy},target,now)).toThrow();});
 it.each([now-30001,now+5001,0,NaN])('rejects invalid measurement time %s',timestamp=>{expect(()=>validatePostingFix({...fix,timestamp},target,now)).toThrow();});
 it('rejects moving away without changing the fixed target',()=>{expect(()=>validatePostingFix({...fix,latitude:35.002},target,now)).toThrow('離れ');expect(target.latitude).toBe(35);});
 it.each([NaN,91,-91])('rejects invalid coordinates %s',latitude=>{expect(()=>validatePostingFix({...fix,latitude},target,now)).toThrow();});
 it('rejects a stale fix again at final save even if it was valid at form opening',()=>{validatePostingFix(fix,target,now);expect(()=>validatePostingFix(fix,target,now+30001)).toThrow('期限');});
 it('canonicalizes allowed fields and refuses a second photo without a first',()=>{expect(canonicalPostingValue({name:' 宝物 ',comment:'',category:'🍜 グルメ',...target,image_url:null})).toMatchObject({name:'宝物',additional_image_url:null});expect(()=>canonicalPostingValue({name:'宝物',comment:'',category:'🍜 グルメ',...target,image_url:null,additional_image_url:'https://example.com/a'})).toThrow();});
});
