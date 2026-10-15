import {decodeFacilities} from './facility-codec.mjs';
import { Heap, meters, distanceRange, validPoint } from './core.mjs';
import { prepareEvidence, assessConnection } from './connections.mjs';
import { tileKey } from './regional.mjs';
import { compactLoader } from './loader.mjs';
export const ANY_MOODS = ['カフェ', '自然', 'グルメ', 'イベント', '写真', 'ストレス解消'];
export function profileId(definition){return definition.key||JSON.stringify(definition.choices);}
// Facilities may be up to 500m inside a block beyond its road approach.
// One extra 0.02-degree tile ring covers that allowance in Tokyo/Kanagawa.
// This enlarges POI lookup only, never the road-distance budget or connectivity.
export function facilityKeys(roadKeys) { const keys = new Set(); for (const k of roadKeys) {
    const [x, y] = k.split('_').map(Number);
    for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
            keys.add(`${x + dx}_${y + dy}`);
} return [...keys]; }
const EMPTY = new Float64Array(0);
export function* approachRows(data, width) { if (data instanceof Float64Array) {
    if (data.length % width)
        throw Error('invalid-packed-approach');
    for (let i = 0; i < data.length; i += width)
        yield data.subarray(i, i + width);
}
else
    yield* data; }
function* allApproaches(r) { yield* approachRows(r.direct, 9); yield* approachRows(r.approaches, 10); }
export function packRecords(records){return records.map(r=>{if(!r.poi?.canonical||!validPoint(r.poi)||!r.poi.tags)throw Error('invalid-facility-record');const pack=(rows,width,limit)=>{if(rows instanceof Float64Array){if(rows.length%width||rows.length/width>limit||rows.some(v=>!Number.isFinite(v)))throw Error('invalid-facility-approach');return rows;}if(!Array.isArray(rows)||rows.length>limit||rows.some(s=>!Array.isArray(s)||s.length!==width||s.some(v=>!Number.isFinite(v))))throw Error('invalid-facility-approach');return rows.length?new Float64Array(rows.flat()):EMPTY;};return {...r,direct:pack(r.direct,9,8),approaches:pack(r.approaches,10,32)};});}
export function matches(p, clauses) { return clauses.some(c => c.type === p.type && c.predicates.every(q => q.op === 'exists' ? p.tags[q.key] !== undefined : q.op === '=' ? p.tags[q.key] === q.value : typeof p.tags[q.key] === 'string' && new RegExp(q.value).test(p.tags[q.key]))); }
export function resolveCondition(defs, choices, random = Math.random) { const resolved = choices.mood === 'おまかせ' ? { mood: ANY_MOODS[Math.min(5, Math.floor(random() * 6))] } : { ...choices }; if (resolved.mood === 'イベント' && !resolved.eventGenre)
    resolved.eventGenre = 'おまかせ'; const normalize = c => ({ mood: c.mood, foodGenre: c.mood === 'グルメ' ? (c.foodGenre || '').replace('料理', '').replace('おまかせ', '') : '', eventGenre: c.mood === 'イベント' ? c.eventGenre || 'おまかせ' : '', shrineGenre: c.mood === '神社・お寺' && c.shrineGenre === '御朱印巡り' ? '御朱印巡り' : '' }); const target = normalize(resolved), definition = defs.find(d => { const q = normalize(d.choices); return Object.keys(target).every(k => target[k] === q[k]); }); if (!definition)
    throw Error('unsupported-exact-condition'); return { resolved, clauses: definition.clauses, profileKey:profileId(definition) }; }
export async function readAsset(desc, fetcher) { if (!desc)
    throw Error('asset-unavailable'); const bytes = await fetcher(desc.file); if (bytes.byteLength !== desc.bytes)
    throw Error('asset-size-mismatch'); const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join(''); if (hash !== desc.sha256)
    throw Error('asset-hash-mismatch'); const raw = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());return desc.codec==='facility-f64-v1'?decodeFacilities(raw):JSON.parse(new TextDecoder().decode(raw)); }
