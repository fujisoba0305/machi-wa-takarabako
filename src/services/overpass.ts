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

const OVERPASS_URLS = [
'https://overpass.kumi.systems/api/interpreter',
'https://overpass-api.de/api/interpreter',
];

async function fetchOverpass(query: string): Promise<Spot[]> {
for (const url of OVERPASS_URLS) {
try {
const requestUrl = `${url}?data=${encodeURIComponent(query)}`;

const response = await fetch(requestUrl, {
method: 'GET',
});

if (!response.ok) {
throw new Error(`Overpass API error: ${response.status}`);
}

const data: OverpassResponse = await response.json();

return (data.elements ?? []).filter(
(spot) => spot.tags?.name && (spot.lat || spot.center)
);
} catch (error) {
console.error(`Overpass fetch failed: ${url}`, error);
}
}

return [];
}

function buildQuery(queryBody: string): string {
return `
[out:json][timeout:8];
(
${queryBody}
);
out center tags;
`;
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
${nodeAndWay('["leisure"="garden"]', latitude, longitude, radius)}
${nodeAndWay('["leisure"="playground"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyCafes(
latitude: number,
longitude: number,
radius: number
) {
const queryBody = `
${nodeAndWay('["amenity"="cafe"]', latitude, longitude, radius)}
${nodeAndWay('["shop"="coffee"]', latitude, longitude, radius)}
${nodeAndWay('["shop"="bakery"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyRestaurants(
latitude: number,
longitude: number,
radius: number,
foodGenre: string
) {
let queryBody = '';

if (foodGenre === 'ラーメン') {
queryBody = `
${nodeAndWay('["amenity"="restaurant"]["cuisine"~"ramen|noodle|japanese"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="fast_food"]["cuisine"~"ramen|noodle|japanese"]', latitude, longitude, radius)}
`;
} else if (foodGenre === '中華') {
queryBody = `
${nodeAndWay('["amenity"="restaurant"]["cuisine"~"chinese"]', latitude, longitude, radius)}
`;
} else if (foodGenre === '韓国料理') {
queryBody = `
${nodeAndWay('["amenity"="restaurant"]["cuisine"~"korean"]', latitude, longitude, radius)}
`;
} else if (foodGenre === 'イタリアン') {
queryBody = `
${nodeAndWay('["amenity"="restaurant"]["cuisine"~"italian|pizza|pasta"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="fast_food"]["cuisine"~"pizza"]', latitude, longitude, radius)}
`;
} else if (foodGenre === 'カレー') {
queryBody = `
${nodeAndWay('["amenity"="restaurant"]["cuisine"~"curry|indian"]', latitude, longitude, radius)}
`;
} else if (foodGenre === 'スイーツ') {
queryBody = `
${nodeAndWay('["shop"="confectionery"]', latitude, longitude, radius)}
${nodeAndWay('["shop"="bakery"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="cafe"]', latitude, longitude, radius)}
`;
} else if (foodGenre === '和食') {
queryBody = `
${nodeAndWay('["amenity"="restaurant"]["cuisine"~"japanese|sushi|soba|udon|tempura|ramen"]', latitude, longitude, radius)}
`;
} else {
queryBody = `
${nodeAndWay('["amenity"="restaurant"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="fast_food"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="cafe"]', latitude, longitude, radius)}
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
${nodeAndWay('["amenity"="cafe"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="restaurant"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="fast_food"]', latitude, longitude, radius)}
${nodeAndWay('["shop"="bakery"]', latitude, longitude, radius)}
${nodeAndWay('["shop"="confectionery"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyViewSpots(
latitude: number,
longitude: number,
radius: number
) {
const queryBody = `
${nodeAndWay('["tourism"="viewpoint"]', latitude, longitude, radius)}
${nodeAndWay('["tourism"="attraction"]', latitude, longitude, radius)}
${nodeAndWay('["historic"]', latitude, longitude, radius)}
${nodeAndWay('["leisure"="park"]', latitude, longitude, radius)}
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
queryBody = `${nodeAndWay('["tourism"="aquarium"]', latitude, longitude, radius)}`;
} else if (eventGenre === '動物園') {
queryBody = `${nodeAndWay('["tourism"="zoo"]', latitude, longitude, radius)}`;
} else if (eventGenre === '博物館') {
queryBody = `${nodeAndWay('["tourism"="museum"]', latitude, longitude, radius)}`;
} else if (eventGenre === '美術館') {
queryBody = `
${nodeAndWay('["tourism"="gallery"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="arts_centre"]', latitude, longitude, radius)}
`;
} else if (eventGenre === '展望台') {
queryBody = `${nodeAndWay('["tourism"="viewpoint"]', latitude, longitude, radius)}`;
} else {
queryBody = `
${nodeAndWay('["tourism"="aquarium"]', latitude, longitude, radius)}
${nodeAndWay('["tourism"="zoo"]', latitude, longitude, radius)}
${nodeAndWay('["tourism"="museum"]', latitude, longitude, radius)}
${nodeAndWay('["tourism"="gallery"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="arts_centre"]', latitude, longitude, radius)}
${nodeAndWay('["tourism"="viewpoint"]', latitude, longitude, radius)}
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
${nodeAndWay('["leisure"="garden"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="library"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="cafe"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="public_bath"]', latitude, longitude, radius)}
${nodeAndWay('["leisure"="spa"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyCinemas(
latitude: number,
longitude: number,
radius: number
) {
const queryBody = `
${nodeAndWay('["amenity"="cinema"]', latitude, longitude, radius)}
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
${nodeAndWay('["leisure"="garden"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="library"]', latitude, longitude, radius)}
${nodeAndWay('["tourism"="viewpoint"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="place_of_worship"]', latitude, longitude, radius)}
${nodeAndWay('["historic"="memorial"]', latitude, longitude, radius)}
`;

return fetchOverpass(buildQuery(queryBody));
}

export async function getNearbyShrinesAndTemples(
latitude: number,
longitude: number,
radius: number,
shrineGenre: string
) {
let queryBody = '';

if (shrineGenre === '御朱印巡り') {
queryBody = `
${nodeAndWay('["amenity"="place_of_worship"]["religion"="shinto"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="place_of_worship"]["religion"="buddhist"]', latitude, longitude, radius)}
`;
} else if (shrineGenre === '歴史散策') {
queryBody = `
${nodeAndWay('["historic"]', latitude, longitude, radius)}
${nodeAndWay('["amenity"="place_of_worship"]', latitude, longitude, radius)}
`;
} else if (shrineGenre === 'パワースポット') {
queryBody = `
${nodeAndWay('["amenity"="place_of_worship"]', latitude, longitude, radius)}
${nodeAndWay('["natural"="tree"]', latitude, longitude, radius)}
${nodeAndWay('["tourism"="attraction"]', latitude, longitude, radius)}
`;
} else {
queryBody = `
${nodeAndWay('["amenity"="place_of_worship"]', latitude, longitude, radius)}
${nodeAndWay('["historic"]', latitude, longitude, radius)}
`;
}

return fetchOverpass(buildQuery(queryBody));
}
