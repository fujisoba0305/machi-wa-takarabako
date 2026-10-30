import {afterEach, expect, it} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {finalizeWalkingOutput} from '../scripts-finalize-walking-v30.mjs';

const roots:string[]=[];
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'machi-build-output-')); roots.push(root);
  for(const [file,body] of Object.entries({'dist/index.html':'app','dist/walking-trial/old.json':'old','dist/walking-v30/data/roads.gz':'road','dist/facilities-kanto-v3/tile.json':'facility','public/walking-v30/data/roads.gz':'source','assets/walking-v30/part-000.bin':'archive'})){
    const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);
  }return root;
}
afterEach(()=>{for(const root of roots.splice(0)){if(!root.startsWith(path.join(os.tmpdir(),'machi-build-output-')))throw Error('Unsafe test cleanup');fs.rmSync(root,{recursive:true,force:true});}});
it('omits only legacy build output, keeps facilities and originals, and is idempotent',()=>{
  const root=fixture();expect(finalizeWalkingOutput(root,'off').excluded).toEqual(['walking-trial','walking-v30']);
  expect(fs.existsSync(path.join(root,'dist/walking-v30'))).toBe(false);
  for(const [file,body] of Object.entries({'dist/index.html':'app','dist/facilities-kanto-v3/tile.json':'facility','public/walking-v30/data/roads.gz':'source','assets/walking-v30/part-000.bin':'archive'}))expect(fs.readFileSync(path.join(root,file),'utf8')).toBe(body);
  expect(()=>finalizeWalkingOutput(root,'off')).not.toThrow();
});
it('can explicitly rebuild with legacy road output without restoring obsolete regional data',()=>{
  const root=fixture();expect(finalizeWalkingOutput(root,'on').legacyIncluded).toBe(true);
  expect(fs.readFileSync(path.join(root,'dist/walking-v30/data/roads.gz'),'utf8')).toBe('road');expect(fs.existsSync(path.join(root,'dist/walking-trial'))).toBe(false);
});
it('refuses invalid configuration or a non-build directory before changing output',()=>{
  const root=fixture();expect(()=>finalizeWalkingOutput(root,'yes')).toThrow();
  fs.renameSync(path.join(root,'dist/index.html'),path.join(root,'dist/not-a-build.html'));
  expect(()=>finalizeWalkingOutput(root,'off')).toThrow();expect(fs.existsSync(path.join(root,'dist/walking-v30/data/roads.gz'))).toBe(true);expect(fs.existsSync(path.join(root,'dist/walking-trial/old.json'))).toBe(true);
});
it('refuses a redirected output target and keeps the external directory intact',()=>{
  const root=fixture(),external=fixture();fs.rmSync(path.join(root,'dist/walking-v30'),{recursive:true});fs.symlinkSync(path.join(external,'public/walking-v30'),path.join(root,'dist/walking-v30'),'junction');
  expect(()=>finalizeWalkingOutput(root,'off')).toThrow();expect(fs.existsSync(path.join(root,'dist/walking-trial/old.json'))).toBe(true);expect(fs.readFileSync(path.join(external,'public/walking-v30/data/roads.gz'),'utf8')).toBe('source');
});
