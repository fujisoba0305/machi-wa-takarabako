import type { AdventureTarget, PositionFix } from '../features/activeAdventure';
import { getWalkingDistances } from './walkingDistance';

export async function getDepartureWalkingDistance(departure: PositionFix, target: AdventureTarget) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const results = await getWalkingDistances(departure, [{ ...target, id: 'destination' }], undefined, controller.signal);
    const result = results.find(item => item.id === 'destination');
    return result?.status === 'OK' && typeof result.distanceMeters === 'number' &&
      Number.isFinite(result.distanceMeters) && result.distanceMeters >= 0 ? result.distanceMeters : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}
