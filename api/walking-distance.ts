import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
regions: ['hnd1'],
};

type Coordinates = {
latitude: number;
longitude: number;
};

type Destination = Coordinates & {
id: string | number;
};

type WalkingDistanceRequest = {
origin: Coordinates;
destinations: Destination[];
};

type RouteMatrixElement = {
originIndex?: number;
destinationIndex?: number;
distanceMeters?: number;
condition?: string;
status?: {
code?: number;
};
};

const GOOGLE_ROUTES_URL =
'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const MAX_DESTINATIONS = 8;
const REQUEST_TIMEOUT_MS = 12000;

function getDiagnosticHeader(value: string | string[] | undefined) {
const headerValue = Array.isArray(value) ? value[0] : value;
return headerValue && /^[a-z0-9-]{1,64}$/i.test(headerValue)
? headerValue
: undefined;
}

function isCoordinates(value: unknown): value is Coordinates {
if (!value || typeof value !== 'object') return false;

const coordinates = value as Partial<Coordinates>;

return (
typeof coordinates.latitude === 'number' &&
Number.isFinite(coordinates.latitude) &&
coordinates.latitude >= -90 &&
coordinates.latitude <= 90 &&
typeof coordinates.longitude === 'number' &&
Number.isFinite(coordinates.longitude) &&
coordinates.longitude >= -180 &&
coordinates.longitude <= 180
);
}

function isDestination(value: unknown): value is Destination {
if (!isCoordinates(value)) return false;

const destination = value as Partial<Destination>;
const hasValidStringId =
typeof destination.id === 'string' &&
destination.id.length > 0 &&
destination.id.length <= 128;
const hasValidNumberId =
typeof destination.id === 'number' && Number.isFinite(destination.id);

return hasValidStringId || hasValidNumberId;
}

function parseRequestBody(body: unknown): WalkingDistanceRequest | null {
let parsedBody: unknown = body;

if (typeof body === 'string') {
try {
parsedBody = JSON.parse(body);
} catch {
return null;
}
}

if (!parsedBody || typeof parsedBody !== 'object') return null;

const request = parsedBody as Partial<WalkingDistanceRequest>;

if (!isCoordinates(request.origin)) return null;
if (!Array.isArray(request.destinations)) return null;
if (
request.destinations.length === 0 ||
request.destinations.length > MAX_DESTINATIONS
) {
return null;
}
if (!request.destinations.every(isDestination)) return null;

return {
origin: request.origin,
destinations: request.destinations,
};
}

function toWaypoint(coordinates: Coordinates) {
return {
waypoint: {
location: {
latLng: {
latitude: coordinates.latitude,
longitude: coordinates.longitude,
},
},
},
};
}

export default async function handler(
req: VercelRequest,
res: VercelResponse
) {
if (req.method !== 'POST') {
res.setHeader('Allow', 'POST');
return res.status(405).json({ error: 'Method not allowed' });
}

const request = parseRequestBody(req.body);

if (!request) {
return res.status(400).json({
error:
'origin must be valid coordinates and destinations must contain 1 to 8 valid points',
});
}

const searchId = getDiagnosticHeader(req.headers['x-search-id']);
const batchNumber = getDiagnosticHeader(req.headers['x-walking-batch']);
const diagnosticContext = {
searchId,
batchNumber,
receivedCandidateCount: request.destinations.length,
};

console.info('[walking-distance-api] request_received', diagnosticContext);

const apiKey = process.env.GOOGLE_ROUTES_API_KEY;

if (!apiKey) {
console.error('GOOGLE_ROUTES_API_KEY is not configured');
return res.status(500).json({ error: 'Walking distance service is unavailable' });
}

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

try {
const googleResponse = await fetch(GOOGLE_ROUTES_URL, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
'X-Goog-Api-Key': apiKey,
'X-Goog-FieldMask':
'originIndex,destinationIndex,status,condition,distanceMeters',
},
body: JSON.stringify({
origins: [toWaypoint(request.origin)],
destinations: request.destinations.map(toWaypoint),
travelMode: 'WALK',
}),
signal: controller.signal,
});

console.info('[walking-distance-api] google_http_response', {
...diagnosticContext,
status: googleResponse.status,
ok: googleResponse.ok,
timedOut: false,
});

if (!googleResponse.ok) {
const errorText = await googleResponse.text();
let googleErrorCode: string | number | undefined;

try {
const parsedError = JSON.parse(errorText) as {
error?: { code?: number; status?: string };
};
googleErrorCode = parsedError.error?.status ?? parsedError.error?.code;
} catch {
googleErrorCode = undefined;
}

console.error('Google Routes API error:', {
...diagnosticContext,
httpStatus: googleResponse.status,
googleErrorCode,
});

return res.status(502).json({ error: 'Walking route lookup failed' });
}

const elements = (await googleResponse.json()) as unknown;

if (!Array.isArray(elements)) {
console.error('Unexpected Google Routes API response', diagnosticContext);
return res.status(502).json({ error: 'Walking route lookup failed' });
}

console.info('[walking-distance-api] matrix_received', {
...diagnosticContext,
matrixElementCount: elements.length,
});

const elementsByDestination = new Map<number, RouteMatrixElement>();

for (const element of elements as RouteMatrixElement[]) {
if (
element.originIndex === 0 &&
typeof element.destinationIndex === 'number' &&
Number.isInteger(element.destinationIndex)
) {
elementsByDestination.set(element.destinationIndex, element);
}
}

const results = request.destinations.map((destination, destinationIndex) => {
const element = elementsByDestination.get(destinationIndex);

if (
element?.condition === 'ROUTE_EXISTS' &&
typeof element.distanceMeters === 'number' &&
Number.isFinite(element.distanceMeters)
) {
return {
id: destination.id,
status: 'OK' as const,
distanceMeters: element.distanceMeters,
};
}

if (element?.condition === 'ROUTE_NOT_FOUND') {
return {
id: destination.id,
status: 'NO_ROUTE' as const,
distanceMeters: null,
};
}

return {
id: destination.id,
status: 'ERROR' as const,
distanceMeters: null,
errorCode: element?.status?.code ?? null,
};
});

const resultCounts = results.reduce(
(counts, result) => {
counts[result.status] += 1;
return counts;
},
{ OK: 0, NO_ROUTE: 0, ERROR: 0 }
);
const googleErrorCodes = [
...new Set(
results
.filter((result) => result.status === 'ERROR' && result.errorCode != null)
.map((result) => result.errorCode)
),
];

console.info('[walking-distance-api] result_summary', {
...diagnosticContext,
matrixElementCount: elements.length,
...resultCounts,
googleErrorCodes,
timedOut: false,
});

return res.status(200).json({ results });
} catch (error) {
if (error instanceof Error && error.name === 'AbortError') {
console.error('Google Routes API request timed out', {
...diagnosticContext,
timedOut: true,
});
return res.status(504).json({ error: 'Walking route lookup timed out' });
}

console.error('Walking distance API failed:', {
...diagnosticContext,
timedOut: false,
error: error instanceof Error ? error.message : 'Unknown error',
});
return res.status(502).json({ error: 'Walking route lookup failed' });
} finally {
clearTimeout(timeoutId);
}
}
