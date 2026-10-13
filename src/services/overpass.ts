export type Spot = {
type: string;
id: number;
lat?: number;
lon?: number;
center?: {
lat: number;
lon: number;
};
tags?: {
name?: string;
[key: string]: string | undefined;
};
};

type OverpassResponse = {
elements: Spot[];
remark?: unknown;
};

export const EMPTY_CACHE_MS = 30_000;
export const RESULT_CACHE_MS = 5 * 60_000;
const overpassCache = new Map<string, { elements: Spot[]; expires: number }>();

const inFlight = new Map<string, Promise<Spot[]>>();
let clientRateLimitedUntil = 0;
// Bound load per browser tab; identical requests share the same completion.
let activeRequests = 0;
const waiting: (() => void)[] = [];
async function fetchOverpass(query: string): Promise<Spot[]> {
const cached = overpassCache.get(query);
if (cached && cached.expires > Date.now()) {
console.info('[overpass-client]', { endpoint: '/api/overpass', status: 'cache-hit', count: cached.elements.length });
return cached.elements;
}
if (clientRateLimitedUntil > Date.now()) throw new Error('Overpass cooldown; retry later');
const existing = inFlight.get(query);
if (existing) return existing;
if (activeRequests >= 2 && waiting.length >= 4) throw new Error('Overpass busy; retry later');
const task = (async () => {
if (activeRequests >= 2) await new Promise<void>(resolve => waiting.push(resolve));
else activeRequests++;
try { return await fetchOverpassOnce(query); }
finally { const next = waiting.shift(); if (next) next(); else activeRequests--; }
})();
inFlight.set(query, task);
try { return await task; } finally { inFlight.delete(query); }
}
async function fetchOverpassOnce(query: string): Promise<Spot[]> {
const cacheKey = query;

const cached = overpassCache.get(cacheKey);
if (cached && cached.expires > Date.now()) {
console.info('[overpass-client]', { endpoint: '/api/overpass', status: 'cache-hit', count: cached.elements.length });
return cached.elements;
}
overpassCache.delete(cacheKey);

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 55000);
try {
const response = await fetch(
'/api/overpass',
{
method: 'POST',
signal: controller.signal,
headers: {
'Content-Type': 'application/json',
},
body: JSON.stringify({ query }),
}
);

if (!response.ok) {
if ([429, 403, 406].includes(response.status)) {
const retry = response.headers?.get('Retry-After');
const numeric = retry && /^\d+$/.test(retry) ? Number(retry) : NaN;
const dateWait = retry ? Date.parse(retry) - Date.now() : NaN;
const wait = Math.max(30_000, Number.isFinite(numeric) ? numeric * 1000 : Number.isFinite(dateWait) ? dateWait : 0);
clientRateLimitedUntil = Math.max(clientRateLimitedUntil, Date.now() + wait);
console.info('[overpass-client]', { endpoint: '/api/overpass', status: 'cooldown', retryAfterMs: wait });
}
throw new Error('Overpass HTTP error: ' + response.status);
}

const data: OverpassResponse = await response.json();
if (!data || !Array.isArray(data.elements) || data.remark) {
throw new Error('Overpass returned an incomplete or invalid result');
}
const elements = data.elements;

console.info('[overpass-client]', { endpoint: '/api/overpass', status: 'success', count: elements.length, provider: ['vk-maps', 'private-coffee'].includes(response.headers?.get('X-Machi-Overpass-Provider') ?? '') ? response.headers?.get('X-Machi-Overpass-Provider') : 'unknown', environment: response.headers?.get('X-Machi-API-Environment') === 'local' ? 'local' : 'deployed' });

if (overpassCache.size >= 100) overpassCache.delete(overpassCache.keys().next().value!);
overpassCache.set(cacheKey, { elements, expires: Date.now() + (elements.length ? RESULT_CACHE_MS : EMPTY_CACHE_MS) });

return elements;
} catch (error) {
console.warn('[overpass-client]', { endpoint: '/api/overpass', status: controller.signal.aborted ? 'timeout' : 'failure', cached: false });
throw error;
} finally {
clearTimeout(timer);
}
}

function buildQuery(queryBody: string): string {
return `
[out:json][timeout:12];
(
${queryBody}
);
out center;
`;
}

function nodeOnly(
filter: string,
latitude: number,
longitude: number,
radius: number
): string {
return `node${filter}[name](around:${radius},${latitude},${longitude});`;
}

function nodeAndWay(
filter: string,
latitude: number,
longitude: number,
radius: number
): string {
return `
node${filter}(around:${radius},${latitude},${longitude});
way${filter}[name](around:${radius},${latitude},${longitude});
`;
}

