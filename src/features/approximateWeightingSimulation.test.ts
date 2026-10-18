import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { approximateCandidateProbabilities, selectApproximateWeighted } from './approximateCandidateWeighting';
const rng=(seed:number)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/2**32);

it('simulates identical held-out category pools at every distance without routing or network',()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/approximateWeightingModel.json',import.meta.url),'utf8')) as {
   groups:{originLabel:string;band:number;category:string;candidates:{distanceKm:number;modelRoadMeters:number}[]}[]
 };
 const groups:any[]=[],draws=10000;
 for(const {originLabel:origin,band,category,candidates} of fixture.groups){
   if(!candidates.length){groups.push({origin,band,category,n:0});continue;}
   const p=approximateCandidateProbabilities(candidates.map((r:any)=>r.distanceKm),band),uniform=candidates.map(()=>1/candidates.length);
   const errors=candidates.map((r:any)=>Math.abs(r.modelRoadMeters-band*1000));
   const before=rng(123+groups.length),after=rng(123+groups.length),countBefore=candidates.map(()=>0),countAfter=candidates.map(()=>0);
   for(let i=0;i<draws;i++){
     countBefore[Math.floor(before()*candidates.length)]++;
     countAfter[candidates.indexOf(selectApproximateWeighted(candidates,band,after)!)]++;
   }
   const mean=(values:number[],prob:number[])=>values.reduce((s,v,i)=>s+v*prob[i],0);
   const observedBefore=countBefore.map(n=>n/draws),observedAfter=countAfter.map(n=>n/draws);
   for(let i=0;i<p.length;i++)expect(Math.abs(observedAfter[i]-p[i])).toBeLessThan(.025);
   expect(countAfter.every(n=>n>0)).toBe(true);
   groups.push({origin,band,category,n:candidates.length,draws,uniformExpectedErrorM:mean(errors,uniform),weightedExpectedErrorM:mean(errors,p),uniformSimulatedErrorM:mean(errors,observedBefore),weightedSimulatedErrorM:mean(errors,observedAfter),maxProbability:Math.max(...p),maxObservedShare:Math.max(...observedAfter),effectiveCandidates:1/p.reduce((s,v)=>s+v*v,0),countBefore,countAfter,probabilities:p});
 }
 const summarize=(g:any[])=>{const found=g.filter(x=>x.n),mean=(key:string)=>found.reduce((s,r)=>s+r[key],0)/found.length;const before=mean('uniformExpectedErrorM'),after=mean('weightedExpectedErrorM');return {conditions:g.length,resolvedConditions:found.length,emptySampleConditions:g.length-found.length,uniformExpectedErrorM:before,weightedExpectedErrorM:after,improvementPercent:(before-after)/before*100,uniformSimulatedErrorM:mean('uniformSimulatedErrorM'),weightedSimulatedErrorM:mean('weightedSimulatedErrorM'),meanEffectiveCandidates:mean('effectiveCandidates'),meanPoolSize:mean('n'),maxProbabilityAmongMultiCandidatePools:Math.max(...found.filter(r=>r.n>1).map(r=>r.maxProbability)),worsenedConditions:found.filter(r=>r.weightedExpectedErrorM>r.uniformExpectedErrorM+.0001).length,unchangedSingleCandidateConditions:found.filter(r=>r.n===1).length};};
 const candidates=Array.from({length:508},(_,i)=>({distanceKm:8+i/508})),random=rng(4),start=performance.now();
 for(let i=0;i<1000;i++)selectApproximateWeighted(candidates,10,random);
 const selectionMs=(performance.now()-start)/1000;
 const result={coefficient:1.1435,minimumUniformShare:.2,maximumCandidateShareWhenMultiple:.65,drawsPerPool:draws,scope:'OSM road/block model, NOT Google or field walking; fixed strict-heldout sampled pools; unresolved routes excluded explicitly',overall:summarize(groups),byBand:Object.fromEntries([1,3,5,10].map(b=>[b,summarize(groups.filter(r=>r.band===b))])),pcSelectionMsFor508Candidates:selectionMs,extraApiCalls:0,extraTransferBytes:0,groups};
 if(process.env.APPROXIMATE_WEIGHT_REPORT) fs.writeFileSync(path.resolve(process.env.APPROXIMATE_WEIGHT_REPORT),JSON.stringify(result,null,2));
 expect(groups).toHaveLength(80);expect(result.overall.resolvedConditions).toBe(73);
},30000);
