import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
req: VercelRequest,
res: VercelResponse
) {
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method not allowed' });
}

try {
const { query } = req.body;

if (!query) {
return res.status(400).json({ error: 'Query is required' });
}

const urls = [
'https://overpass.kumi.systems/api/interpreter',
'https://overpass-api.de/api/interpreter',
];

for (const url of urls) {
try {
const response = await fetch(url, {
method: 'POST',
headers: {
'Content-Type':
'application/x-www-form-urlencoded;charset=UTF-8',
},
body: `data=${encodeURIComponent(query)}`,
});

if (!response.ok) continue;

const data = await response.json();

return res.status(200).json(data);
} catch {
// 次のOverpassへ
}
}

return res.status(500).json({
error: 'All Overpass servers failed',
});
} catch (error) {
return res.status(500).json({
error: String(error),
});
}
}
