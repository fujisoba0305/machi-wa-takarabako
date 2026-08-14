import type { Treasure } from '../services/treasures';
import { calculateDistance } from './distance';

export const TREASURE_MAP_RADIUS_KM = 3;

const categoryMarkers: Record<string, { icon: string; theme: string }> = {
'☕ カフェ': { icon: '☕', theme: 'cafe' },
'🍜 グルメ': { icon: '🍜', theme: 'gourmet' },
'⛩️ 神社・お寺': { icon: '⛩️', theme: 'shrine' },
'🌳 自然': { icon: '🌳', theme: 'nature' },
'📷 写真スポット': { icon: '📷', theme: 'photo' },
'🏪 お店': { icon: '🏪', theme: 'shop' },
'💎 その他': { icon: '💎', theme: 'other' },
};

const fallbackCategoryMarker = categoryMarkers['💎 その他'];

export function getTreasureCategoryMarker(category: string) {
return categoryMarkers[category] ?? fallbackCategoryMarker;
}

export function getTreasureCategoryIcon(category: string) {
return getTreasureCategoryMarker(category).icon;
}

export function hasValidTreasureCoordinates(treasure: Treasure) {
return Number.isFinite(treasure.latitude) && Number.isFinite(treasure.longitude);
}

export function getNearbyTreasures(
treasures: Treasure[],
currentLocation: { latitude: number; longitude: number },
radiusKm = TREASURE_MAP_RADIUS_KM
) {
return treasures.filter((treasure) =>
hasValidTreasureCoordinates(treasure) &&
calculateDistance(
currentLocation.latitude,
currentLocation.longitude,
treasure.latitude,
treasure.longitude
) <= radiusKm
);
}
