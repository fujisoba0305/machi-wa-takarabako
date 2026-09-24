import { calculateDistance } from './distance';
import type { Spot as OverpassSpot } from '../services/overpass';
import type { Treasure } from '../services/treasures';

type Spot = Omit<OverpassSpot, 'id' | 'type'> & { id?: number | string; type?: string };

export const ACTIVE_ADVENTURE_KEY = 'machiTakarabakoActiveAdventure';
export const ARRIVAL_RADIUS_METERS = 100;
export const MAX_ACCURACY_METERS = 50;
type Coordinates = { latitude: number; longitude: number };
export type PositionFix = Coordinates & { accuracy: number; timestamp: number };
export type AdventureTarget = Coordinates & { id: string; kind: 'normal' | 'treasure' };
export type AdventureResult = {
  spot: Spot | null;
  treasure: Treasure | null;
  choices: Record<string, string>;
  distanceKm: number | null;
  playerName?: string;
};
export type ActiveAdventure = {
  version: 1;
  id: string;
  target: AdventureTarget;
  departure: PositionFix;
  startedAt: number;
  rewardClaimed: boolean;
  completedAt?: number;
  arrival?: PositionFix;
  result: AdventureResult;
};
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const validCoordinates = (p: Coordinates) => p && Number.isFinite(p.latitude) &&
  Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
const validFix = (p: PositionFix) => validCoordinates(p) && Number.isFinite(p.accuracy) &&
  p.accuracy >= 0 && Number.isFinite(p.timestamp) && p.timestamp > 0;
export function loadActiveAdventure(storage: StorageLike): ActiveAdventure | null {
  try {
    const a = JSON.parse(storage.getItem(ACTIVE_ADVENTURE_KEY) || 'null');
    if (!a || a.version !== 1 || typeof a.id !== 'string' || !a.id ||
      !validCoordinates(a.target) || typeof a.target.id !== 'string' ||
      !['normal', 'treasure'].includes(a.target.kind) || !validFix(a.departure) ||
      !Number.isFinite(a.startedAt) || a.startedAt <= 0 || typeof a.rewardClaimed !== 'boolean' ||
      !a.result || !a.result.choices || typeof a.result.choices !== 'object' ||
      !Object.values(a.result.choices).every(v => typeof v === 'string') ||
      a.result.choices.mood === 'デート' ||
      (a.result.playerName !== undefined && typeof a.result.playerName !== 'string') ||
      (a.target.kind === 'normal' ? a.result.treasure !== null : a.result.spot !== null) ||
      (a.rewardClaimed && (!Number.isFinite(a.completedAt) || !validFix(a.arrival))) ||
      (a.result.distanceKm !== null && !Number.isFinite(a.result.distanceKm))) return null;
    const place = a.target.kind === 'treasure' ? a.result.treasure : a.result.spot;
    if (!place || (a.target.kind === 'treasure'
      ? String(place.id) !== a.target.id || place.latitude !== a.target.latitude || place.longitude !== a.target.longitude
      : place.type + ':' + place.id !== a.target.id ||
        (place.lat ?? place.center?.lat) !== a.target.latitude ||
        (place.lon ?? place.center?.lon) !== a.target.longitude)) return null;
    return a;
  } catch { return null; }
}

export function requestAdventurePosition(): Promise<PositionFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('この端末では現在地を取得できません。')); return; }
    navigator.geolocation.getCurrentPosition(position => {
      const fix = { latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy: position.coords.accuracy, timestamp: position.timestamp };
      if (!validFix(fix) || Date.now() - fix.timestamp > 30000 || fix.timestamp > Date.now() + 5000) {
        reject(new Error('新しい現在地を確認できませんでした。もう一度試してください。'));
      } else resolve(fix);
    }, () => reject(new Error('現在地を取得できませんでした。位置情報の許可を確認し、少し待ってもう一度試してください。')),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  });
}
export function arrivalDistanceMeters(fix: Coordinates, target: Coordinates) {
  return calculateDistance(fix.latitude, fix.longitude, target.latitude, target.longitude) * 1000;
}
const accuracyMessage = '現在地を正確に確認できませんでした。少し待って、もう一度試してください';
const sameTarget = (a: AdventureTarget, b: AdventureTarget) => a.kind === b.kind && a.id === b.id &&
  a.latitude === b.latitude && a.longitude === b.longitude;

