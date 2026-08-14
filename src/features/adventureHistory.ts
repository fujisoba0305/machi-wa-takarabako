import type { Treasure } from '../services/treasures';
import type { TreasureCollectionItem } from './treasureCollection';

export const ADVENTURE_HISTORY_STORAGE_KEY = 'machiTakarabakoDiscoveredTreasures';

export type AdventureDiscovery = {
treasureId: number;
firstDiscoveredAt: string;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function isAdventureDiscovery(value: unknown): value is AdventureDiscovery {
if (!value || typeof value !== 'object') return false;
const item = value as Partial<AdventureDiscovery>;
return Number.isInteger(item.treasureId) && item.treasureId! > 0 &&
typeof item.firstDiscoveredAt === 'string' &&
Number.isFinite(Date.parse(item.firstDiscoveredAt));
}

export function parseAdventureHistory(raw: string | null): AdventureDiscovery[] {
if (!raw) return [];
try {
const value: unknown = JSON.parse(raw);
if (!Array.isArray(value)) return [];
const unique = new Map<number, AdventureDiscovery>();
for (const item of value) {
if (isAdventureDiscovery(item) && !unique.has(item.treasureId)) unique.set(item.treasureId, item);
}
return [...unique.values()];
} catch {
return [];
}
}

export function loadAdventureHistory(storage: StorageLike = localStorage) {
try {
return parseAdventureHistory(storage.getItem(ADVENTURE_HISTORY_STORAGE_KEY));
} catch {
return [];
}
}

export function addAdventureDiscovery(
history: AdventureDiscovery[],
treasureId: number,
firstDiscoveredAt: string
) {
if (!Number.isInteger(treasureId) || treasureId <= 0 || !Number.isFinite(Date.parse(firstDiscoveredAt))) {
return history;
}
if (history.some((item) => item.treasureId === treasureId)) return history;
return [...history, { treasureId, firstDiscoveredAt }];
}

export function saveAdventureHistory(history: AdventureDiscovery[], storage: StorageLike = localStorage) {
storage.setItem(ADVENTURE_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

export function recordArrivedTreasure(
history: AdventureDiscovery[],
treasure: Treasure | null,
hasArrivalSucceeded: boolean,
now = new Date()
) {
if (!hasArrivalSucceeded || treasure?.id === undefined) return history;
return addAdventureDiscovery(history, treasure.id, now.toISOString());
}

export type AdventureCollectionItem = TreasureCollectionItem & AdventureDiscovery;

export function joinAdventureHistory(
history: AdventureDiscovery[],
collection: TreasureCollectionItem[]
): AdventureCollectionItem[] {
const itemsById = new Map(
collection
.filter((item) => item.treasure.id !== undefined)
.map((item) => [item.treasure.id!, item] as const)
);
return history.flatMap((discovery) => {
const item = itemsById.get(discovery.treasureId);
return item ? [{ ...item, ...discovery }] : [];
});
}

export function formatAdventureDiscoveryDate(isoDate: string) {
const date = new Date(isoDate);
if (!Number.isFinite(date.getTime())) return '';
return new Intl.DateTimeFormat('ja-JP', {
year: 'numeric', month: 'long', day: 'numeric',
timeZone: 'Asia/Tokyo',
}).format(date);
}
