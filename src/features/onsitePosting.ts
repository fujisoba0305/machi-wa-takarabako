import { calculateDistance } from './distance.js';
import { registrationCategories } from './treasureCategories.js';
export type PostingPoint={latitude:number;longitude:number};
export type PostingFix=PostingPoint&{accuracy:number;timestamp:number};
export type PostingMode='daily'|'adventure';
export class PostingError extends Error {
 constructor(readonly code:string, message:string, readonly uncertain=false){super(message);this.name='PostingError';}
}
export function validatePostingPoint(p:PostingPoint){
 if(!p||!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180)throw new PostingError('POST_INVALID','投稿地点を確認できません。');
}
export function validatePostingFix(f:PostingFix,target:PostingPoint,now=Date.now()){
 validatePostingPoint(target);validatePostingPoint(f);
 if(!Number.isFinite(f.accuracy)||f.accuracy<0||f.accuracy>50)throw new PostingError('POST_ACCURACY','GPSの精度が足りません。50m以内の精度になる場所で再取得してください。入力は残っています。');
 if(!Number.isFinite(f.timestamp)||f.timestamp<=0||now-f.timestamp>30000||f.timestamp>now+5000)throw new PostingError('POST_STALE','位置確認の有効期限が切れています。GPSを再取得してください。入力は残っています。');
 if(calculateDistance(f.latitude,f.longitude,target.latitude,target.longitude)*1000>100)throw new PostingError('POST_DISTANCE','投稿地点から離れています。現地に戻ってGPSを再取得してください。入力は残っています。');
}
export type PostingValue={name:string;comment:string;category:string;latitude:number;longitude:number;image_url:string|null;additional_image_url?:string|null};
export function validatePostingValue(v:PostingValue){
 if(!v||typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>60||typeof v.comment!=='string'||v.comment.length>160||!registrationCategories.includes(v.category))throw new PostingError('POST_INVALID','名前・文章・カテゴリーを確認してください。');
 validatePostingPoint(v);
 for(const u of [v.image_url,v.additional_image_url])if(u!=null&&(typeof u!=='string'||u.length>2048||!/^https:\/\//.test(u)))throw new PostingError('POST_INVALID','写真の参照を確認できません。');
 if(v.additional_image_url&&!v.image_url)throw new PostingError('POST_INVALID','追加写真には代表写真が必要です。');
}
export function canonicalPostingValue(v:PostingValue):PostingValue{validatePostingValue(v);return {name:v.name.trim(),comment:v.comment,category:v.category,latitude:v.latitude,longitude:v.longitude,image_url:v.image_url,additional_image_url:v.additional_image_url??null};}
