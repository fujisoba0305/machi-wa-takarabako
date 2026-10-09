import park from '../assets/walking-park.webp';
import coast from '../assets/scenery/coast.webp';
import cafe from '../assets/scenery/cafe.webp';
import shrine from '../assets/scenery/shrine.webp';
import street from '../assets/scenery/street.webp';

export function categoryScenery(category = '') {
  if (/カフェ|喫茶/.test(category)) return { url: cafe, label: 'カフェ' };
  if (/神社|寺|歴史/.test(category)) return { url: shrine, label: '神社・お寺' };
  if (/グルメ|食|飲/.test(category)) return { url: street, label: 'グルメ' };
  if (/写真|景色|絶景|海|山/.test(category)) return { url: coast, label: '景色・写真' };
  if (/公園|自然|リラックス|ストレス/.test(category)) return { url: park, label: '公園・自然' };
  return { url: street, label: '街歩き' };
}