export async function getNearbyParks(
latitude: number,
longitude: number,
radius: number
) {
const queryBody = `
${nodeAndWay('["leisure"="park"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyCafes(
latitude: number,
longitude: number,
radius: number
) {
const queryBody = `
${nodeOnly('["amenity"="cafe"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyRestaurants(
latitude: number,
longitude: number,
radius: number,
foodGenre: string
) {
const genre = foodGenre.replace('料理', '');

let queryBody = '';

if (genre === '和食') {
queryBody = `
${nodeOnly('["cuisine"="japanese"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="sushi"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="soba"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="udon"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="izakaya"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="yakitori"]', latitude, longitude, radius)}
${nodeOnly('["name"~"寿司|鮨|すし|そば|蕎麦|うどん|和食|居酒屋|焼鳥|焼き鳥|定食|食堂"]', latitude, longitude, radius)}
`;
} else if (genre === 'イタリアン') {
queryBody = `
${nodeOnly('["cuisine"="italian"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="pizza"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="pasta"]', latitude, longitude, radius)}
`;
} else if (genre === '中華') {
queryBody = `
${nodeOnly('["cuisine"="chinese"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="taiwanese"]', latitude, longitude, radius)}
`;
} else if (genre === '韓国') {
queryBody = `
${nodeOnly('["cuisine"="korean"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="barbecue"]', latitude, longitude, radius)}
`;
} else if (genre === 'ラーメン') {
queryBody = `
${nodeOnly('["cuisine"="ramen"]', latitude, longitude, radius)}
`;
} else if (genre === 'カレー') {
queryBody = `
${nodeOnly('["cuisine"="curry"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="indian"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="nepalese"]', latitude, longitude, radius)}
`;
} else if (genre === 'スイーツ') {
queryBody = `
${nodeOnly('["amenity"="cafe"]', latitude, longitude, radius)}
${nodeOnly('["shop"="bakery"]', latitude, longitude, radius)}
${nodeOnly('["shop"="pastry"]', latitude, longitude, radius)}
${nodeOnly('["shop"="confectionery"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="ice_cream"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="cake"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="donut"]', latitude, longitude, radius)}
${nodeOnly('["cuisine"="bubble_tea"]', latitude, longitude, radius)}
${nodeOnly('["name"~"ケーキ|和菓子|団子|大福|どら焼き|ドーナツ|donut|Gong cha|ゴンチャ|タピオカ"]', latitude, longitude, radius)}
`;
} else {
queryBody = `
${nodeOnly('["amenity"="restaurant"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="fast_food"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="cafe"]', latitude, longitude, radius)}
`;
}

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyFoodWalkSpots(
latitude: number,
longitude: number,
radius: number
) {
const queryBody = `
${nodeOnly('["shop"="bakery"]', latitude, longitude, radius)}
${nodeOnly('["shop"="pastry"]', latitude, longitude, radius)}
${nodeOnly('["shop"="confectionery"]', latitude, longitude, radius)}
${nodeOnly('["shop"="chocolate"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="ice_cream"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyViewSpots(
latitude: number,
longitude: number,
radius: number
) {
const queryBody = `
${nodeOnly('["tourism"="viewpoint"]', latitude, longitude, radius)}
${nodeOnly('["tourism"="attraction"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyEventSpots(
latitude: number,
longitude: number,
radius: number,
eventGenre: string
) {
let queryBody = '';

if (eventGenre === '水族館') {
queryBody = `${nodeOnly('["tourism"="aquarium"]', latitude, longitude, radius)}`;
} else if (eventGenre === '動物園') {
queryBody = `${nodeOnly('["tourism"="zoo"]', latitude, longitude, radius)}`;
} else if (eventGenre === '博物館') {
queryBody = `${nodeOnly('["tourism"="museum"]', latitude, longitude, radius)}`;
} else if (eventGenre === '美術館') {
queryBody = `
${nodeOnly('["tourism"="gallery"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="arts_centre"]', latitude, longitude, radius)}
`;
} else if (eventGenre === '展望台') {
queryBody = `${nodeOnly('["tourism"="viewpoint"]', latitude, longitude, radius)}`;
} else {
queryBody = `
${nodeOnly('["tourism"="museum"]', latitude, longitude, radius)}
${nodeOnly('["tourism"="gallery"]', latitude, longitude, radius)}
${nodeOnly('["tourism"="viewpoint"]', latitude, longitude, radius)}
`;
}

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyRelaxSpots(
latitude: number,
longitude: number,
radius: number
) {
const queryBody = `
${nodeAndWay('["leisure"="park"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="library"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="cafe"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="internet_cafe"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="public_bath"]', latitude, longitude, radius)}
${nodeOnly('["leisure"="sauna"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyCinemas(
latitude: number,
longitude: number,
radius: number
) {
const queryBody = `
${nodeOnly('["amenity"="cinema"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyFreeRelaxSpots(
latitude: number,
longitude: number,
radius: number
) {
const queryBody = `
${nodeAndWay('["leisure"="park"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="library"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="place_of_worship"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyShrinesAndTemples(
latitude: number,
longitude: number,
radius: number,
shrineGenre: string
) {
let filter = '["amenity"="place_of_worship"]';

if (shrineGenre === '御朱印巡り') {
// 神社だけ
filter =
'["amenity"="place_of_worship"]["religion"="shinto"]';
}

const queryBody = `
${nodeOnly(filter, latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}
