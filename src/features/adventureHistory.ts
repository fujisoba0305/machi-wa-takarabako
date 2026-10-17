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

export const LEGACY_DISCOVERY_BACKUP_KEY='machiLegacyDiscoveryBackup.v1';
/** Read-only audit: unreadable data is never reported as zero discoveries. */
export function inspectLegacyDiscoveries(storage: Pick<Storage,'getItem'>){
 try{const raw=storage.getItem(ADVENTURE_HISTORY_STORAGE_KEY);if(raw===null)return {state:'absent' as const,records:[] as AdventureDiscovery[],rawCount:0,invalidCount:0,duplicateCount:0};let value:unknown;try{value=JSON.parse(raw);}catch{return {state:'invalid' as const,records:[] as AdventureDiscovery[],rawCount:null,invalidCount:null,duplicateCount:0};}if(!Array.isArray(value))return {state:'invalid' as const,records:[] as AdventureDiscovery[],rawCount:null,invalidCount:null,duplicateCount:0};const valid=value.filter(isAdventureDiscovery);const records=parseAdventureHistory(raw);return {state:valid.length===value.length?'readable' as const:'partial' as const,records,rawCount:value.length,invalidCount:value.length-valid.length,duplicateCount:valid.length-records.length};}catch{return {state:'unavailable' as const,records:[] as AdventureDiscovery[],rawCount:null,invalidCount:null,duplicateCount:0};}
}
/** Append only: preserve every original row/date, and snapshot before the first change. */
export function saveAdventureHistory(history: AdventureDiscovery[], storage: StorageLike = localStorage) {
 if(!history.every(isAdventureDiscovery))throw Error('旧履歴への保存内容を確認できません。元データを保持しました。');
 const raw=storage.getItem(ADVENTURE_HISTORY_STORAGE_KEY);let existing:AdventureDiscovery[]=[];
 if(raw!==null){let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw Error('旧履歴を読み取れません。元データを保持しました。');}if(!Array.isArray(parsed)||!parsed.every(isAdventureDiscovery))throw Error('旧履歴を検証できません。元データを保持しました。');existing=parsed;}
 const merged=[...existing],seen=new Set(existing.map(r=>r.treasureId));for(const item of history)if(!seen.has(item.treasureId)){merged.push(item);seen.add(item.treasureId);}
 if(merged.length===existing.length)return existing;
 if(raw!==null&&storage.getItem(LEGACY_DISCOVERY_BACKUP_KEY)===null)storage.setItem(LEGACY_DISCOVERY_BACKUP_KEY,raw);
 storage.setItem(ADVENTURE_HISTORY_STORAGE_KEY,JSON.stringify(merged));return merged;
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