const node = (g, n) => ({ lat: g.lat[n] / 1e7, lon: g.lon[n] / 1e7 });
export function spatialIndex(g) {
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
    for (let i = 0; i < g.nodeCount; i++) {
        west = Math.min(west, g.lon[i] / 1e7);
        east = Math.max(east, g.lon[i] / 1e7);
        south = Math.min(south, g.lat[i] / 1e7);
        north = Math.max(north, g.lat[i] / 1e7);
    }
    if (!g.nodeCount)
        return null;
    const x0 = Math.floor(west * 1000), y0 = Math.floor(south * 1000), width = Math.floor(east * 1000) - x0 + 1, height = Math.floor(north * 1000) - y0 + 1;
    if (width * height > 2000000)
        throw Error('spatial-budget-exceeded');
    const offsets = new Uint32Array(width * height + 1);
    function cells(e, fn) { const a = node(g, g.from[e]), b = node(g, g.to[e]); for (let x = Math.floor(Math.min(a.lon, b.lon) * 1000); x <= Math.floor(Math.max(a.lon, b.lon) * 1000); x++)
        for (let y = Math.floor(Math.min(a.lat, b.lat) * 1000); y <= Math.floor(Math.max(a.lat, b.lat) * 1000); y++)
            fn((y - y0) * width + x - x0); }
    for (let e = 0; e < g.edgeCount; e++)
        cells(e, c => offsets[c + 1]++);
    for (let i = 1; i < offsets.length; i++)
        offsets[i] += offsets[i - 1];
    const edges = new Uint32Array(offsets.at(-1)), cursor = offsets.slice();
    for (let e = 0; e < g.edgeCount; e++)
        cells(e, c => edges[cursor[c]++] = e);
    return { x0, y0, width, height, offsets, edges };
}
export function snapCandidates(g, grid, p) { if (!grid)
    return []; const x = Math.floor(p.lon * 1000) - grid.x0, y = Math.floor(p.lat * 1000) - grid.y0, seen = new Set(), result = [], scale = Math.cos(p.lat * Math.PI / 180); for (let yy = y - 1; yy <= y + 1; yy++)
    for (let xx = x - 1; xx <= x + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= grid.width || yy >= grid.height)
            continue;
        const c = yy * grid.width + xx;
        for (let k = grid.offsets[c]; k < grid.offsets[c + 1]; k++) {
            const e = grid.edges[k];
            if (seen.has(e))
                continue;
            seen.add(e);
            const a = node(g, g.from[e]), b = node(g, g.to[e]), vx = (b.lon - a.lon) * scale, vy = b.lat - a.lat, den = vx * vx + vy * vy, q = den ? Math.max(0, Math.min(1, ((p.lon - a.lon) * scale * vx + (p.lat - a.lat) * vy) / den)) : 0, s = { lat: a.lat + q * (b.lat - a.lat), lon: a.lon + q * (b.lon - a.lon) }, gap = meters(p, s);
            if (gap <= 50)
                result.push({ ...s, edge: e, gapMeters: gap, offsetMeters: g.length[e] * q });
        }
    } return result.sort((a, b) => a.gapMeters - b.gapMeters).slice(0, 8); }
