import type { Spot as ServiceSpot } from '../services/overpass';
type Spot = Omit<ServiceSpot, 'type' | 'id'> & { type?: string; id?: number | string };
import { calculateDistance } from './distance';
export type DateCourse = { waypoint: Spot; finalSpot: Spot; totalDistance: number };
function location(s: Spot) { const lat = s.lat ?? s.center?.lat, lon = s.lon ?? s.center?.lon; return typeof lat === 'number' && Number.isFinite(lat) && typeof lon === 'number' && Number.isFinite(lon) ? {lat,lon} : null; }
// Preserve legacy ranking/top-five/fallback rules without allocating and sorting all N*M pairs.
export async function chooseDateCourse(origin: { latitude: number; longitude: number }, waypoints: Spot[], finals: Spot[], target: number, max: number, current: () => boolean, random = Math.random): Promise<DateCourse | null> {
  const best: DateCourse[] = []; let fallback: DateCourse | null = null;
  const score = (c: DateCourse) => Math.abs(c.totalDistance - target);
  for (let i = 0; i < waypoints.length; i++) {
    if (!current()) return null;
    const waypoint = waypoints[i], a = location(waypoint); if (!a || !waypoint.tags?.name) continue;
    const first = calculateDistance(origin.latitude, origin.longitude, a.lat, a.lon);
    for (const finalSpot of finals) {
      const b = location(finalSpot);
      if (!b || !finalSpot.tags?.name || waypoint.tags.name === finalSpot.tags.name) continue;
      const c = { waypoint, finalSpot, totalDistance: first + calculateDistance(a.lat,a.lon,b.lat,b.lon) };
      if (!fallback || score(c) < score(fallback)) fallback = c;
      if (c.totalDistance <= max) { best.push(c); best.sort((x,y) => score(x)-score(y)); if (best.length>5) best.pop(); }
    }
    // Allow cancellation/deadline timers and Safari input between batches.
    if ((i+1)%32===0) await new Promise<void>(resolve => setTimeout(resolve,0));
  }
  return current() ? best.length ? best[Math.floor(random()*best.length)] : fallback : null;
}
