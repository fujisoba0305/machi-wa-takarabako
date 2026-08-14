import { describe, expect, it, vi } from 'vitest';
import {
getTreasureDiscoveryMessage,
getTreasureDiscoveryTargetId,
updateTreasureDiscoveryWithoutBlocking,
} from './treasureDiscovery';

describe('treasure discovery count message', () => {
it('shows the first-discovery message for zero', () => {
expect(getTreasureDiscoveryMessage(0)).toBe('✨ まだ誰も発見していない宝物です');
});

it('shows the recorded count for one or more discoveries', () => {
expect(getTreasureDiscoveryMessage(1)).toBe('👣 この宝物は 1回 発見されています');
expect(getTreasureDiscoveryMessage(12)).toBe('👣 この宝物は 12回 発見されています');
});

it('targets only a selected registered treasure with an ID', () => {
expect(getTreasureDiscoveryTargetId(null)).toBeNull();
expect(getTreasureDiscoveryTargetId({
id: 42,
name: '宝物',
comment: '',
category: '💎 その他',
latitude: 35,
longitude: 139,
image_url: null,
discovery_count: 0,
})).toBe(42);
});

it('does not propagate an update failure into the arrival flow', async () => {
const onSuccess = vi.fn();
const onError = vi.fn();

await expect(updateTreasureDiscoveryWithoutBlocking(
async () => { throw new Error('RPC failed'); },
onSuccess,
onError
)).resolves.toBeUndefined();
expect(onSuccess).not.toHaveBeenCalled();
expect(onError).toHaveBeenCalledOnce();
});
});
