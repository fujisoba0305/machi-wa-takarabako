import { expect,it } from 'vitest';
import { chooseDateCourse } from './dateCourse';
import { calculateDistance } from './distance';
const origin={latitude:35,longitude:139};
const spots=Array.from({length:12},(_,i)=>({type:'node',id:i,lat:35+i*.001,lon:139,tags:{name:'施設'+i}}));
it.each([0,.3,.99])('preserves the legacy top-five ranking and random choice %s',async random=>{
const courses=spots.flatMap(a=>spots.filter(b=>a.tags.name!==b.tags.name).map(b=>({waypoint:a,finalSpot:b,totalDistance:calculateDistance(35,139,a.lat,a.lon)+calculateDistance(a.lat,a.lon,b.lat,b.lon)}))).sort((a,b)=>Math.abs(a.totalDistance-1)-Math.abs(b.totalDistance-1));
const valid=courses.filter(c=>c.totalDistance<=2);expect(await chooseDateCourse(origin,spots,spots,1,2,()=>true,()=>random)).toEqual(valid[Math.floor(random*Math.min(5,valid.length))]);
});
it('preserves legacy fallback and does not invent a walking distance',async()=>{expect((await chooseDateCourse(origin,spots,spots,1,0,()=>true))!.totalDistance).toBeGreaterThan(0);});
it('supports cancellation and normal pair shortage',async()=>{expect(await chooseDateCourse(origin,spots,spots,1,2,()=>false)).toBeNull();expect(await chooseDateCourse(origin,[spots[0]],[spots[0]],1,2,()=>true)).toBeNull();});
