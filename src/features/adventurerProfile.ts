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