// Owns request cancellation and persistence; it never opens Maps or awards rewards itself.
export class AdventureSession {
  current: ActiveAdventure | null;
  private generation = 0;
  private busy = false;
  constructor(private storage: StorageLike, private locate = requestAdventurePosition) {
    this.current = loadActiveAdventure(storage);
  }
  cancelPending() { this.generation++; this.busy = false; }
  reset() {
    this.cancelPending();
    this.storage.removeItem(ACTIVE_ADVENTURE_KEY);
    this.current = null;
  }
  private persist(a: ActiveAdventure) {
    try { this.storage.setItem(ACTIVE_ADVENTURE_KEY, JSON.stringify(a)); }
    catch { throw new Error('冒険を保存できませんでした。ブラウザの保存設定を確認して、もう一度試してください。'); }
    this.current = a;
  }
  async start(target: AdventureTarget, result: AdventureResult): Promise<ActiveAdventure | null> {
    if (this.busy) return null;
    if (this.current && sameTarget(this.current.target, target)) return this.current;
    if (!validCoordinates(target)) throw new Error('目的地の位置を確認できませんでした。');
    const fixedTarget = { ...target };
    const fixedResult: AdventureResult = JSON.parse(JSON.stringify(result));
    const generation = ++this.generation;
    this.busy = true;
    try {
      const departure = await this.locate();
      if (generation !== this.generation) return null;
      if (departure.accuracy > MAX_ACCURACY_METERS) throw new Error(accuracyMessage);
      const adventure: ActiveAdventure = { version: 1, id: crypto.randomUUID(),
        target: fixedTarget, departure, startedAt: Date.now(), rewardClaimed: false,
        result: fixedResult };
      this.persist(adventure);
      return adventure;
    } catch (error) {
      if (generation !== this.generation) return null;
      throw error;
    } finally { if (generation === this.generation) this.busy = false; }
  }
  async arrive(target: AdventureTarget | null, reward: (a: ActiveAdventure) => void): Promise<string> {
    if (this.busy) return '';
    const adventure = this.current;
    if (!adventure || !target || !sameTarget(adventure.target, target))
      return 'まず「ここへ行く」から冒険を始めよう！';
    if (adventure.rewardClaimed) return 'この冒険の報酬は取得済みです。';
    const generation = ++this.generation;
    this.busy = true;
    try {
      const fix = await this.locate();
      if (generation !== this.generation || this.current?.id !== adventure.id) return '';
      const saved = loadActiveAdventure(this.storage);
      if (!saved || saved.id !== adventure.id) return '冒険が変更されています。画面を再読み込みしてください。';
      if (saved.rewardClaimed) {
        this.current = saved;
        return 'この冒険の報酬は取得済みです。';
      }
      if (fix.accuracy > MAX_ACCURACY_METERS) return accuracyMessage;
      const distance = arrivalDistanceMeters(fix, adventure.target);
      if (distance > ARRIVAL_RADIUS_METERS)
        return '📍 目的地まであと約' + Math.ceil(distance) + 'm！ もう少し冒険を続けよう 🚶';
      // Persist the claim before side effects, so a reload cannot award this adventure again.
      const completed = { ...adventure, rewardClaimed: true, completedAt: Date.now(), arrival: fix };
      this.persist(completed);
      reward(completed);
      return '🎉 到着を確認しました！';
    } catch (error) {
      if (generation !== this.generation) return '';
      return error instanceof Error ? error.message : '現在地を確認できませんでした。もう一度試してください。';
    } finally { if (generation === this.generation) this.busy = false; }
  }
}