export function originConnection(g, snaps, point, evidence) { if (!snaps.length)
    return null; const elevated = s => g.layer[s.edge] !== 0 || Boolean(g.flags[s.edge] & 2); if (snaps.some(s => elevated(s) && s.gapMeters <= snaps[0].gapMeters + .02))
    return { snap: snaps[0], connection: { type: 'unknown', reason: 'elevated-road' } }; let first; for (const snap of snaps) {
    const a = node(g, g.from[snap.edge]), b = node(g, g.to[snap.edge]);
    const connection = assessConnection(evidence, snap, point, { elevated: elevated(snap), roadSupport: { policy: 'conservative-foot-v1', points: [[a.lon, a.lat], [b.lon, b.lat]] } }), answer = { snap, connection };
    first ??= answer;
    if (connection.type === 'mapped-walk-connection')
        return answer;
} return first; }
export function explore(g, origin, max) { const d = new Float64Array(g.nodeCount); d.fill(Infinity); const q = new Heap(), e = origin.edge, seeds = [[g.to[e], g.length[e] - origin.offsetMeters]]; if (g.flags[e] & 1)
    seeds.push([g.from[e], origin.offsetMeters]); for (const [n, c] of seeds)
    if (c <= max && c < d[n]) {
        d[n] = c;
        q.push([c, n]);
    } while (q.a.length) {
    const [c, n] = q.pop();
    if (c !== d[n])
        continue;
    for (let p = g.offsets[n]; p < g.offsets[n + 1]; p++) {
        const v = g.targets[p], cost = c + g.weights[p];
        if (cost <= max && cost < d[v]) {
            d[v] = cost;
            q.push([cost, v]);
        }
    }
} return d; }
export function approachCost(s, g, d, idMap, origin) { if ((!Array.isArray(s) && !(s instanceof Float64Array)) || s.length < 9 || s.slice(0, 9).some(v => !Number.isFinite(v)) || s[2] <= 0 || s[5] < 0 || s[5] > s[2] || s[4] !== 0 || s[3] & 2)
    throw Error('invalid-facility-approach'); const a = idMap.get(s[0]), b = idMap.get(s[1]); if (a === undefined || b === undefined)
    return Infinity; let cost = d[a] + s[5]; if (s[3] & 1)
    cost = Math.min(cost, d[b] + s[2] - s[5]); const e = origin.edge; if (g.from[e] === a && g.to[e] === b && g.length[e] === s[2] && ((s[3] & 1) || s[5] >= origin.offsetMeters))
    cost = Math.min(cost, Math.abs(s[5] - origin.offsetMeters)); return cost; }
