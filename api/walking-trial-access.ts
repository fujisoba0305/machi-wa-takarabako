import type { VercelRequest, VercelResponse } from '@vercel/node';
// Server-only switches. Never trust browser metadata, query strings or decoded JWT claims.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ allowed: false });
  const ids = (process.env.WALKING_TRIAL_USER_IDS || '').split(',').map(s => s.trim()).filter(s => /^[a-f0-9-]{36}$/i.test(s));
  if (process.env.WALKING_TRIAL_ENABLED !== 'on' || !ids.length) return res.status(403).json({ allowed: false });
  const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(String(req.headers.authorization || ''))?.[1];
  if (!token) return res.status(401).json({ allowed: false });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return res.status(503).json({ allowed: false });
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(new URL('/auth/v1/user', url), { headers: { apikey: key, Authorization: 'Bearer ' + token }, signal: controller.signal });
    if (!response.ok) return res.status(response.status === 401 || response.status === 403 ? 401 : 503).json({ allowed: false });
    const user = await response.json();
    const allowed = !user.is_anonymous && typeof user.id === 'string' && ids.includes(user.id);
    return res.status(allowed ? 200 : 403).json(allowed ? { allowed: true, distances: process.env.WALKING_TRIAL_3KM_ENABLED === 'on' ? [1,3] : [1] } : { allowed: false });
  } catch { return res.status(503).json({ allowed: false }); }
  finally { clearTimeout(timer); }
}
