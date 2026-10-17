export type TreasurePhotos={image_url:string|null;additional_image_url?:string|null};
export function treasurePhotoUrls(t:TreasurePhotos):string[]{return [...new Set([t.image_url,t.additional_image_url].filter((u):u is string=>typeof u==='string'&&/^https?:\/\//i.test(u)))].slice(0,2);}
