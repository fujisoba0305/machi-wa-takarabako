import type { Treasure } from '../services/treasures';

export function getTreasureDiscoveryMessage(discoveryCount: number) {
if (discoveryCount === 0) {
return '✨ まだ誰も発見していない宝物です';
}

return `👣 この宝物は ${discoveryCount}回 発見されています`;
}

export function getTreasureDiscoveryTargetId(treasure: Treasure | null) {
return treasure?.id ?? null;
}

export async function updateTreasureDiscoveryWithoutBlocking(
update: () => Promise<number>,
onSuccess: (discoveryCount: number) => void,
onError: (error: unknown) => void
) {
try {
onSuccess(await update());
} catch (error) {
onError(error);
}
}
