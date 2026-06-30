import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
regions: ['hnd1'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method not allowed' });
}

try {
const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
const query = body?.query;

if (!query) {
return res.status(400).json({ error: 'Query is missing' });
}

const urls = [
'https://overpass-api.de/api/interpreter',
'https://overpass.kumi.systems/api/interpreter',
'https://overpass.osm.ch/api/interpreter',
];

for (const url of urls) {
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 25000);

try {
const requestUrl = `${url}?data=${encodeURIComponent(query)}`;

const response = await fetch(requestUrl, {
method: 'GET',
headers: {
'User-Agent':
'machi-wa-takarabako/1.0 (+https://machi-wa-takarabako.vercel.app)',
Accept: 'application/json',
},
signal: controller.signal,
});

clearTimeout(timeoutId);

if (!response.ok) {
const errorText = await response.text();
console.error('Overpass response error:', {
url,
status: response.status,
body: errorText.slice(0, 500),
});
continue;
}

const data = await response.json();
return res.status(200).json(data);
} catch (error) {
clearTimeout(timeoutId);
console.error('Overpass proxy failed:', url, error);
}
}

return res.status(500).json({ error: 'Overpass failed' });
} catch (error) {
return res.status(500).json({ error: String(error) });
}
}
