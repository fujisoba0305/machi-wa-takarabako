type Coordinates = {
latitude: number;
longitude: number;
};

export type WalkingDistanceDestination = Coordinates & {
id: string;
};

export type WalkingDistanceResult = {
id: string;
status: 'OK' | 'NO_ROUTE' | 'ERROR';
distanceMeters: number | null;
errorCode?: number | null;
};

type WalkingDistanceResponse = {
results: WalkingDistanceResult[];
};

export async function getWalkingDistances(
origin: Coordinates,
destinations: WalkingDistanceDestination[]
): Promise<WalkingDistanceResult[]> {
const response = await fetch('/api/walking-distance', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
},
body: JSON.stringify({ origin, destinations }),
});

if (!response.ok) {
throw new Error(`Walking distance API failed: ${response.status}`);
}

const data = (await response.json()) as Partial<WalkingDistanceResponse>;

if (!Array.isArray(data.results)) {
throw new Error('Walking distance API returned an invalid response');
}

return data.results;
}
