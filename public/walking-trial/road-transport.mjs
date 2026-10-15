// Lossless transport only: restore the original graph bytes before validation.
const encoder=new TextEncoder(),decoder=new TextDecoder();
const widths={i:4,I:4,B:1,d:8};
const derived=new Set(['geoOwner','outOffsets','outTo','outEdge']);
export function encodeRoadTransport(buffer){
  const v=new DataView(buffer),hlen=v.getUint32(0,true),text=decoder.decode(new Uint8Array(buffer,4,hlen)),h=JSON.parse(text),base=Math.ceil((hlen+4)/8)*8;
  const chunks=[],arrays=[];
  for(const [name,a] of Object.entries(h.arrays)){
    if(derived.has(name)){arrays.push({name,bytes:0,mode:'derived-v1'});chunks.push(new Uint8Array());continue;}
    const width=widths[a.type];if(!width)throw Error('Unsupported array');
    const start=base+a.offset,out=[];let previous=0;
    if(width===4){for(let i=0;i<a.count;i++){const value=a.type==='i'?v.getInt32(start+i*4,true):v.getUint32(start+i*4,true),delta=value-previous;previous=value;let z=delta<0?-delta*2-1:delta*2;while(z>=128){out.push(z%128+128);z=Math.floor(z/128);}out.push(z);}}
    const bytes=width===4?Uint8Array.from(out):new Uint8Array(buffer,start,a.count*width).slice();
    arrays.push({name,bytes:bytes.length,mode:width===4?'delta-varint':'raw'});chunks.push(bytes);
  }
  const header=encoder.encode(JSON.stringify({version:1,format:'lossless-road-arrays',originalBytes:buffer.byteLength,originalHeader:text,arrays})),out=new Uint8Array(4+header.length+chunks.reduce((n,c)=>n+c.length,0));
  new DataView(out.buffer).setUint32(0,header.length,true);out.set(header,4);let at=4+header.length;for(const c of chunks){out.set(c,at);at+=c.length;}
  // Reject sources with nonzero padding/unknown bytes instead of silently losing them.
  const restored=decodeRoadTransport(out.buffer),a=new Uint8Array(buffer),b=new Uint8Array(restored);for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error('Lossless reconstruction failed');
  return out.buffer;
}
export function decodeRoadTransport(buffer){
  if(buffer.byteLength<4)throw Error('道路通信データが短すぎます。');
  const view=new DataView(buffer),hlen=view.getUint32(0,true);if(hlen>100000||hlen+4>buffer.byteLength)throw Error('道路通信ヘッダーが不正です。');
  const h=JSON.parse(decoder.decode(new Uint8Array(buffer,4,hlen)));
  if(h.version!==1||h.format!=='lossless-road-arrays'||!Number.isSafeInteger(h.originalBytes)||h.originalBytes<4||h.originalBytes>100000000||typeof h.originalHeader!=='string'||!Array.isArray(h.arrays))throw Error('道路通信形式が不正です。');
  const text=encoder.encode(h.originalHeader),original=JSON.parse(h.originalHeader),base=Math.ceil((text.length+4)/8)*8,names=Object.keys(original.arrays||{});
  if(text.length>100000||base>h.originalBytes||h.arrays.length!==names.length)throw Error('道路通信配列が不正です。');
  const out=new ArrayBuffer(h.originalBytes),ov=new DataView(out);ov.setUint32(0,text.length,true);new Uint8Array(out).set(text,4);let cursor=4+hlen;const occupied=[];
  for(let k=0;k<names.length;k++){
    const name=names[k],a=original.arrays[name],item=h.arrays[k],width=widths[a.type],start=base+a.offset,end=start+a.count*width;
    if(item.name!==name||!width||!Number.isSafeInteger(a.count)||a.count<0||a.count>5000000||!Number.isSafeInteger(a.offset)||a.offset<0||a.offset%8||end>out.byteLength||occupied.some(([s,e])=>start<e&&end>s)||!Number.isSafeInteger(item.bytes)||item.bytes<0||cursor+item.bytes>buffer.byteLength)throw Error('道路通信配列の範囲が不正です。');
    occupied.push([start,end]);const limit=cursor+item.bytes;
    if(derived.has(name)&&item.mode==='derived-v1'&&item.bytes===0&&a.type==='I'){
      // Restored after the source arrays have been read and bounds checked.
    }else if(width===4&&item.mode==='delta-varint'){
      let previous=0;for(let i=0;i<a.count;i++){let z=0,factor=1,count=0,byte;do{if(cursor>=limit||++count>5)throw Error('道路通信整数が不正です。');byte=view.getUint8(cursor++);z+=(byte&127)*factor;factor*=128;}while(byte&128);
        const value=previous+(z%2?-(z+1)/2:z/2);if(!Number.isSafeInteger(value)||(a.type==='i'?(value< -2147483648||value>2147483647):(value<0||value>4294967295)))throw Error('道路通信整数が範囲外です。');
        if(a.type==='i')ov.setInt32(start+i*4,value,true);else ov.setUint32(start+i*4,value,true);previous=value;
      }
    }else if(item.mode==='raw'&&width!==4&&item.bytes===a.count*width){new Uint8Array(out,start,item.bytes).set(new Uint8Array(buffer,cursor,item.bytes));cursor=limit;}
    else throw Error('道路通信符号化が不正です。');
    if(cursor!==limit)throw Error('道路通信整数の末尾が不正です。');
  }
  if(cursor!==buffer.byteLength)throw Error('道路通信データの末尾が不正です。');
  if(h.arrays.some(x=>x.mode==='derived-v1')){
    if(!h.arrays.filter(x=>derived.has(x.name)).every(x=>x.mode==='derived-v1'))throw Error('道路索引の復元指定が不正です。');
    const array=(name,type)=>{const a=original.arrays[name];if(!a||a.type!==type)throw Error('道路索引の型が不正です。');return type==='B'?new Uint8Array(out,base+a.offset,a.count):new Uint32Array(out,base+a.offset,a.count);};
    const from=array('edgeFrom','I'),to=array('edgeTo','I'),flags=array('flags','B'),geoOffsets=array('geoOffsets','I'),owner=array('geoOwner','I'),offsets=array('outOffsets','I'),outTo=array('outTo','I'),outEdge=array('outEdge','I'),n=original.arrays.nodeLat?.count;
    if(!Number.isSafeInteger(n)||offsets.length!==n+1||from.length!==to.length||flags.length!==from.length||geoOffsets.length!==from.length+1||geoOffsets[0]!==0||geoOffsets.at(-1)!==owner.length||outTo.length!==outEdge.length)throw Error('道路索引の長さが不正です。');
    for(let i=0;i<from.length;i++){
      if(from[i]>=n||to[i]>=n||geoOffsets[i+1]<geoOffsets[i])throw Error('道路索引の接続が不正です。');
      owner.fill(i,geoOffsets[i],geoOffsets[i+1]);offsets[from[i]+1]++;if(flags[i]&1)offsets[to[i]+1]++;
    }
    for(let i=1;i<offsets.length;i++)offsets[i]+=offsets[i-1];if(offsets.at(-1)!==outTo.length)throw Error('道路索引の件数が不正です。');
    const positions=offsets.slice();for(let i=0;i<from.length;i++){let at=positions[from[i]]++;outTo[at]=to[i];outEdge[at]=i;if(flags[i]&1){at=positions[to[i]]++;outTo[at]=from[i];outEdge[at]=i;}}
  }
  return out;
}
