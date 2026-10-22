import { readPersonalDiscoveries, type PersonalDiscovery } from './personalDiscoveries';

export const TAKARAN_GROWTH_PREFIX = 'machiTakaranGrowth.v1:';
export const growthThresholds = [0, 1, 2, 3, 5, 7, 10, 13, 16, 20] as const;
export const routes = ['food', 'nature', 'history', 'city'] as const;
export type TakaranRoute = typeof routes[number];
export const routeLabels: Record<TakaranRoute, string> = { food: 'グルメ', nature: '自然', history: '歴史', city: '街' };
export const growthLines = [
  '一緒に宝物を探そう！', 'はじめての発見、うれしいね！', '冒険の準備はばっちり！',
  '知らない街も楽しくなってきた！', '羽に力が集まってきたよ！', '次はどんな宝物に会えるかな？',
  'なんだか姿が変わりそう！', 'きみの好きな冒険が分かってきた！', 'もうすぐ新しい自分に会えそう！',
  'これからも一緒に冒険しよう！',
];
type Store = Pick<Storage, 'getItem' | 'setItem'>;
type GrowthSave = { version: 1; uid: string; route: TakaranRoute | null; firstTwenty: string[]; acknowledgedStage: number };
const categoryRoutes: Record<string, TakaranRoute> = {
  '🍜 グルメ': 'food', '☕ カフェ': 'food',
  '🌿 自然・絶景': 'nature', '🏃 運動・リフレッシュ': 'nature', '🌳 自然': 'nature', '📷 写真スポット': 'nature',
  '🏯 歴史・文化': 'history', '🎨 アート・学び': 'history', '⛩️ 神社・お寺': 'history',
  '♨️ 温泉・癒やし': 'city', '🎡 遊び・エンタメ': 'city', '🛍️ 買い物・発見': 'city', '🔎 街の珍スポット': 'city', '🏪 お店': 'city',
};
export function growthRoute(category: string): TakaranRoute | null { return categoryRoutes[category] ?? null; }
// Only callers with a successfully read UID-scoped personal book use this pure calculation.
export function calculateTakaranGrowth(records: PersonalDiscovery[]) {
  const unique = new Map<string, PersonalDiscovery>();
  for (const record of records) {
    const previous = unique.get(record.key);
    if (!previous || Date.parse(record.firstDiscoveredAt) < Date.parse(previous.firstDiscoveredAt)) unique.set(record.key, record);
  }
  const ordered = [...unique.values()].sort((a, b) => Date.parse(a.firstDiscoveredAt) - Date.parse(b.firstDiscoveredAt) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const count = ordered.length;
  const level = growthThresholds.filter(n => count >= n).length;
  const counts: Record<TakaranRoute, number> = { food: 0, nature: 0, history: 0, city: 0 };
  // At Lv10 the first twenty discoveries determine the route, not the current majority.
  const eligible = count >= 20 ? ordered.slice(0, 20) : ordered;
  for (const record of eligible) { const route = growthRoute(record.treasure.category); if (route) counts[route]++; }
  const maximum = Math.max(...Object.values(counts));
  const leader = eligible.map(r => growthRoute(r.treasure.category)).find(r => r && counts[r] === maximum) ?? null;
  // If all first twenty are unclassified, wait for the first classified later discovery.
  const decision = count >= 20 ? leader ?? ordered.slice(20).map(r => growthRoute(r.treasure.category)).find(Boolean) ?? null : null;
  const floor = growthThresholds[level - 1];
  const next = growthThresholds[level];
  return { count, level, counts, leader, decision, firstTwenty: ordered.slice(0, 20).map(r => r.key),
    remaining: next === undefined ? 0 : next - count,
    progress: next === undefined ? 100 : Math.min(100, (count - floor) / (next - floor) * 100),
    stage: level >= 10 ? 10 : level >= 7 ? 7 : level >= 5 ? 5 : level >= 3 ? 3 : 0 };
}
function readSave(storage: Store, uid: string): GrowthSave | null {
  const raw = storage.getItem(TAKARAN_GROWTH_PREFIX + uid);
  if (raw === null) return null;
  const value = JSON.parse(raw) as GrowthSave;
  if (!value || value.version !== 1 || value.uid !== uid ||
    !(value.route === null || routes.includes(value.route)) || ![0, 3, 5, 7, 10].includes(value.acknowledgedStage) ||
    !Array.isArray(value.firstTwenty) || !value.firstTwenty.every(k => typeof k === 'string' && k.length > 0) ||
    new Set(value.firstTwenty).size !== value.firstTwenty.length ||
    !(value.firstTwenty.length === 0 || value.firstTwenty.length === 20) || (value.route !== null && value.firstTwenty.length !== 20)) throw Error('invalid growth');
  return value;
}
export type GrowthView = ReturnType<typeof loadTakaranGrowth>;
/** Writes ONLY the new growth namespace. Never modifies EXP, the book, auth or an adventure. */
export function loadTakaranGrowth(storage: Store, uid: string) {
  const book = readPersonalDiscoveries(storage, uid);
  const empty = { available: false, growth: null as ReturnType<typeof calculateTakaranGrowth> | null, route: null as TakaranRoute | null, pendingStage: 0, message: '' };
  if (!book.writable) return { ...empty, message: '育成情報を確認できません。元の発見記録は変更していません。' };
  let saved: GrowthSave | null;
  try { saved = readSave(storage, uid); } catch { return { ...empty, message: '育成の保存情報を読み取れません。初期化・上書きはしていません。' }; }
  const growth = calculateTakaranGrowth(book.records);
  if (saved?.route && growth.count < 20) return { ...empty, message: '確定済みの進化と発見記録の件数が一致しません。保存情報は保持しています。' };
  const route = saved?.route ?? growth.decision;
  const next: GrowthSave = saved ?? { version: 1, uid, route: null, firstTwenty: [], acknowledgedStage: 0 };
  const updated = { ...next, route, firstTwenty: route && !next.route ? growth.firstTwenty : next.firstTwenty };
  let writable = true;
  if (route && !next.route) {
    try {
      storage.setItem(TAKARAN_GROWTH_PREFIX + uid, JSON.stringify(updated));
      if (storage.getItem(TAKARAN_GROWTH_PREFIX + uid) !== JSON.stringify(updated)) throw Error('growth save not retained');
    }
    catch { writable = false; }
  }
  const confirmedRoute = writable ? route : saved?.route ?? null;
  const stage = growth.stage === 10 && !confirmedRoute ? (growth.level >= 7 ? 7 : 0) : growth.stage;
  return { available: true, growth, route: confirmedRoute, pendingStage: writable && stage > next.acknowledgedStage ? stage : 0,
    message: !writable ? '進化先を保存できませんでした。発見記録は保持しています。「育成情報を再確認」で再試行できます。' :
      growth.level === 10 && !confirmedRoute ? '進化先を確認中です。分類できる宝物を発見すると進化します。' : '' };
}
export function acknowledgeTakaranGrowth(storage: Store, uid: string, stage: number): boolean {
  if (![3, 5, 7, 10].includes(stage)) return false;
  try {
    const view = loadTakaranGrowth(storage, uid);
    if (!view.available || !view.growth || stage > view.growth.stage || (stage === 10 && !view.route)) return false;
    const saved = readSave(storage, uid) ?? { version: 1 as const, uid, route: null, firstTwenty: [], acknowledgedStage: 0 };
    if (saved.acknowledgedStage >= stage) return true;
    const raw = JSON.stringify({ ...saved, acknowledgedStage: stage });
    storage.setItem(TAKARAN_GROWTH_PREFIX + uid, raw);
    return storage.getItem(TAKARAN_GROWTH_PREFIX + uid) === raw;
  } catch { return false; }
}
