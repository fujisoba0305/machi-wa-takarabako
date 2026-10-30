import type { DateCourse } from './dateCourse';
import { calculateDistance } from './distance';
import { APPROXIMATE_WALK_FACTOR, APPROXIMATE_UNIFORM_SHARE, APPROXIMATE_MAX_CANDIDATE_SHARE } from './approximateCandidateWeighting';
type FoodSpot = DateCourse['waypoint'] & { canonical?: string };
export const FOOD_SHOPS = ['bakery','pastry','confectionery','chocolate'];
export function isFoodShop(s: FoodSpot) { return s.tags?.amenity !== 'cafe' && (FOOD_SHOPS.includes(s.tags?.shop || '') || s.tags?.amenity === 'ice_cream'); }
export function isFoodCafe(s: FoodSpot) { return s.tags?.amenity === 'cafe'; }
function coordinates(s: FoodSpot) { const lat=s.lat??s.center?.lat,lon=s.lon??s.center?.lon;return typeof lat==='number'&&Number.isFinite(lat)&&Math.abs(lat)<=90&&typeof lon==='number'&&Number.isFinite(lon)&&Math.abs(lon)<=180?{lat,lon}:null; }
export const FOOD_PREFERRED_GAP_KM=.6, FOOD_MAX_GAP_KM=1;
export function foodWalkIsShort(straightKm:number,targetKm:number){return straightKm*APPROXIMATE_WALK_FACTOR<targetKm*.8;}
// The cap applies to a ranking estimate, never to actual walking distance or arrival.
// Two passes keep memory bounded instead of storing all shop/cafe pairs.
export async function chooseFoodWalk(origin:{latitude:number;longitude:number},shops:FoodSpot[],cafes:FoodSpot[],current:()=>boolean,random=Math.random,targetKm=1):Promise<DateCourse|null> {
  if(!Number.isFinite(targetKm)||targetKm<=0)return null;
  const sigma=Math.max(.25,targetKm*.1);let count=0,maxLog=-Infinity,totalWeight=0;
  async function visit(accept:(c:DateCourse,log:number)=>boolean|void){
    for(let i=0;i<shops.length;i++){
      if(!current())return false;
      const a=shops[i],p=coordinates(a);if(!p||!a.tags?.name||!isFoodShop(a))continue;
      const first=calculateDistance(origin.latitude,origin.longitude,p.lat,p.lon);
      if(first*APPROXIMATE_WALK_FACTOR>targetKm)continue;
      for(const b of cafes){
        const q=coordinates(b);if(!q||!b.tags?.name||!isFoodCafe(b)||a.tags.name===b.tags.name||(a.id!==undefined&&a.type===b.type&&a.id===b.id)||(a.canonical&&a.canonical===b.canonical))continue;
        if(Math.abs(p.lat-q.lat)>FOOD_MAX_GAP_KM/110||Math.abs(p.lon-q.lon)>FOOD_MAX_GAP_KM/(110*Math.cos(p.lat*Math.PI/180)))continue;
        const gap=calculateDistance(p.lat,p.lon,q.lat,q.lon);if(gap>FOOD_MAX_GAP_KM)continue;
        const totalDistance=first+gap,estimate=totalDistance*APPROXIMATE_WALK_FACTOR;if(estimate>targetKm)continue;
        if(accept({waypoint:a,finalSpot:b,totalDistance},-.5*((estimate-targetKm)/sigma)**2)===false)return true;
      }
      if((i+1)%32===0)await new Promise<void>(r=>setTimeout(r,0));
    }return current();
  }
  if(!await visit((_c,log)=>{count++;if(log>maxLog){totalWeight=totalWeight*Math.exp(maxLog-log)+1;maxLog=log;}else totalWeight+=Math.exp(log-maxLog);})||!count)return null;
  const peak=1/totalWeight,uniform=count>1&&peak>APPROXIMATE_MAX_CANDIDATE_SHARE?Math.max(APPROXIMATE_UNIFORM_SHARE,(peak-APPROXIMATE_MAX_CANDIDATE_SHARE)/(peak-1/count)):APPROXIMATE_UNIFORM_SHARE;
  const draw=random();if(!Number.isFinite(draw)||draw<0||draw>=1)throw Error('抽選値を確認できませんでした。');
  let cumulative=0,selected:DateCourse|null=null;
  if(!await visit((c,log)=>{selected=c;cumulative+=uniform/count+(1-uniform)*Math.exp(log-maxLog)/totalWeight;if(draw<cumulative)return false;}))return null;
  return current()?selected:null;
}
