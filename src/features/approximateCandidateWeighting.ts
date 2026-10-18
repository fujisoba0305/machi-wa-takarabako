import { REGISTERED_TREASURE_SOURCE_WEIGHT, type RegisteredTreasureCandidate } from './normalTreasureCandidates';

// Internal ranking estimate only. Never use for displayed distance or GPS arrival.
export const APPROXIMATE_WALK_FACTOR = 1.1435;
export const APPROXIMATE_UNIFORM_SHARE = 0.2;
export const APPROXIMATE_MAX_CANDIDATE_SHARE = 0.65;

/** Input has already passed the existing straight-distance/category filters. */
export function approximateCandidateProbabilities(distancesKm: readonly number[], targetKm: number): number[] {
  if (!distancesKm.length) return [];
  if (!Number.isFinite(targetKm) || targetKm <= 0 || distancesKm.some(d => !Number.isFinite(d) || d < 0)) {
    throw new Error('抽選候補の距離を確認できませんでした。条件を保って再試行してください。');
  }
  const sigmaKm = Math.max(0.25, targetKm * 0.1);
  const logs = distancesKm.map(d => -0.5 * ((d * APPROXIMATE_WALK_FACTOR - targetKm) / sigmaKm) ** 2);
  // Normalize relative to the best candidate, avoiding underflow for sparse pools.
  const maxLog = logs.reduce((best, v) => Math.max(best, v), -Infinity);
  const weights = logs.map(v => Math.exp(v - maxLog));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const normalized = weights.map(w => w / total);
  const peak = normalized.reduce((best, p) => Math.max(best, p), 0);
  // For multiple candidates, prevent one POI from monopolizing repeated draws.
  const uniformShare = normalized.length > 1 && peak > APPROXIMATE_MAX_CANDIDATE_SHARE
    ? Math.max(APPROXIMATE_UNIFORM_SHARE, (peak - APPROXIMATE_MAX_CANDIDATE_SHARE) / (peak - 1 / normalized.length))
    : APPROXIMATE_UNIFORM_SHARE;
  return normalized.map(p => uniformShare / normalized.length + (1 - uniformShare) * p);
}

export function selectApproximateWeighted<T extends { distanceKm: number }>(candidates: T[], targetKm: number, random = Math.random): T | null {
  if (!candidates.length) return null;
  const probabilities = approximateCandidateProbabilities(candidates.map(c => c.distanceKm), targetKm);
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('抽選値を確認できませんでした。');
  let cumulative = 0;
  for (let i = 0; i < candidates.length; i++) {
    cumulative += probabilities[i];
    if (draw < cumulative) return candidates[i];
  }
  return candidates[candidates.length - 1]; // Floating-point rounding only.
}

/** Keep the existing 50% source branch; weight only within the selected source. */
export function selectApproximateSearchCandidate<T extends { distanceKm: number }>(
  general: T[], registered: RegisteredTreasureCandidate[], targetKm: number, random = Math.random
): { source: 'overpass'; candidate: T } | RegisteredTreasureCandidate | null {
  if (!general.length && !registered.length) return null;
  const useTreasure = registered.length > 0 && (!general.length || random() < REGISTERED_TREASURE_SOURCE_WEIGHT);
  if (useTreasure) return selectApproximateWeighted(registered, targetKm, random);
  const candidate = selectApproximateWeighted(general, targetKm, random);
  return candidate ? { source: 'overpass', candidate } : null;
}
