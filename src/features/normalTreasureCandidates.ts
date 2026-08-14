import type { Treasure } from '../services/treasures';
import { calculateDistance } from './distance';

export const REGISTERED_TREASURE_SOURCE_WEIGHT = 0.5;

const treasureCategoriesByMood: Record<string, string[]> = {
カフェ: ['☕ カフェ'],
自然: ['🌳 自然'],
写真: ['📷 写真スポット'],
ストレス解消: ['🌳 自然'],
'神社・お寺': ['⛩️ 神社・お寺'],
グルメ: ['🍜 グルメ'],
おまかせ: [
'☕ カフェ',
'🍜 グルメ',
'⛩️ 神社・お寺',
'🌳 自然',
'📷 写真スポット',
'🏪 お店',
'💎 その他',
],
};

export type RegisteredTreasureCandidate = {
source: 'treasure';
treasure: Treasure;
distanceKm: number;
};

export async function loadNormalSearchSources<T>(
loadOverpass: () => Promise<T[]>,
loadTreasures: () => Promise<Treasure[]>
) {
const [overpassResult, treasuresResult] = await Promise.allSettled([
loadOverpass(),
loadTreasures(),
]);

return {
overpass: overpassResult.status === 'fulfilled' ? overpassResult.value : [],
treasures: treasuresResult.status === 'fulfilled' ? treasuresResult.value : [],
overpassError: overpassResult.status === 'rejected' ? overpassResult.reason : null,
treasuresError: treasuresResult.status === 'rejected' ? treasuresResult.reason : null,
};
}

export function matchesTreasureMood(category: string, mood: string) {
return treasureCategoriesByMood[mood]?.includes(category) ?? false;
}

export function getEligibleRegisteredTreasures(
treasures: Treasure[],
currentLocation: { latitude: number; longitude: number },
mood: string,
distanceRangeKm: { min: number; max: number }
): RegisteredTreasureCandidate[] {
return treasures.flatMap((treasure) => {
if (
!Number.isFinite(treasure.latitude) ||
!Number.isFinite(treasure.longitude) ||
!matchesTreasureMood(treasure.category, mood)
) {
return [];
}

const distanceKm = calculateDistance(
currentLocation.latitude,
currentLocation.longitude,
treasure.latitude,
treasure.longitude
);

if (distanceKm < distanceRangeKm.min || distanceKm > distanceRangeKm.max) {
return [];
}

return [{ source: 'treasure' as const, treasure, distanceKm }];
});
}

export function selectNormalSearchCandidate<T>(
overpassCandidates: T[],
treasureCandidates: RegisteredTreasureCandidate[],
random = Math.random
): { source: 'overpass'; candidate: T } | RegisteredTreasureCandidate | null {
if (overpassCandidates.length === 0 && treasureCandidates.length === 0) return null;

const useTreasure =
treasureCandidates.length > 0 &&
(overpassCandidates.length === 0 || random() < REGISTERED_TREASURE_SOURCE_WEIGHT);

if (useTreasure) {
return treasureCandidates[Math.floor(random() * treasureCandidates.length)];
}

return {
source: 'overpass',
candidate: overpassCandidates[Math.floor(random() * overpassCandidates.length)],
};
}
