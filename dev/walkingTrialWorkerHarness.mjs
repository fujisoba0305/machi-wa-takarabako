import {parentPort,workerData} from 'node:worker_threads';import fs from 'node:fs';
globalThis.self=globalThis;globalThis.postMessage=x=>parentPort.postMessage(x);
const actualFetch=globalThis.fetch;if(workerData?.base&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(workerData.base))throw Error('External API prohibited');
globalThis.fetch=async(url)=>{if(typeof url!=='string'||!url.startsWith(workerData?.modern?'/walking-v30/':'/walking-trial/'))throw Error('External API prohibited');if(workerData?.base)return actualFetch(workerData.base+url);return new Response(fs.readFileSync(new URL('../public'+url,import.meta.url)));};
await import(workerData?.modern?(workerData?.built?'../dist/walking-v30/runtime/worker.mjs':'../public/walking-v30/runtime/worker.mjs'):workerData?.built?'../dist/walking-trial/route-worker.mjs':'../public/walking-trial/route-worker.mjs');parentPort.on('message',data=>self.onmessage({data}));
