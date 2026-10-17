import {describe,it,expect} from 'vitest';
import {hasInactiveFacilitySignal} from './facilityAvailability';
describe('facility availability evidence',()=>{
 it.each([{name:'からみそふくろう(閉業)',cuisine:'ramen'},{name:'店（閉店）'},{shop:'vacant'},{amenity:'vacant',cuisine:'ramen'},{'disused:amenity':'restaurant',cuisine:'ramen'},{'abandoned:shop':'bakery'},{'demolished:amenity':'restaurant'},{closed:'yes'}])('rejects explicit inactive evidence %j',tags=>expect(hasInactiveFacilitySignal(tags)).toBe(true));
 it.each([{name:'閉店セールカフェ',amenity:'cafe'},{amenity:'restaurant','disused:amenity':'atm'},{amenity:'restaurant','disused:amenity':'cafe'},{disused:'no',amenity:'cafe'},{name:'closed loop cafe'},{}])('does not invent closure from unknown or former different use %j',tags=>expect(hasInactiveFacilitySignal(tags)).toBe(false));
});
