import { describe, expect, it } from 'vitest';
import { PERSONAL_DISCOVERIES_PREFIX, type PersonalDiscovery } from './personalDiscoveries';
import { saveArrivedDiscovery } from './personalDiscoveries';
import { AdventureSession } from './activeAdventure';
import { acknowledgeTakaranGrowth, calculateTakaranGrowth, growthRoute, growthThresholds, loadTakaranGrowth, TAKARAN_GROWTH_PREFIX } from './takaranGrowth';
function store() { const data = new Map<string, string>(); return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } }; }
export function discoveries(n: number, category = '☕ カフェ'): PersonalDiscovery[] {
  return Array.from({ length: n }, (_, i) => ({ key: 'treasure:' + (i + 1), source: 'treasure' as const, adventureId: 'arrival-' + i, firstDiscoveredAt: new Date(100000 + i * 1000).toISOString(), treasure: { id: i + 1, name: '発見済み', category, comment: '', latitude: 35, longitude: 139, image_url: null } }));
}
function book(s: ReturnType<typeof store>, records: PersonalDiscovery[], uid = 'a') { s.setItem(PERSONAL_DISCOVERIES_PREFIX + uid, JSON.stringify({ version: 1, discovererUid: uid, records })); }
describe('UID-scoped Takaran growth', () => {
  it.each(growthThresholds.map((n, i) => [n, i + 1]))('%i discoveries yield Lv%i without EXP', (count, level) => {
    const g = calculateTakaranGrowth(discoveries(count)); expect(g.level).toBe(level); expect(g.count).toBe(count); expect(g.progress).toBe(level === 10 ? 100 : 0);
  });
  it('preserves all discoveries above cap and calculates progress inside a band', () => {
    expect(calculateTakaranGrowth(discoveries(4))).toMatchObject({ level: 4, remaining: 1, progress: 50 });
    expect(calculateTakaranGrowth(discoveries(45))).toMatchObject({ level: 10, count: 45, remaining: 0, progress: 100 });
  });
  it.each([['🍜 グルメ', 'food'], ['☕ カフェ', 'food'], ['🌿 自然・絶景', 'nature'], ['🌳 自然', 'nature'], ['📷 写真スポット', 'nature'], ['🏃 運動・リフレッシュ', 'nature'], ['🏯 歴史・文化', 'history'], ['⛩️ 神社・お寺', 'history'], ['🎨 アート・学び', 'history'], ['♨️ 温泉・癒やし', 'city'], ['🎡 遊び・エンタメ', 'city'], ['🛍️ 買い物・発見', 'city'], ['🔎 街の珍スポット', 'city'], ['🏪 お店', 'city']])('maps %s to %s without rewriting categories', (category, route) => expect(growthRoute(category)).toBe(route));
  it('unclassified discoveries grow level but never cast a route vote', () => {
    for (const category of ['💎 その他', '💎 その他の宝物', '', 'unknown']) expect(growthRoute(category)).toBeNull();
    expect(calculateTakaranGrowth(discoveries(20, '💎 その他'))).toMatchObject({ level: 10, decision: null, leader: null });
  });
  it('deduplicates repeat discoveries and prioritizes earliest chronological discovery in a tie', () => {
    const rows = discoveries(20); rows.slice(0, 10).forEach(r => { r.treasure.category = '🌳 自然'; });
    const g = calculateTakaranGrowth([...rows.slice().reverse(), rows[0]]); expect(g.count).toBe(20); expect(g.decision).toBe('nature');
    rows.forEach(r => { r.firstDiscoveredAt = rows[0].firstDiscoveredAt; });
    expect(calculateTakaranGrowth(rows).decision).toBe(calculateTakaranGrowth(rows.slice().reverse()).decision);
  });
  it('first twenty decide route even if later majority changes; reload never changes a confirmed route', () => {
    const s = store(), rows = discoveries(20, '🌳 自然'); book(s, rows);
    expect(loadTakaranGrowth(s, 'a').route).toBe('nature'); const saved = s.getItem(TAKARAN_GROWTH_PREFIX + 'a');
    const more = discoveries(80).map((r, i) => ({ ...r, key: 'treasure:' + (i + 21), treasure: { ...r.treasure, id: i + 21 }, firstDiscoveredAt: new Date(200000 + i * 1000).toISOString() }));
    book(s, [...rows, ...more]); expect(loadTakaranGrowth(s, 'a')).toMatchObject({ route: 'nature', growth: { count: 100 } });
    expect(s.getItem(TAKARAN_GROWTH_PREFIX + 'a')).toBe(saved);
  });
  it('waits if first twenty are unknown, then locks the first classified later discovery', () => {
    const s = store(), rows = discoveries(21, '💎 その他'); book(s, rows); expect(loadTakaranGrowth(s, 'a').route).toBeNull();
    rows[20].treasure.category = '🏪 お店'; book(s, rows); expect(loadTakaranGrowth(s, 'a').route).toBe('city');
  });
  it('isolates accounts and leaves EXP, all books, legacy backups, date adventures and auth byte-identical', () => {
    const s = store(); for (const k of ['machiTakarabakoExp', 'machiTakarabakoDiscoveredTreasures', 'machiLegacyDiscoveryBackup.v1', 'machiTakarabakoDateAdventure', 'machiAccountAuth.v1']) s.setItem(k, 'preserve');
    book(s, discoveries(20)); book(s, discoveries(2), 'b'); const original = new Map(s.data);
    expect(loadTakaranGrowth(s, 'a').route).toBe('food'); expect(loadTakaranGrowth(s, 'b')).toMatchObject({ route: null, growth: { count: 2 } });
    acknowledgeTakaranGrowth(s, 'a', 10);
    for (const [k, v] of original) expect(s.getItem(k)).toBe(v);
    expect(loadTakaranGrowth(s, 'missing').growth?.count).toBe(0);
  });
  it('ignores posted/shared treasures and UID-less or date history when no personal book exists', () => {
    const s = store(); s.setItem('machiTakarabakoDiscoveredTreasures', JSON.stringify(discoveries(30))); s.setItem('machiTakarabakoDateAdventure', JSON.stringify(discoveries(30)));
    expect(loadTakaranGrowth(s, 'a')).toMatchObject({ route: null, growth: { count: 0, level: 1 } });
    expect(s.data.size).toBe(2);
  });
  it('does not overwrite malformed books, mismatched UIDs or malformed growth state', () => {
    for (const raw of ['broken', JSON.stringify({ version: 1, discovererUid: 'b', records: [] })]) {
      const s = store(); s.setItem(PERSONAL_DISCOVERIES_PREFIX + 'a', raw); expect(loadTakaranGrowth(s, 'a').available).toBe(false); expect(s.getItem(PERSONAL_DISCOVERIES_PREFIX + 'a')).toBe(raw);
    }
    const s = store(); book(s, discoveries(20)); s.setItem(TAKARAN_GROWTH_PREFIX + 'a', 'broken');
    expect(loadTakaranGrowth(s, 'a').available).toBe(false); expect(acknowledgeTakaranGrowth(s, 'a', 10)).toBe(false); expect(s.getItem(TAKARAN_GROWTH_PREFIX + 'a')).toBe('broken');
  });
  it('keeps the book intact on write failure and can retry route saving safely', () => {
    const s = store(); book(s, discoveries(20)); const original = new Map(s.data);
    const failed = { getItem: s.getItem, setItem: () => { throw Error('quota'); } };
    expect(loadTakaranGrowth(failed, 'a')).toMatchObject({ available: true, route: null, pendingStage: 0 }); expect(acknowledgeTakaranGrowth(failed, 'a', 10)).toBe(false);
    expect(s.data).toEqual(original); expect(loadTakaranGrowth(s, 'a').route).toBe('food');
  });
  it('plays only the highest reached milestone for established users, and acknowledges once', () => {
    const s = store(); book(s, discoveries(30)); expect(loadTakaranGrowth(s, 'a').pendingStage).toBe(10);
    expect(acknowledgeTakaranGrowth(s, 'a', 10)).toBe(true); expect(loadTakaranGrowth(s, 'a').pendingStage).toBe(0);
    expect(acknowledgeTakaranGrowth(s, 'a', 3)).toBe(true); expect(loadTakaranGrowth(s, 'a').pendingStage).toBe(0);
    book(s, discoveries(2), 'b'); expect(acknowledgeTakaranGrowth(s, 'b', 10)).toBe(false);
  });
  it('never resets an already confirmed evolution if the book disappears', () => {
    const s = store(); book(s, discoveries(20)); loadTakaranGrowth(s, 'a'); const before = s.getItem(TAKARAN_GROWTH_PREFIX + 'a');
    book(s, []); expect(loadTakaranGrowth(s, 'a').available).toBe(false); expect(s.getItem(TAKARAN_GROWTH_PREFIX + 'a')).toBe(before);
  });
  it('grows only after the real arrival pipeline accepts GPS, never on posting, selection or re-arrival', async () => {
    const data = new Map<string, string>();
    const s = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
    let fix = { latitude: 35, longitude: 139, accuracy: 5, timestamp: Date.now() }, exp = 0;
    const session = new AdventureSession(s, async () => fix);
    const target = { id: '1', kind: 'treasure' as const, latitude: 35, longitude: 139 };
    await session.start(target, { discovererUid: 'a', spot: null, treasure: discoveries(1)[0].treasure, choices: { mood: 'カフェ' }, distanceKm: 1 });
    const reward = () => { saveArrivedDiscovery(s, 'a', session.current); exp += 30; };
    expect(loadTakaranGrowth(s, 'a').growth?.count).toBe(0);
    fix = { ...fix, latitude: 36 }; await session.arrive(target, reward); expect(loadTakaranGrowth(s, 'a').growth?.count).toBe(0);
    fix = { ...fix, latitude: 35, accuracy: 51 }; await session.arrive(target, reward); expect(loadTakaranGrowth(s, 'a').growth?.count).toBe(0);
    fix = { ...fix, accuracy: 5 }; await session.arrive(target, reward); expect(loadTakaranGrowth(s, 'a').growth?.level).toBe(2);
    await session.arrive(target, reward); expect(loadTakaranGrowth(s, 'a').growth?.count).toBe(1); expect(exp).toBe(30);
  });
  it('does not claim evolution if a storage implementation silently drops writes', () => {
    const s = store(); book(s, discoveries(20));
    const silent = { getItem: s.getItem, setItem: () => {} };
    expect(loadTakaranGrowth(silent, 'a')).toMatchObject({ route: null, pendingStage: 0 });
    expect(acknowledgeTakaranGrowth(silent, 'a', 10)).toBe(false);
  });
});
