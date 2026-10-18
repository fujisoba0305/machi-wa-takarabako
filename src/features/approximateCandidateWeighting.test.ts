import { describe, expect, it } from 'vitest';
import { APPROXIMATE_WALK_FACTOR, approximateCandidateProbabilities, selectApproximateSearchCandidate, selectApproximateWeighted } from './approximateCandidateWeighting';
const seeded = (seed = 12345) => () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32);

describe('local approximate weighted draw', () => {
  it.each([1, 3, 5, 10])('prefers a corrected distance near %skm and retains every candidate', target => {
    const distances = [target / APPROXIMATE_WALK_FACTOR, target / APPROXIMATE_WALK_FACTOR * 0.8, target / APPROXIMATE_WALK_FACTOR * 1.2];
    const p = approximateCandidateProbabilities(distances, target);
    expect(p[0]).toBeGreaterThan(p[1]); expect(p[1]).toBeCloseTo(p[2], 12);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(p.every(x => x >= 0.2 / p.length)).toBe(true);
    expect(p[0]).toBeLessThanOrEqual(0.65 + 1e-12);
  });
  it('handles no candidates, a single candidate and equal distances without changing input', () => {
    expect(selectApproximateWeighted([], 1)).toBeNull();
    const one = [{ distanceKm: 1.4 }]; expect(selectApproximateWeighted(one, 1, () => 0.999)).toBe(one[0]);
    expect(approximateCandidateProbabilities([1, 1, 1], 1)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(one).toEqual([{ distanceKm: 1.4 }]);
  });
  it('normalizes very small weights and rejects invalid distances', () => {
    const sparse = approximateCandidateProbabilities([100, 101], 1);
    expect(sparse.every(Number.isFinite)).toBe(true);
    expect(Math.max(...sparse)).toBeLessThanOrEqual(0.65 + 1e-12);
    for (const d of [NaN, Infinity, -1]) expect(() => approximateCandidateProbabilities([d], 1)).toThrow('距離');
    expect(() => approximateCandidateProbabilities([1], 0)).toThrow('距離');
  });
  it('uses the existing exact 50% source boundary independently of distances and pool sizes', () => {
    const general = [{ distanceKm: 1 }, { distanceKm: 1.4 }];
    const treasure = { source: 'treasure' as const, treasure: { id: 7 } as any, distanceKm: 1.4 };
    let values = [0.499999, 0.9]; expect(selectApproximateSearchCandidate(general, [treasure], 1, () => values.shift()!)?.source).toBe('treasure');
    values = [0.5, 0.9]; expect(selectApproximateSearchCandidate(general, [treasure], 1, () => values.shift()!)?.source).toBe('overpass');
    expect(selectApproximateSearchCandidate([], [treasure], 1, () => 0.8)).toBe(treasure);
    expect(selectApproximateSearchCandidate(general, [], 1, () => 0.8)?.source).toBe('overpass');
    expect(selectApproximateSearchCandidate([], [], 1)).toBeNull();
  });
  it('matches weighted probabilities over repeated draws, including the lowest weight candidate', () => {
    const candidates = [0.5, 0.875, 1.5].map(distanceKm => ({ distanceKm }));
    const expected = approximateCandidateProbabilities(candidates.map(c => c.distanceKm), 1), counts = [0, 0, 0], random = seeded();
    for (let i = 0; i < 50000; i++) counts[candidates.indexOf(selectApproximateWeighted(candidates, 1, random)!)]++;
    counts.forEach((n, i) => expect(Math.abs(n / 50000 - expected[i])).toBeLessThan(0.01));
    expect(counts.every(n => n > 0)).toBe(true);
  });
  it('keeps the registered source near 50% over repeated draws', () => {
    const random = seeded(987), general = [{ distanceKm: 0.5 }], registered = [{ source: 'treasure' as const, treasure: { id: 9 } as any, distanceKm: 1.4 }];
    let count = 0; for (let i = 0; i < 20000; i++) if (selectApproximateSearchCandidate(general, registered, 1, random)?.source === 'treasure') count++;
    expect(Math.abs(count / 20000 - 0.5)).toBeLessThan(0.015);
  });
});
