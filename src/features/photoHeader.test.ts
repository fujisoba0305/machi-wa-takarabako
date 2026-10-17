// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {encodedPhotoDimensions,readPhotoHeader} from './photoHeader';
import {compressTreasurePhoto} from './photoCompression';
function png(width:number,height:number){const b=new Uint8Array(24);b.set([137,80,78,71,13,10,26,10]);const v=new DataView(b.buffer);v.setUint32(8,13);v.setUint32(12,0x49484452);v.setUint32(16,width);v.setUint32(20,height);return b;}
it('reads PNG dimensions without decoding pixels',()=>expect(encodedPhotoDimensions(png(8000,6000))).toEqual({width:8000,height:6000}));
it('reads baseline and progressive JPEG after metadata',()=>{for(const marker of [0xc0,0xc2]){const b=Uint8Array.from([255,216,255,225,0,4,0,0,255,marker,0,8,8,23,112,31,64,3]);expect(encodedPhotoDimensions(b)).toEqual({width:8000,height:6000});}});
it('does not infer dimensions from truncated or unrelated bytes',()=>{expect(encodedPhotoDimensions(new Uint8Array([255,216,255,225,255,255]))).toBeNull();expect(encodedPhotoDimensions(new Uint8Array([1,2,3]))).toBeNull();});
it('rejects a 48MP PNG before Image decoding or canvas allocation',async()=>{await expect(compressTreasurePhoto(new File([png(8000,6000)],'large.png',{type:'image/png'}))).rejects.toMatchObject({code:'PHOTO_TOO_LARGE'});});
it('bounds the header read and supports cancellation',async()=>{const b=new Blob([new Uint8Array(300000)]);expect((await readPhotoHeader(b)).byteLength).toBe(262144);const c=new AbortController();c.abort();await expect(readPhotoHeader(b,c.signal)).rejects.toMatchObject({code:'PHOTO_CANCELLED'});});
