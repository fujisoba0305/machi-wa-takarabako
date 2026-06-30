import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method not allowed' });
}

const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
const query = body?.query;

if (!query) {
return res.status(400).json({ error: 'Query is missing' });
}

const urls = [
'https://overpass-api.de/api/interpreter',
'https://overpass.kumi.systems/api/interpreter',
];

for (const url of urls) {
try {
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 25000);

const response = await fetch(url, {
method: 'POST',
headers: {
'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
},
body: `data=${encodeURIComponent(query)}`,
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
console.error('Overpass proxy failed:', url, error);
}
}

return res.status(500).json({
error: 'Overpass failed',
hint: 'Check Vercel logs for Overpass response error',
});

}
