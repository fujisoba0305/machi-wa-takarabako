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
};

const overpassCache = new Map<string, Spot[]>();

async function fetchOverpass(query: string): Promise<Spot[]> {
const cacheKey = query;

if (overpassCache.has(cacheKey)) {
console.log('キャッシュから取得');
return overpassCache.get(cacheKey) ?? [];
}

try {
const response = await fetch('/api/overpass?v=20260708', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
},
body: JSON.stringify({ query }),
});

if (!response.ok) {
console.error('API Error:', response.status);
return [];
}

const data: OverpassResponse = await response.json();
const elements = data.elements ?? [];

console.log('Proxy取得件数:', elements.length);

overpassCache.set(cacheKey, elements);

return elements;
} catch (error) {
console.error('Proxy error:', error);
return [];
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
return `node${filter}(around:${radius},${latitude},${longitude});`;
}

function nodeAndWay(
filter: string,
latitude: number,
longitude: number,
radius: number
): string {
return `
node${filter}(around:${radius},${latitude},${longitude});
way${filter}(around:${radius},${latitude},${longitude});
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
${nodeOnly('["amenity"="ice_cream"]', latitude, longitude, radius)}
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
${nodeOnly('["amenity"="cafe"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="restaurant"]', latitude, longitude, radius)}
${nodeOnly('["shop"="bakery"]', latitude, longitude, radius)}
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
const queryBody = `
${nodeOnly('["amenity"="place_of_worship"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}