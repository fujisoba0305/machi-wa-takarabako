import type { ActiveAdventure } from './activeAdventure';

export const WALKING_MISSION = '目的地までの道で、気になるお店・看板・景色を1つ見つけよう！';
export function isWalkingAdventure(a: ActiveAdventure | null): a is ActiveAdventure {
  return Boolean(a && !a.rewardClaimed);
}
export function adventureReturnScreen(a: ActiveAdventure | null) {
  return isWalkingAdventure(a) ? 'walking' as const : 'home' as const;
}
export function adventureRestoreScreen(a: ActiveAdventure | null) {
  return isWalkingAdventure(a) ? 'walking' as const : a ? 'arrival' as const : 'home' as const;
}
export function walkingDestination(a: ActiveAdventure) {
  return {
    name: a.result.treasure?.name || a.result.spot?.tags?.name || '今日の目的地',
    imageUrl: a.result.treasure?.image_url || null,
    distanceLabel: a.departureWalkingDistanceMeters == null ? '徒歩ルート距離を取得できませんでした' :
      a.departureWalkingDistanceMeters < 1000 ? '約' + Math.round(a.departureWalkingDistanceMeters) + 'm' :
      '約' + (a.departureWalkingDistanceMeters / 1000).toFixed(1) + 'km',
  };
}
