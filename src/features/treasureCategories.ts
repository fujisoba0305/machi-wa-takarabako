// Display categories are independent of OSM search moods. Never rewrite legacy rows.
export const collectionCategories = [
 {label:'自然・絶景',value:'🌿 自然・絶景',icon:'🌿',legacy:['🌳 自然','📷 写真スポット'],moods:['自然','写真','ストレス解消']},
 {label:'グルメ',value:'🍜 グルメ',icon:'🍜',legacy:['☕ カフェ'],moods:['グルメ']},
 {label:'歴史・文化',value:'🏯 歴史・文化',icon:'🏯',legacy:['⛩️ 神社・お寺'],moods:[]},
 {label:'温泉・癒やし',value:'♨️ 温泉・癒やし',icon:'♨️',legacy:[],moods:[]},
 {label:'遊び・エンタメ',value:'🎡 遊び・エンタメ',icon:'🎡',legacy:[],moods:[]},
 {label:'買い物・発見',value:'🛍️ 買い物・発見',icon:'🛍️',legacy:['🏪 お店'],moods:[]},
 {label:'運動・リフレッシュ',value:'🏃 運動・リフレッシュ',icon:'🏃',legacy:[],moods:[]},
 {label:'アート・学び',value:'🎨 アート・学び',icon:'🎨',legacy:[],moods:[]},
 {label:'街の珍スポット',value:'🔎 街の珍スポット',icon:'🔎',legacy:[],moods:[]},
 {label:'その他の宝物',value:'💎 その他の宝物',icon:'💎',legacy:['💎 その他'],moods:[]},
] as const;
export const legacyTreasureCategories=['☕ カフェ','🍜 グルメ','⛩️ 神社・お寺','🌳 自然','📷 写真スポット','🏪 お店','💎 その他'] as const;
export const registrationCategories:string[]=[...new Set([...collectionCategories.map(c=>c.value),...legacyTreasureCategories])];
export function collectionCategory(value:string){return collectionCategories.find(c=>c.value===value||(c.legacy as readonly string[]).includes(value));}
export function categoryMatchesFilter(value:string,filter:string){return !filter||value===filter||collectionCategory(value)?.value===filter;}
export function categoryIcon(value:string){const legacy:Record<string,string>={'☕ カフェ':'☕','⛩️ 神社・お寺':'⛩️','🌳 自然':'🌳','📷 写真スポット':'📷','🏪 お店':'🏪'};return legacy[value]??collectionCategory(value)?.icon??'💎';}
export function newCategoryMatchesMood(value:string,mood:string){const c=collectionCategories.find(c=>c.value===value);return Boolean(c&&(mood==='おまかせ'||(c.moods as readonly string[]).includes(mood)));}
