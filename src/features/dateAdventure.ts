import { requestAdventurePosition, arrivalDistanceMeters, ARRIVAL_RADIUS_METERS, MAX_ACCURACY_METERS,
  type PositionFix, type AdventureResult } from './activeAdventure';

export const DATE_ADVENTURE_KEY = 'machiTakarabakoDateAdventure';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Spot = NonNullable<AdventureResult['spot']>;
type Target = { id: string; latitude: number; longitude: number };
export type DateAdventure = {
  version: 1; id: string; departure: PositionFix; startedAt: number;
  waypoint: Target; final: Target; waypointArrival?: PositionFix;
  rewardClaimed: boolean; finalArrival?: PositionFix; completedAt?: number;
  rewardTotals?: { exp: number; count: number };
  result: { waypoint: Spot; final: Spot; choices: Record<string, string>; distanceKm: number | null; playerName: string };
};
const targetOf = (s: Spot): Target => ({ id: s.type + ':' + s.id,
  latitude: s.lat ?? s.center?.lat ?? NaN, longitude: s.lon ?? s.center?.lon ?? NaN });
const validTarget = (p: Target) => p && typeof p.id === 'string' && Number.isFinite(p.latitude) &&
  Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
const same = (a: Target, b: Target) => a.id === b.id && a.latitude === b.latitude && a.longitude === b.longitude;
const validFix = (p: PositionFix) => p && validTarget({ ...p, id: 'gps' }) &&
  Number.isFinite(p.timestamp) && p.timestamp > 0 && Number.isFinite(p.accuracy) && p.accuracy >= 0 && p.accuracy <= MAX_ACCURACY_METERS;
