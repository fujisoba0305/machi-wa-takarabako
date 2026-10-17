import { encodedPhotoDimensions, readPhotoHeader } from './photoHeader';
export const PHOTO_TARGET_BYTES=30_000;
export const PHOTO_MAX_EDGE=1280;
export const PHOTO_QUALITY_FLOOR=0.80;
export class PhotoPreparationError extends Error {
 constructor(readonly code:'PHOTO_DECODE'|'PHOTO_TOO_LARGE'|'PHOTO_ENCODING'|'PHOTO_CANCELLED'){super('写真を準備できませんでした。');}
}
export type PreparedPhoto={file:File;originalBytes:number;compressedBytes:number;width:number;height:number;quality:number;targetMet:boolean};
export function photoDimensions(width:number,height:number){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>40_000_000)throw new PhotoPreparationError('PHOTO_TOO_LARGE');
 const ratio=Math.min(1,PHOTO_MAX_EDGE/Math.max(width,height));return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))};
}
/** Local encoding only. Never uploads and never overwrites the selected original. */
export async function compressTreasurePhoto(file:File,signal?:AbortSignal):Promise<PreparedPhoto>{
 if(!file.size||file.size>25*1024*1024)throw new PhotoPreparationError('PHOTO_TOO_LARGE');
 if(!/^image\/(?:jpeg|png|webp|heic|heif|avif)$/i.test(file.type))throw new PhotoPreparationError('PHOTO_DECODE');
 const check=()=>{if(signal?.aborted)throw new PhotoPreparationError('PHOTO_CANCELLED');};check();
 // Reject known oversized JPEG/PNG headers before allocating a decoded image.
 const header=await readPhotoHeader(file,signal);check();
 const encodedSize=encodedPhotoDimensions(header);if(encodedSize)photoDimensions(encodedSize.width,encodedSize.height);
 const url=URL.createObjectURL(file),image=new Image();let canvas:HTMLCanvasElement|undefined;
 try{
  await new Promise<void>((resolve,reject)=>{
   let settled=false;const finish=(error?:PhotoPreparationError)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);image.onload=null;image.onerror=null;error?reject(error):resolve();};
   const abort=()=>finish(new PhotoPreparationError('PHOTO_CANCELLED'));
   const timer=setTimeout(()=>finish(new PhotoPreparationError('PHOTO_DECODE')),15000);
   signal?.addEventListener('abort',abort,{once:true});image.onload=()=>finish();image.onerror=()=>finish(new PhotoPreparationError('PHOTO_DECODE'));image.src=url;if(signal?.aborted)abort();
  });check();
  const size=photoDimensions(image.naturalWidth,image.naturalHeight);canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new PhotoPreparationError('PHOTO_ENCODING');
  // Browser image decoding applies EXIF orientation. No manual second rotation; alpha gets a white photo background.
  ctx.fillStyle='#fff';ctx.fillRect(0,0,size.width,size.height);ctx.drawImage(image,0,0,size.width,size.height);
  let best:Blob|undefined,quality=0.86;
  for(const q of [0.86,0.83,PHOTO_QUALITY_FLOOR]){
   check();const blob=await new Promise<Blob>((resolve,reject)=>{let done=false;const finish=(value:Blob|null,error?:PhotoPreparationError)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):value?resolve(value):reject(new PhotoPreparationError('PHOTO_ENCODING'));};const abort=()=>finish(null,new PhotoPreparationError('PHOTO_CANCELLED'));const timer=setTimeout(()=>finish(null,new PhotoPreparationError('PHOTO_ENCODING')),10000);signal?.addEventListener('abort',abort,{once:true});try{canvas!.toBlob(value=>finish(value),'image/jpeg',q);}catch{finish(null,new PhotoPreparationError('PHOTO_ENCODING'));}if(signal?.aborted)abort();});check();
   if(blob.type!=='image/jpeg'||!blob.size)throw new PhotoPreparationError('PHOTO_ENCODING');
   if(!best||blob.size<best.size){best=blob;quality=q;}if(blob.size<=PHOTO_TARGET_BYTES)break;
  }
  if(!best||best.size>5_000_000)throw new PhotoPreparationError('PHOTO_ENCODING');
  return {file:new File([best],'treasure-photo.jpg',{type:'image/jpeg',lastModified:Date.now()}),originalBytes:file.size,compressedBytes:best.size,...size,quality,targetMet:best.size<=PHOTO_TARGET_BYTES};
 }catch(error){if(error instanceof PhotoPreparationError)throw error;throw new PhotoPreparationError('PHOTO_DECODE');}
 finally{URL.revokeObjectURL(url);image.src='';if(canvas){canvas.width=0;canvas.height=0;}}
}
