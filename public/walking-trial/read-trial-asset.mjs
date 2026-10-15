// Browsers decode Content-Encoding automatically. A .gz static asset may arrive
// either decoded by the host or still gzip encoded. Inspect the body, not headers.
export async function readTrialAsset(response, compressed) {
 if(!compressed)return response.arrayBuffer();
 if(!response.body)throw Error('データ本文を読み込めませんでした。');
 const reader=response.body.getReader(),prefix=[];let length=0;
 while(length<2){const {value,done}=await reader.read();if(done)break;if(value?.length){prefix.push(value);length+=value.length;}}
 const head=[];outer:for(const chunk of prefix)for(const byte of chunk){head.push(byte);if(head.length===2)break outer;} // Only first two are used below.
 const gzip=head[0]===31&&head[1]===139;
 const stream=new ReadableStream({start(controller){for(const value of prefix)controller.enqueue(value);},async pull(controller){try{const {value,done}=await reader.read();if(done)controller.close();else controller.enqueue(value);}catch(error){controller.error(error);}},cancel(reason){return reader.cancel(reason);}});
 return new Response(gzip?stream.pipeThrough(new DecompressionStream('gzip')):stream).arrayBuffer();
}
