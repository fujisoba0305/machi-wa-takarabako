import type { Treasure } from '../services/treasures';

const categoryIcons: Record<string, string> = {
'☕ カフェ': '☕', '🍜 グルメ': '🍜', '⛩️ 神社・お寺': '⛩️',
'🌳 自然': '🌳', '📷 写真スポット': '📷', '🏪 お店': '🏪', '💎 その他': '💎',
};

export function getTreasureCategoryIcon(category: string) {
return categoryIcons[category] ?? '💎';
}

export function hasValidTreasureCoordinates(treasure: Treasure) {
return Number.isFinite(treasure.latitude) && Number.isFinite(treasure.longitude);
}