export function selectCandidates(records, g, d, origin, km, clauses, random = Math.random) { const [min, max] = distanceRange(km), needed = new Set(); for (const r of records.filter(r => r.reason !== 'explicit-restricted' && matches(r.poi, clauses)))
    for (const s of allApproaches(r)) {
        needed.add(s[0]);
        needed.add(s[1]);
    } const ids = new Map(); for (let n = 0; n < g.nodeCount; n++)
    if (needed.has(g.ids[n]))
        ids.set(g.ids[n], n); const candidates = [], seen = new Set(), counts = { matched: 0, held: 0, notReached: 0, outsideDistance: 0, osmMapped: 0, blockEstimate: 0 }; for (const r of records) {
    const p = r.poi;
    if (!matches(p, clauses) || seen.has(p.canonical))
        continue;
    seen.add(p.canonical);
    counts.matched++;
    if (r.reason === 'explicit-restricted') {
        counts.held++;
        continue;
    }
    let cost = Infinity, selected = null, quality = null;
    for (const s of approachRows(r.direct, 9)) {
        const c = approachCost(s, g, d, ids, origin) + s[8];
        if (c < cost) {
            cost = c;
            selected = s;
            quality = 'mapped-walk-connection';
        }
    }
    if (!selected)
        for (const s of approachRows(r.approaches, 10)) {
            const c = approachCost(s, g, d, ids, origin);
            if (c < cost) {
                cost = c;
                selected = s;
                quality = 'block-estimate';
            }
        }
    if (!r.direct.length && !r.approaches.length) {
        counts.held++;
        continue;
    }
    if (!Number.isFinite(cost)) {
        counts.notReached++;
        continue;
    }
    if (cost < min || cost > max) {
        counts.outsideDistance++;
        continue;
    }
    quality === 'block-estimate' ? counts.blockEstimate++ : counts.osmMapped++;
    candidates.push({ id: p.canonical, name: p.tags.name, lat: p.lat, lon: p.lon, distanceMeters: cost, label: '推定徒歩距離', quality, blockKind: r.blockKind, facilityAccessConfirmed: false, distanceScope: quality === 'block-estimate' ? 'road-to-block-perimeter' : 'road-plus-mapped-final-approach', unmeasuredFacilityOffsetMeters: quality === 'block-estimate' ? selected[9] : null });
} return { candidates, picked: candidates.length ? candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] : null, counts, confirmedArrivalCandidates: 0 }; }
export function facilitySearch({ roadIndex, assetIndex, roadIndexSha256, fetchRoad, fetchAsset, definitions,allowedDistances=[1,3],maximumWorkingBytes=256000000 }) { if (assetIndex.version !== 1 || assetIndex.policy !== 'regional-facility-approaches-v1' || assetIndex.roadIndexSha256 !== roadIndexSha256)
    throw Error('dataset-version-mismatch');if(assetIndex.definitionSignature&&assetIndex.definitionSignature!==JSON.stringify(definitions))throw Error('condition-version-mismatch'); const loadRoad = compactLoader(roadIndex, fetchRoad,{maximumWorkingBytes}); let retained = null, busy = false; const run=async (point, km, choices, { random = Math.random } = {}) => { if (busy)
    throw Error('search-in-progress'); busy = true; const started = performance.now(); try {
    if (!validPoint(point))
        throw Error('invalid-origin');
    distanceRange(km);if(!allowedDistances.includes(km))throw Error('distance-disabled');if(retained?.band!==km)retained=null;
    const condition = resolveCondition(definitions, choices, random);
    let at = performance.now();
    const road = await loadRoad(point, km), roadMs = performance.now() - at, key = road.plan.keys.join('|');
    let facilityBytes = 0, evidenceBytes = 0;
    if(retained?.key!==key)retained={key,band:km,records:[],profileKey:null,grid:spatialIndex(road.graph),origin:null,network:null};
    const profileKey=condition.profileKey||'legacy-all';
    if(retained.profileKey!==profileKey){retained.records=[];retained.profileKey=null;const records=[];
      for(const k of facilityKeys(road.plan.keys)){const meta=assetIndex.tiles[k];if(!meta&&road.plan.keys.includes(k)&&!roadIndex.tiles[k].empty)throw Error('facility-coverage-incomplete');
        const desc=meta?.profiles?meta.profiles[profileKey]:meta?.facilities;
        if(!desc){if(meta?.poiCount)throw Error('facility-tile-missing');continue;}if(desc.empty){if(desc.count!==0)throw Error('invalid-empty-profile');continue;}
        const data=await readAsset(desc,fetchAsset);if(data.version!==1||data.policy!==assetIndex.policy||!Array.isArray(data.records)||data.records.length!==(desc.count??meta.poiCount))throw Error('invalid-facility-data');facilityBytes+=desc.bytes;records.push(...packRecords(data.records));
      }retained.records=records;retained.profileKey=profileKey;
    }
    const facilityLoadMs = performance.now() - at - roadMs;
    const originAt=performance.now();let selection;
    if (retained.origin?.lat === point.lat && retained.origin?.lon === point.lon)
        selection = retained.origin.selection;
    else {
        const desc = assetIndex.tiles[tileKey(point.lat, point.lon)]?.evidence;
        if (!desc)
            throw Error('origin-evidence-unavailable');
        const evidence = prepareEvidence(await readAsset(desc, fetchAsset));
        evidenceBytes = desc.bytes;
        selection = originConnection(road.graph, snapCandidates(road.graph, retained.grid, point), point, evidence);
        retained.origin = { ...point, selection };
        retained.network = null;
    }
    const originMs=performance.now()-originAt;
    if (!selection || selection.connection.type === 'blocked')
        return { status: selection ? 'origin-blocked' : 'origin-unconnected', message: selection ? '起点と道路の間に障害物があるため保留します。' : '50m以内の道路接続を確認できません。', originConnection: selection?.connection, candidates: [], bytes: { roads: road.reused ? 0 : road.plan.bytes, facilities: facilityBytes, evidence: evidenceBytes }, timings: { roadMs, facilityLoadMs,originMs, totalMs: performance.now() - started } };
    at = performance.now();
    const networkKey = [point.lat, point.lon, km, selection.snap.edge, selection.snap.offsetMeters].join(':');
    let networkReused = retained.network?.key === networkKey;
    if (!networkReused)
        retained.network = { graph:road.graph,key: networkKey, d: explore(road.graph, selection.snap, distanceRange(km)[1]) };
    const networkMs = performance.now() - at;
    at = performance.now();
    const result = selectCandidates(retained.records, road.graph, retained.network.d, selection.snap, km, condition.clauses, random);const noCandidateReason=result.picked?null:result.counts.matched===0?'no-matching-poi':result.counts.held===result.counts.matched?'facility-connection-held':result.counts.held+result.counts.notReached===result.counts.matched?'network-unreached-or-connection-held':'no-matching-walking-distance';
    return { ...result,noCandidateReason, status: result.picked ? 'estimated-candidates' : 'no-candidates', resolved: condition.resolved, originConnection: selection.connection, originSupported: selection.connection.type === 'mapped-walk-connection', totalWalkingDistanceConfirmed: false, totalFacilityRecords: retained.records.length, roadReused: road.reused, networkReused, bytes: { roads: road.reused ? 0 : road.plan.bytes, facilities: facilityBytes, evidence: evidenceBytes }, timings: { roadMs, facilityLoadMs,originMs, networkMs, filterMs: performance.now() - at, totalMs: performance.now() - started }, message: result.picked ? '推定徒歩距離です。施設への到達は未確認です。' : noCandidateReason==='network-unreached-or-connection-held'?'条件に合う施設はありますが、この起点から道路網上の経路を確認できません。':noCandidateReason==='facility-connection-held'?'施設への接続根拠が不足しているため保留しています。':'徒歩距離・カテゴリ条件に合う候補を確認できません。条件は変更していません。' };
}
catch(error){retained=null;loadRoad.clear();throw error;}finally {busy=false;} };run.release=()=>{if(busy)throw Error('search-in-progress');retained=null;loadRoad.clear();};run.evaluateTreasures=async(treasures,km)=>{if(!retained?.network||!retained.origin?.selection)return {candidates:[],connected:0};const key=JSON.stringify([km,retained.network.key,treasures]);if(retained.treasureResult?.key===key)return retained.treasureResult.result;const grouped=new Map();for(const t of treasures){if(!validPoint(t))continue;const k=tileKey(t.lat,t.lon);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(t);}const candidates=[];let connected=0;for(const [k,items]of grouped){const desc=assetIndex.tiles[k]?.evidence;if(!desc)continue;const evidence=prepareEvidence(await readAsset(desc,fetchAsset));for(const t of items){const g=retained.network.graph,choice=originConnection(g,snapCandidates(g,retained.grid,t),t,evidence);if(choice?.connection.type!=='mapped-walk-connection')continue;connected++;const e=choice.snap.edge,s=[g.ids[g.from[e]],g.ids[g.to[e]],g.length[e],g.flags[e],g.layer[e],choice.snap.offsetMeters,choice.snap.lat,choice.snap.lon,choice.snap.gapMeters];const r=selectCandidates([{poi:{canonical:t.id,type:'treasure',lat:t.lat,lon:t.lon,tags:{name:t.name}},reason:null,direct:[s],approaches:[]}],g,retained.network.d,retained.origin.selection.snap,km,[{type:'treasure',predicates:[]}]);candidates.push(...r.candidates);}}const result={candidates,connected};retained.treasureResult={key,result};return result;};return run; }
