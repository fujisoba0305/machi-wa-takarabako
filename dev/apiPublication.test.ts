import {it,expect,afterEach} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {inspectApiLayout} from '../scripts-verify-api-layout.mjs';
const expected=['api/my-treasures.ts','api/overpass.ts','api/treasure-card.ts','api/treasure-post.ts','api/walking-distance.ts','api/walking-trial-access.ts'];
const roots:string[]=[];function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'machi-api-'));roots.push(root);fs.mkdirSync(root+'/api');for(const p of expected)fs.writeFileSync(root+'/'+p,'fixture');return root;}
afterEach(()=>{for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true});});
it('allows exactly the six production APIs in the real routing directory',()=>{expect(inspectApiLayout(process.cwd()).entrypoints).toEqual(expected);});
it.each(['my-treasures.test.ts','treasure-post.spec.ts','debug.ts','fixture.js','helper.py','nested/development.ts'])('fails closed instead of publishing api/%s',file=>{const root=fixture(),p=root+'/api/'+file;fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'private fixture');expect(()=>inspectApiLayout(root)).toThrow('extra=');});
it('rejects a missing API rather than silently reducing coverage',()=>{const root=fixture();fs.unlinkSync(root+'/api/my-treasures.ts');expect(()=>inspectApiLayout(root)).toThrow('missing=api/my-treasures.ts');});
it('keeps the guard in both build and test preparation',()=>{const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));for(const key of ['prebuild','pretest'])expect(pkg.scripts[key]).toMatch(/^node scripts-verify-api-layout\.mjs && /);expect(pkg.scripts['typecheck:api']).toContain('tests/api/my-treasures.test.ts');expect(pkg.scripts['typecheck:api']).toContain('tests/api/treasure-post.test.ts');});
