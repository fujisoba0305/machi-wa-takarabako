import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { regions: ['hnd1'] };
// Published global Overpass policies and review date: docs/overpass-providers.md.
export const OVERPASS_PROVIDERS = [
  { id: 'vk-maps', url: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter' },
  { id: 'private-coffee', url: 'https://overpass.private.coffee/api/interpreter' },
] as const;
export const PROVIDER_TIMEOUT_MS = 25_000;
export const FALLBACK_WAIT_MS = 1_000;
let rateLimitedUntil = 0;
let activeRequests = 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let query: string;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (typeof body?.query !== 'string' || !body.query.trim() || body.query.length > 65536) return res.status(400).json({ error: 'Invalid query' });
    query = body.query;
  } catch { return res.status(400).json({ error: 'Invalid request' }); }
  if (rateLimitedUntil > Date.now()) {
    res.setHeader?.('Retry-After', String(Math.ceil((rateLimitedUntil - Date.now()) / 1000)));
    console.info('[overpass-api]', { status: 'cooldown', attempts: 0 });
    return res.status(429).json({ error: 'OVERPASS_COOLDOWN' });
  }
  // Per warm server instance, in addition to the browser's shared requests/queue.
  if (activeRequests >= 2) {
    res.setHeader?.('Retry-After', '2');
    console.info('[overpass-api]', { status: 'busy', attempts: 0 });
    return res.status(503).json({ error: 'OVERPASS_BUSY' });
  }
  activeRequests++;
  const shape = {
    nodeClauses: (query.match(/\bnode\[/g) ?? []).length,
    wayClauses: (query.match(/\bway\[/g) ?? []).length,
    relationClauses: (query.match(/\brelation\[/g) ?? []).length,
    nameRegex: query.includes('["name"~'), cuisineFilter: query.includes('["cuisine"'),
  };
  const started = Date.now();
  try {
    for (let index = 0; index < OVERPASS_PROVIDERS.length; index++) {
      if (index) await new Promise<void>(resolve => setTimeout(resolve, FALLBACK_WAIT_MS));
      // Another concurrent request may have received an upstream restriction.
      if (rateLimitedUntil > Date.now()) return res.status(429).json({ error: 'OVERPASS_COOLDOWN' });
      const provider = OVERPASS_PROVIDERS[index];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
      const diagnostic = { provider: provider.id, attempt: index + 1, ...shape };
      console.info('[overpass-api] request', diagnostic);
      try {
        const response = await fetch(provider.url, {
          method: 'POST',
          headers: { 'User-Agent': 'machi-wa-takarabako/1.0 (+https://machi-wa-takarabako.vercel.app)', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
          body: new URLSearchParams({ data: query }), signal: controller.signal,
        });
        if (!response.ok) {
          console.warn('[overpass-api]', { ...diagnostic, status: 'http-error', http: response.status, elapsedMs: Date.now() - started });
          // Never route around access denial or rate limits.
          if ([429, 403, 406].includes(response.status)) {
            const retry = response.headers?.get('Retry-After');
            const numericSeconds = retry && /^\d+$/.test(retry) ? Number(retry) : NaN;
            const dateWait = retry ? Date.parse(retry) - Date.now() : NaN;
            const wait = Math.max(30_000, Number.isFinite(numericSeconds) ? numericSeconds * 1000 : Number.isFinite(dateWait) ? dateWait : 0);
            rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + wait);
            res.setHeader?.('Retry-After', String(Math.ceil(wait / 1000)));
            return res.status(429).json({ error: 'OVERPASS_RESTRICTED' });
          }
          // Invalid requests are not repaired by changing providers.
          if (response.status >= 400 && response.status < 500) return res.status(502).json({ error: 'OVERPASS_REQUEST_REJECTED' });
          continue;
        }
        const data = await response.json();
        if (!data || !Array.isArray(data.elements) || data.remark) {
          console.warn('[overpass-api]', { ...diagnostic, status: 'invalid-or-incomplete', elapsedMs: Date.now() - started });
          continue;
        }
        console.info('[overpass-api]', { ...diagnostic, status: 'success', count: data.elements.length, elapsedMs: Date.now() - started });
        res.setHeader?.('X-Machi-Overpass-Provider', provider.id);
        return res.status(200).json(data);
      } catch {
        console.warn('[overpass-api]', { ...diagnostic, status: controller.signal.aborted ? 'timeout' : 'network-or-json-error', elapsedMs: Date.now() - started });
      } finally { clearTimeout(timer); }
    }
    return res.status(500).json({ error: 'Overpass failed' });
  } finally { activeRequests--; }
}
