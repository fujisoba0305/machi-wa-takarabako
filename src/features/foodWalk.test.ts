import {expect,it} from 'vitest';
import {chooseFoodWalk,isFoodShop} from './foodWalk';
const origin={latitude:35,longitude:139};
const shop=(id:number,lat=35)=>({type:'node',id,lat,lon:139,tags:{name:'パン屋'+id,shop:'bakery'}});
const cafe=(id:number,lat=35.003)=>({type:'node',id,lat,lon:139,tags:{name:'喫茶店'+id,amenity:'cafe'}});
it.each(['bakery','pastry','confectionery','chocolate'])('accepts explicit %s shops without inferring a name',type=>{expect(isFoodShop({...shop(1),tags:{name:'名前は分類しない',shop:type}})).toBe(true);});
it('rejects pure cafes and bakery-cafes as the first stop',async()=>{expect(isFoodShop(cafe(1))).toBe(false);expect(isFoodShop({...shop(1),tags:{name:'パンカフェ',shop:'bakery',amenity:'cafe'}})).toBe(false);expect(await chooseFoodWalk(origin,[cafe(1)],[cafe(2)],()=>true)).toBeNull();});
it('always orders a shop before a cafe',async()=>{const result=await chooseFoodWalk(origin,[shop(1)],[cafe(2)],()=>true,()=>0);expect(result?.waypoint).toEqual(shop(1));expect(result?.finalSpot).toEqual(cafe(2));});
it('considers the full existing 1km gap band instead of excluding longer strolls',async()=>{const result=await chooseFoodWalk(origin,[shop(1)],[cafe(2,35.007),cafe(3,35.003)],()=>true,()=>0);expect(result?.finalSpot.id).toBe(2);});
it('does not silently accept a remote cafe or another shop',async()=>{expect(await chooseFoodWalk(origin,[shop(1)],[cafe(2,35.02)],()=>true)).toBeNull();expect(await chooseFoodWalk(origin,[shop(1)],[shop(2)],()=>true)).toBeNull();});
it('does not use the same canonical facility for both stops',async()=>{expect(await chooseFoodWalk(origin,[{...shop(1),canonical:'one'}],[{...cafe(2),canonical:'one'}],()=>true)).toBeNull();});
it('supports cancellation and genuine missing candidates',async()=>{expect(await chooseFoodWalk(origin,[shop(1)],[cafe(2)],()=>false)).toBeNull();expect(await chooseFoodWalk(origin,[],[cafe(2)],()=>true)).toBeNull();});

it.each([1,3,5,10])('never exceeds the estimated distance cap %s, even when only remote pairs exist',async target=>{const a=shop(5,35+target/111),b=cafe(6,35+target/111+.001);expect(await chooseFoodWalk(origin,[a],[b],()=>true,()=>.5,target)).toBeNull();});
it('keeps a short valid course when no longer course exists',async()=>{const r=await chooseFoodWalk(origin,[shop(1)],[cafe(2)],()=>true,()=>.5,5);expect(r).not.toBeNull();expect(r!.totalDistance*1.1435).toBeLessThan(5);});
it('does not let one pair exceed 65 percent when alternatives exist',async()=>{let near=0;for(let i=0;i<1000;i++){const r=await chooseFoodWalk(origin,[shop(1)],[cafe(2,35.007),cafe(3,35.001)],()=>true,()=>i/1000,1);if(r?.finalSpot.id===2)near++;}expect(near).toBeLessThanOrEqual(650);expect(near).toBeGreaterThan(500);});
it('rejects invalid distance and invalid random input',async()=>{expect(await chooseFoodWalk(origin,[shop(1)],[cafe(2)],()=>true,()=>.5,NaN)).toBeNull();await expect(chooseFoodWalk(origin,[shop(1)],[cafe(2)],()=>true,()=>1,1)).rejects.toThrow('抽選値');});
