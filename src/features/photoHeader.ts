/** Bounded header inspection only; never reads pixels or logs file metadata. */
export function encodedPhotoDimensions(bytes:Uint8Array):{width:number;height:number}|null {
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)&&v.getUint32(8)===13&&v.getUint32(12)===0x49484452)return {width:v.getUint32(16),height:v.getUint32(20)};
 if(bytes.length<4||bytes[0]!==255||bytes[1]!==216)return null;
 let offset=2;
 while(offset+3<bytes.length){
  if(bytes[offset++]!==255)return null;
  while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];
  if(marker===0xda||marker===0xd9)return null;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  if(offset+2>bytes.length)return null;
  const length=v.getUint16(offset);if(length<2||offset+length>bytes.length)return null;
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=8)return {height:v.getUint16(offset+3),width:v.getUint16(offset+5)};
  offset+=length;
 }
 return null;
}
export function readPhotoHeader(file:Blob,signal?:AbortSignal):Promise<Uint8Array>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();let done=false;
  const fail=(code:string)=>Object.assign(new Error('写真の準備を完了できませんでした。'),{code});
  const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);reader.onload=reader.onerror=reader.onabort=null;if(reader.readyState===1)reader.abort();error?reject(error):resolve(new Uint8Array(reader.result as ArrayBuffer));};
  const abort=()=>finish(fail('PHOTO_CANCELLED'));
  const timer=setTimeout(()=>finish(fail('PHOTO_DECODE')),5000);
  reader.onload=()=>finish();reader.onerror=()=>finish(fail('PHOTO_DECODE'));reader.onabort=abort;
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
  try{reader.readAsArrayBuffer(file.slice(0,256*1024));}catch{finish(fail('PHOTO_DECODE'));}
 });
}
