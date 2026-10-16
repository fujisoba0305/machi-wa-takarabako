import { describe, expect, it } from 'vitest';
import { PROFILE_KEY, readAdventurerProfile, saveAdventurerProfile } from './adventurerProfile';
function storage() { const data = new Map<string,string>(); return { getItem: (key:string) => data.get(key) ?? null, setItem: (key:string,value:string) => { data.set(key,value); }, data }; }
describe('adventurer names remain separate from rewards and identities', () => {
  it('restores names without mixing guest, account A and account B', () => {
    const s=storage(); for(const [uid,name] of [[null,'ゲスト'],['a','冒険者A'],['b','冒険者B']] as const) saveAdventurerProfile(s,uid,{name,started:true});
    expect(readAdventurerProfile(s,'a')).toEqual({name:'冒険者A',started:true}); expect(readAdventurerProfile(s,'b')?.name).toBe('冒険者B');expect(readAdventurerProfile(s,null)?.name).toBe('ゲスト');expect(readAdventurerProfile(s,'other')).toBeNull();
  });
  it('updates one name without changing EXP, adventures or another account', () => {
    const s=storage(); s.setItem('machiTakarabakoExp','500');s.setItem('machiTakarabakoActiveAdventure','preserved');saveAdventurerProfile(s,'a',{name:'before',started:true});saveAdventurerProfile(s,'b',{name:'B',started:true});saveAdventurerProfile(s,'a',{name:' after ',started:true});
    expect(readAdventurerProfile(s,'a')?.name).toBe('after');expect(readAdventurerProfile(s,'b')?.name).toBe('B');expect(s.getItem('machiTakarabakoExp')).toBe('500');expect(s.getItem('machiTakarabakoActiveAdventure')).toBe('preserved');expect([...s.data.keys()]).toHaveLength(3);
  });
  it('handles broken data without deleting anything and keeps incomplete registration distinct', () => {
    const s=storage();s.setItem(PROFILE_KEY,'broken');expect(readAdventurerProfile(s,null)).toBeNull();expect(s.getItem(PROFILE_KEY)).toBe('broken');saveAdventurerProfile(s,null,{name:'draft',started:false});expect(readAdventurerProfile(s,null)?.started).toBe(false);
  });
  it('rejects empty, oversized or control-character names', () => { const s=storage();for(const name of [' ','x'.repeat(41),'a\n'])expect(()=>saveAdventurerProfile(s,null,{name,started:true})).toThrow();expect(s.getItem(PROFILE_KEY)).toBeNull(); });
});

it('distinguishes missing, draft, registered and unreadable storage without names or UID',async()=>{const {inspectAdventurerProfile}=await import('./adventurerProfile');const s=storage();expect(inspectAdventurerProfile(s,'a')).toContain('保存データがありません');saveAdventurerProfile(s,'a',{name:'fujisoba',started:false});expect(inspectAdventurerProfile(s,'a')).toContain('下書き');expect(inspectAdventurerProfile(s,'b')).toContain('対応する保存名がありません');saveAdventurerProfile(s,'a',{name:'fujisoba',started:true});expect(inspectAdventurerProfile(s,'a')).toContain('登録済み');expect(inspectAdventurerProfile(s,'a')).not.toContain('fujisoba');const before=s.getItem(PROFILE_KEY);expect(inspectAdventurerProfile({getItem(){throw Error('blocked');}},'a')).toContain('読み取れません');expect(s.getItem(PROFILE_KEY)).toBe(before);});
