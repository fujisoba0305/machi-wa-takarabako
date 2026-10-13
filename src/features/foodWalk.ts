import type { DateCourse } from './dateCourse';
import { calculateDistance } from './distance';
type FoodSpot = DateCourse['waypoint'] & { canonical?: string };
export const FOOD_SHOPS = ['bakery','pastry','confectionery','chocolate'];
export function isFoodShop(s: FoodSpot) { return s.tags?.amenity !== 'cafe' && (FOOD_SHOPS.includes(s.tags?.shop || '') || s.tags?.amenity === 'ice_cream'); }
export function isFoodCafe(s: FoodSpot) { return s.tags?.amenity === 'cafe'; }
function coordinates(s: FoodSpot) { const lat=s.lat??s.center?.lat,lon=s.lon??s.center?.lon;return typeof lat==='number'&&Number.isFinite(lat)&&typeof lon==='number'&&Number.isFinite(lon)?{lat,lon}:null; }
// These are STRAIGHT distances for ranking only. Never convert them to walking minutes.
export const FOOD_PREFERRED_GAP_KM=.6, FOOD_MAX_GAP_KM=1;
export async function chooseFoodWalk(origin:{latitude:number;longitude:number},shops:FoodSpot[],cafes:FoodSpot[],current:()=>boolean,random=Math.random) {
  let preferred:DateCourse|null=null,nearby:DateCourse|null=null,preferredCount=0,nearbyCount=0;
  for(let i=0;i<shops.length;i++) {
    if(!current())return null;
    const a=shops[i],p=coordinates(a);if(!p||!a.tags?.name||!isFoodShop(a))continue;
    for(const b of cafes) {
      const q=coordinates(b);if(!q||!b.tags?.name||!isFoodCafe(b)||a.tags.name===b.tags.name||(a.id!==undefined&&a.type===b.type&&a.id===b.id)||(a.canonical&&a.canonical===b.canonical))continue;
      if(Math.abs(p.lat-q.lat)>FOOD_MAX_GAP_KM/110||Math.abs(p.lon-q.lon)>FOOD_MAX_GAP_KM/(110*Math.cos(p.lat*Math.PI/180)))continue;
      const gap=calculateDistance(p.lat,p.lon,q.lat,q.lon);if(gap>FOOD_MAX_GAP_KM)continue;
      const c={waypoint:a,finalSpot:b,totalDistance:calculateDistance(origin.latitude,origin.longitude,p.lat,p.lon)+gap};
      if(gap<=FOOD_PREFERRED_GAP_KM){if(random()<1/++preferredCount)preferred=c;}
      else if(random()<1/++nearbyCount)nearby=c;
    }
    if((i+1)%32===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  return current()?preferred||nearby:null;
}