const verified = (p: PositionFix, t: Target) => validFix(p) && arrivalDistanceMeters(p, t) <= ARRIVAL_RADIUS_METERS;
export function loadDateAdventure(storage: StorageLike): DateAdventure | null {
  try {
    const a = JSON.parse(storage.getItem(DATE_ADVENTURE_KEY) || 'null');
    if (!a || a.version !== 1 || typeof a.id !== 'string' || !a.id || !validFix(a.departure) ||
      !Number.isFinite(a.startedAt) || a.startedAt <= 0 || !validTarget(a.waypoint) || !validTarget(a.final) ||
      typeof a.rewardClaimed !== 'boolean' || !a.result?.waypoint || !a.result.final ||
      !same(a.waypoint, targetOf(a.result.waypoint)) || !same(a.final, targetOf(a.result.final)) ||
      a.result.choices?.mood !== 'デート' || !Object.values(a.result.choices).every(v => typeof v === 'string') ||
      typeof a.result.playerName !== 'string' || (a.result.distanceKm !== null && !Number.isFinite(a.result.distanceKm)) ||
      (a.waypointArrival && !verified(a.waypointArrival, a.waypoint)) ||
      (a.rewardClaimed && (!a.waypointArrival || !verified(a.finalArrival, a.final) ||
        !Number.isFinite(a.completedAt) || a.completedAt < a.startedAt ||
        !Number.isFinite(a.rewardTotals?.exp) || a.rewardTotals.exp < 50 ||
        !Number.isInteger(a.rewardTotals?.count) || a.rewardTotals.count < 1))) return null;
    return a;
  } catch { return null; }
}
const numberFrom = (storage: StorageLike, key: string) => {
  const n = Number(storage.getItem(key)); return Number.isFinite(n) && n >= 0 ? n : 0;
};
// The completed record is a durable reward journal. Replaying absolute totals is idempotent,
// including a reload between either legacy counter write; later earned totals are preserved.
function reconcileReward(storage: StorageLike, a: DateAdventure) {
  if (!a.rewardClaimed || !a.rewardTotals) return;
  try {
    for (const [key, total] of [['machiTakarabakoExp', a.rewardTotals.exp],
      ['machiTakarabakoAdventureCount', a.rewardTotals.count]] as const)
      storage.setItem(key, String(Math.max(numberFrom(storage, key), total)));
  } catch { throw Error('報酬の保存を完了できませんでした。もう一度ゴールを確認してください。'); }
}
export class DateAdventureSession {
  current: DateAdventure | null;
  private generation = 0;
  private busy = false;
  constructor(private storage: StorageLike, private locate = requestAdventurePosition) {
    this.current = loadDateAdventure(storage);
    if (this.current) { try { reconcileReward(storage, this.current); } catch { /* Retry on final confirmation. */ } }
  }
  cancelPending() { this.generation++; this.busy = false; }
  reset() {
    this.cancelPending();
    if (this.current) reconcileReward(this.storage, this.current);
    this.storage.removeItem(DATE_ADVENTURE_KEY); this.current = null;
  }
  private persist(a: DateAdventure) {
    try { this.storage.setItem(DATE_ADVENTURE_KEY, JSON.stringify(a)); }
    catch { throw Error('冒険を保存できませんでした。ブラウザの保存設定を確認して、もう一度試してください。'); }
    this.current = a;
  }
  async start(result: DateAdventure['result']) {
    if (this.busy) return null;
    const waypoint = targetOf(result.waypoint), final = targetOf(result.final);
    if (this.current && same(this.current.waypoint, waypoint) && same(this.current.final, final)) return this.current;
    if (!validTarget(waypoint) || !validTarget(final)) throw Error('目的地の位置を確認できませんでした。');
    const snapshot = JSON.parse(JSON.stringify(result)) as DateAdventure['result'];
    const generation = ++this.generation; this.busy = true;
    try {
      const departure = await this.locate();
      if (generation !== this.generation) return null;
      if (!validFix(departure)) throw Error('現在地を正確に確認できませんでした。少し待って、もう一度試してください。');
      const a: DateAdventure = { version: 1, id: crypto.randomUUID(), departure, startedAt: Date.now(),
        waypoint, final, result: snapshot, rewardClaimed: false };
      this.persist(a); return a;
    } finally { if (generation === this.generation) this.busy = false; }
  }
  async arrive(stage: 'waypoint' | 'final', expectedId: string | undefined): Promise<string> {
    if (this.busy) return '';
    const a = this.current;
    if (!a || a.id !== expectedId) return 'まず「経由地まで地図を開く」から冒険を始めよう！';
    if (stage === 'final' && !a.waypointArrival) return '先に経由地で到着を確認してください。';
    if (a.rewardClaimed) {
      try { reconcileReward(this.storage, a); return 'この冒険の報酬は取得済みです。'; }
      catch { return '報酬を保存できませんでした。もう一度確認してください。'; }
    }
    if (stage === 'waypoint' && a.waypointArrival) return '経由地の到着は確認済みです。';
    const generation = ++this.generation; this.busy = true;
    try {
      const fix = await this.locate();
      if (generation !== this.generation || this.current?.id !== a.id) return '';
      const saved = loadDateAdventure(this.storage);
      if (!saved || saved.id !== a.id) return '冒険が変更されています。画面を再読み込みしてください。';
      if (stage === 'final' && !saved.waypointArrival) return '先に経由地で到着を確認してください。';
      if (saved.rewardClaimed || (stage === 'waypoint' && saved.waypointArrival)) {
        this.current = saved; reconcileReward(this.storage, saved); return '到着は確認済みです。';
      }
      if (!validFix(fix)) return '現在地を正確に確認できませんでした。少し待って、もう一度試してください。';
      const distance = arrivalDistanceMeters(fix, a[stage]);
      if (distance > ARRIVAL_RADIUS_METERS) return '対象地点まであと約' + Math.ceil(distance) + 'm！ もう少し冒険を続けよう。';
      if (stage === 'waypoint') this.persist({ ...saved, waypointArrival: fix });
      else {
        const completed: DateAdventure = { ...saved, finalArrival: fix, completedAt: Date.now(), rewardClaimed: true,
          rewardTotals: { exp: numberFrom(this.storage, 'machiTakarabakoExp') + 50,
            count: numberFrom(this.storage, 'machiTakarabakoAdventureCount') + 1 } };
        this.persist(completed); reconcileReward(this.storage, completed);
      }
      return '到着を確認しました！';
    } catch (error) {
      if (generation !== this.generation) return '';
      return error instanceof Error ? error.message : '到着を確認・保存できませんでした。もう一度試してください。';
    } finally { if (generation === this.generation) this.busy = false; }
  }
}
