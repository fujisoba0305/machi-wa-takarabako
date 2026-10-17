import exclusions from '../data/staticFacilityExclusions.json';
import { hasInactiveFacilitySignal } from '../features/facilityAvailability';
import manifest from '../data/staticFacilityManifest.json';
import definitions from '../data/staticFacilityConditions.json';
import { calculateDistance } from '../features/distance';
import type { Spot } from './overpass';

type Point = { latitude: number; longitude: number };
type Choices = { mood: string; distance: string; foodGenre?: string; eventGenre?: string; shrineGenre?: string };
type Row = Spot & { type: string; id: number; lat: number; lon: number; canonical: string; tags: Record<string, string> };
type Region = { features: { geometry: { coordinates: number[][][][] } }[] };
type Dataset = { version: string; records: Row[] };
type Index = Map<string, Row[]>;
let regionTask: Promise<Region> | null = null;
let datasetTask: Promise<Index> | null = null;
const loadingStage = { coverage: 'idle', dataset: 'idle' };
export function staticFacilityLoadStage() { return { ...loadingStage }; }
export class StaticFacilityError extends Error {
  constructor() { super('静的施設データを読み込めませんでした。条件を保ったまま、もう一度お試しください。'); this.name = 'StaticFacilityError'; }
}
export function localStaticSearchEnabled() {
  // Keep the existing switch for rollback; the verified provider also runs in production.
  return import.meta.env.VITE_LOCAL_STATIC_SEARCH !== 'off';
}
export function needsLocalStaticLookup(point: Point, choices: Choices) {
  return localStaticSearchEnabled() && choices.distance === '？km' && choices.mood !== 'デート' &&
    manifest.boxes.some(([west, south, east, north]) => point.longitude >= west && point.longitude <= east && point.latitude >= south && point.latitude <= north);
}
function insideRing(point: Point, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i], [px, py] = ring[j];
    const cross = (point.longitude - x) * (py - y) - (point.latitude - y) * (px - x);
    if (Math.abs(cross) < 1e-12 && point.longitude >= Math.min(x, px) && point.longitude <= Math.max(x, px) && point.latitude >= Math.min(y, py) && point.latitude <= Math.max(y, py)) return true;
    if ((y > point.latitude) !== (py > point.latitude) && point.longitude < (px - x) * (point.latitude - y) / (py - y) + x) inside = !inside;
  }
  return inside;
}
export function isInsideStaticRegion(point: Point, region: Region) {
  return region.features.some(f => f.geometry.coordinates.some(p => insideRing(point, p[0]) && !p.slice(1).some(h => insideRing(point, h))));
}
async function verifiedJSON(asset: { url: string; sha256: string }) {
  const label = asset.url === manifest.dataset.url ? 'dataset' : 'coverage';
  const started = performance.now(); loadingStage[label] = 'requesting';
  try {
  const response = await fetch(asset.url, { integrity: 'sha256-' + btoa(asset.sha256.match(/../g)!.map(h => String.fromCharCode(parseInt(h, 16))).join('')) });
  if (!response.ok) throw new StaticFacilityError();
  const headersAt = performance.now(); loadingStage[label] = 'body-and-parse';
  const data = await response.json(); loadingStage[label] = 'loaded';
  console.info('[facility-data]', { asset: label, phase: 'loaded', headerMs: Math.round(headersAt-started), bodyAndParseMs: Math.round(performance.now()-headersAt) });
  return data;
  } catch (error) { loadingStage[label] = 'failed'; throw error; }
}
async function region() {
  if (!regionTask) regionTask = verifiedJSON(manifest.region).then(data => {
    if (!data || !Array.isArray(data.features) || !data.features.length) throw new StaticFacilityError();
    return data as Region;
  }).catch(() => { regionTask = null; throw new StaticFacilityError(); });
  return regionTask;
}
function cell(lat: number, lon: number) { return `${Math.floor(lat * 100)}:${Math.floor(lon * 100)}`; }
async function index() {
  if (!datasetTask) datasetTask = verifiedJSON(manifest.dataset).then((data: Dataset) => {
    const started = performance.now(); loadingStage.dataset = 'indexing';
    if (data?.version !== manifest.version || !Array.isArray(data.records) || data.records.length !== manifest.count) throw new StaticFacilityError();
    const cells: Index = new Map(), ids = new Set<string>();
    for (const row of data.records) {
      if (!['node', 'way', 'relation'].includes(row.type) || !Number.isSafeInteger(row.id) || row.id <= 0 || !Number.isFinite(row.lat) || Math.abs(row.lat) > 90 || !Number.isFinite(row.lon) || Math.abs(row.lon) > 180 || !row.tags?.name?.trim() || typeof row.canonical !== 'string') throw new StaticFacilityError();
      const id = row.type + ':' + row.id;
      if (ids.has(id)) throw new StaticFacilityError();
      ids.add(id);
      const key = cell(row.lat, row.lon);
      const bucket = cells.get(key) || []; bucket.push(row); cells.set(key, bucket);
    }
    loadingStage.dataset = 'ready';
    console.info('[facility-data]', { asset: 'dataset', phase: 'indexed', count: data.records.length, elapsedMs: Math.round(performance.now()-started) });
    return cells;
  }).catch(() => { loadingStage.dataset = 'failed'; datasetTask = null; throw new StaticFacilityError(); });
  return datasetTask;
}
const anyMoods = ['カフェ', '自然', 'グルメ', 'イベント', '写真', 'ストレス解消'];
export function resolveStaticCondition(choices: Choices, random = Math.random) {
  const mood = choices.mood === 'おまかせ' ? anyMoods[Math.floor(random() * anyMoods.length)] : choices.mood;
  const foodGenre = mood === 'グルメ' && choices.mood !== 'おまかせ' ? choices.foodGenre?.replace('料理', '') || '' : '';
  const eventGenre = mood === 'イベント' ? choices.mood === 'おまかせ' ? 'おまかせ' : choices.eventGenre || 'おまかせ' : '';
  const shrineGenre = mood === '神社・お寺' && choices.shrineGenre === '御朱印巡り' ? '御朱印巡り' : '';
  const definition = definitions.find(d => d.choices.mood === mood && ('foodGenre' in d.choices ? d.choices.foodGenre?.replace('料理', '') : '') === (foodGenre === 'おまかせ' ? '' : foodGenre) && ('eventGenre' in d.choices ? d.choices.eventGenre : '') === eventGenre && ('shrineGenre' in d.choices ? d.choices.shrineGenre : '') === shrineGenre);
  if (!definition) throw new StaticFacilityError();
  return { mood, clauses: definition.clauses };
}
const inactiveSnapshotIds=new Set(exclusions.sourceSha256===manifest.dataset.sha256?exclusions.ids:[]);
export function matchesStaticCondition(row: Row, clauses: ReturnType<typeof resolveStaticCondition>['clauses']) {
  return !inactiveSnapshotIds.has(row.type+':'+row.id) && !hasInactiveFacilitySignal(row.tags) && clauses.some(clause => row.type === clause.type && clause.predicates.every(p => p.op === 'exists' ? row.tags[p.key] !== undefined : p.op === '=' ? row.tags[p.key] === ('value' in p ? p.value : '') : typeof row.tags[p.key] === 'string' && new RegExp(('value' in p ? p.value : '') || '').test(row.tags[p.key])));
}
// null means out of scope: use the original provider. Errors NEVER trigger automatic fallback.
export async function loadLocalStaticFacilities(point: Point, choices: Choices, radius: number, random = Math.random): Promise<Spot[] | null> {
  if (!needsLocalStaticLookup(point, choices)) return null;
  if (!isInsideStaticRegion(point, await region())) return null;
  if (!Number.isFinite(radius) || radius < 0) throw new StaticFacilityError();
  return queryStaticIndex(point, radius, resolveStaticCondition({ ...choices }, random).clauses);
}
export type DateSpotKind = 'cafe' | 'relax' | 'food' | 'view' | 'event' | 'park';
export async function loadStaticDateSpots(point: Point, kind: DateSpotKind, radius: number): Promise<Spot[] | null> {
  if (!localStaticSearchEnabled() || !manifest.boxes.some(([w,s,e,n]) => point.longitude >= w && point.longitude <= e && point.latitude >= s && point.latitude <= n)) return null;
  if (!isInsideStaticRegion(point, await region())) return null;
  const clauses = kind === 'food'
    ? [['shop','bakery'],['shop','pastry'],['shop','confectionery'],['shop','chocolate'],['amenity','ice_cream']].map(([key,value]) => ({ type: 'node', predicates: [{ key, op: '=', value }] }))
    : kind === 'park' ? ['node','way'].map(type => ({ type, predicates: [{ key: 'leisure', op: '=', value: 'park' }] }))
    : resolveStaticCondition({ mood: { cafe: 'カフェ', relax: 'ストレス解消', view: '写真', event: 'イベント' }[kind], distance: '？km', eventGenre: 'おまかせ' }).clauses;
  return queryStaticIndex(point, radius, clauses);
}
async function queryStaticIndex(point: Point, radius: number, clauses: ReturnType<typeof resolveStaticCondition>['clauses']): Promise<Spot[]> {
  if (!Number.isFinite(radius) || radius < 0) throw new StaticFacilityError();
  const cells = await index();
  const dy = radius / 110000, dx = radius / (110000 * Math.cos(point.latitude * Math.PI / 180));
  const rows: Spot[] = [], seen = new Set<string>();
  for (let y = Math.floor((point.latitude - dy) * 100); y <= Math.floor((point.latitude + dy) * 100); y++) for (let x = Math.floor((point.longitude - dx) * 100); x <= Math.floor((point.longitude + dx) * 100); x++) {
    for (const row of cells.get(`${y}:${x}`) || []) {
      if (seen.has(row.canonical) || !matchesStaticCondition(row, clauses) || calculateDistance(point.latitude, point.longitude, row.lat, row.lon) * 1000 > radius) continue;
      seen.add(row.canonical); rows.push(row);
    }
  }
  console.info('[facility-search]', { backend: 'static-local', version: manifest.version, status: rows.length ? 'ok' : 'complete-empty', candidateCount: rows.length });
  return rows;
}
// Only clears this provider's memory. Never touches player/Auth/localStorage data.
export function resetStaticFacilityCache() { regionTask = null; datasetTask = null; loadingStage.coverage = 'idle'; loadingStage.dataset = 'idle'; }
