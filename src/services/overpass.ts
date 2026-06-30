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
'https://overpass.osm.ch/api/interpreter',
];

async function fetchOverpass(query: string): Promise<Spot[]> {
try {
const response = await fetch('/api/overpass', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
},
body: JSON.stringify({ query }),
});

if (!response.ok) {
const errorText = await response.text();
alert(`APIエラー ${response.status}\n${errorText}`);
throw new Error(`API error: ${response.status}: ${errorText}`);
}

const data: OverpassResponse = await response.json();
return data.elements ?? [];
} catch (error) {
console.error('Overpass API proxy failed:', error);
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
let queryBody = '';

if (foodGenre === 'スイーツ') {
queryBody = `
${nodeOnly('["amenity"="cafe"]', latitude, longitude, radius)}
${nodeOnly('["shop"="bakery"]', latitude, longitude, radius)}
`;
} else {
queryBody = `
${nodeOnly('["amenity"="restaurant"]', latitude, longitude, radius)}
${nodeOnly('["amenity"="fast_food"]', latitude, longitude, radius)}
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