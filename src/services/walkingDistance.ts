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

type WalkingDistanceDiagnostics = {
searchId: string;
batchNumber: number;
};

type WalkingDistanceResponse = {
results: WalkingDistanceResult[];
};

export async function getWalkingDistances(
origin: Coordinates,
destinations: WalkingDistanceDestination[],
diagnostics?: WalkingDistanceDiagnostics
): Promise<WalkingDistanceResult[]> {
let response: Response;

try {
response = await fetch('/api/walking-distance', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
...(diagnostics
? {
'X-Search-Id': diagnostics.searchId,
'X-Walking-Batch': String(diagnostics.batchNumber),
}
: {}),
},
body: JSON.stringify({ origin, destinations }),
});
} catch (error) {
console.error('[walking-distance-client] HTTP request failed', {
searchId: diagnostics?.searchId,
batchNumber: diagnostics?.batchNumber,
candidateCount: destinations.length,
error: error instanceof Error ? error.message : 'Unknown error',
});
throw error;
}

console.info('[walking-distance-client] HTTP response', {
searchId: diagnostics?.searchId,
batchNumber: diagnostics?.batchNumber,
candidateCount: destinations.length,
ok: response.ok,
status: response.status,
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
