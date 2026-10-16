export const PROFILE_KEY = 'machiAdventurerProfiles.v1';
export type AdventurerProfile = { name: string; started: boolean };
type Store = Pick<Storage, 'getItem' | 'setItem'>;
function records(storage: Store): Record<string, AdventurerProfile> {
  try { const value = JSON.parse(storage.getItem(PROFILE_KEY) || '{}'); return value.version === 1 && value.profiles && typeof value.profiles === 'object' && !Array.isArray(value.profiles) ? value.profiles : {}; } catch { return {}; }
}
const owner = (uid: string | null) => uid ? 'user:' + uid : 'guest';
export function validAdventurerName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 40 && !/[\u0000-\u001f\u007f]/.test(value);
}
export function readAdventurerProfile(storage: Store, uid: string | null): AdventurerProfile | null {
  const profile = records(storage)[owner(uid)];
  return profile && validAdventurerName(profile.name) ? { name: profile.name.trim(), started: profile.started === true } : null;
}
export function saveAdventurerProfile(storage: Store, uid: string | null, profile: AdventurerProfile) {
  if (!validAdventurerName(profile.name)) throw Error('冒険者名は1〜40文字で入力してください。');
  storage.setItem(PROFILE_KEY, JSON.stringify({ version: 1, profiles: { ...records(storage), [owner(uid)]: { name: profile.name.trim(), started: profile.started === true } } }));
}

/** Read-only restoration diagnosis. Never returns names, UIDs or stored JSON. */
export function inspectAdventurerProfile(storage:Pick<Storage,'getItem'>,uid:string|null){
 try{const raw=storage.getItem(PROFILE_KEY);if(raw===null)return 'このブラウザには冒険者名の保存データがありません。';let value:any;try{value=JSON.parse(raw);}catch{return '保存データの形式を読み取れません。元のデータは変更していません。';}
 if(value?.version!==1||!value.profiles||typeof value.profiles!=='object'||Array.isArray(value.profiles))return '保存形式を確認できません。元のデータは変更していません。';
 const profile=value.profiles[owner(uid)];if(!profile)return 'このログインアカウントに対応する保存名がありません。別アカウントの名前は使用しません。';
 if(!validAdventurerName(profile.name))return 'このアカウントの保存名を検証できません。';
 return profile.started===true?'このアカウントの登録済み冒険者名が保存されています。':'このアカウントの冒険者名は下書きとして保存されています。入力し直す必要はありません。';
 }catch{return 'ブラウザの保存領域を読み取れません。再登録の前にブラウザ設定を確認してください。';}
}

/** Startup must distinguish absent data from unreadable data before offering registration. */
export function readStartupAdventurerProfile(storage: Pick<Storage, 'getItem'>, uid: string): AdventurerProfile | null {
  let raw: string | null;
  try { raw = storage.getItem(PROFILE_KEY); }
  catch { throw new Error('保存済みの冒険者名を読み取れません。再登録せず、ブラウザの保存設定を確認して再確認してください。'); }
  if (raw === null) return null;
  let value: any;
  try { value = JSON.parse(raw); } catch { throw new Error('冒険者名の保存データを確認できません。元のデータは変更していません。再登録せず再確認してください。'); }
  if (value?.version !== 1 || !value.profiles || typeof value.profiles !== 'object' || Array.isArray(value.profiles))
    throw new Error('冒険者名の保存形式を確認できません。元のデータは変更していません。再登録せず再確認してください。');
  const key = owner(uid);
  if (!Object.prototype.hasOwnProperty.call(value.profiles, key)) return null;
  const profile = value.profiles[key];
  if (!profile || !validAdventurerName(profile.name)) throw new Error('このアカウントの保存名を確認できません。元のデータは変更していません。再登録せず再確認してください。');
  return { name: profile.name.trim(), started: profile.started === true };
}
