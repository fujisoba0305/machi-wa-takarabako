import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from 'node:url';
const root=path.resolve(fileURLToPath(new URL('./',import.meta.url))),output=path.resolve(root,'dist'),obsolete=path.resolve(output,'walking-trial');
if(!obsolete.startsWith(output+path.sep)||path.basename(obsolete)!=='walking-trial')throw Error('Invalid generated output path');
// Only generated build output; the existing public source and prototype remain intact.
fs.rmSync(obsolete,{recursive:true,force:true});console.log('Excluded obsolete regional trial assets from production output');
