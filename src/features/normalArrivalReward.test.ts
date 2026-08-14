import { describe, expect, it } from 'vitest';
import { claimNormalArrivalOnce, getNormalArrivalRewardExp } from './normalArrivalReward';

describe('normal arrival EXP reward', () => {
it('keeps the Overpass spot reward at 20 EXP', () => {
expect(getNormalArrivalRewardExp(false)).toBe(20);
});

it('awards 30 EXP for a registered treasure', () => {
expect(getNormalArrivalRewardExp(true)).toBe(30);
});

it('allows the same arrival result to be claimed only once', () => {
const claimed = { current: false };

expect(claimNormalArrivalOnce(claimed)).toBe(true);
expect(claimNormalArrivalOnce(claimed)).toBe(false);
});
});
