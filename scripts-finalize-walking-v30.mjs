import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Only generated production output is pruned. Public sources and the verified
// archives remain available for local tests and an explicit legacy rebuild.
export function finalizeWalkingOutput(root, setting = process.env.MACHI_INCLUDE_LEGACY_WALKING_DATA) {
  if (setting !== undefined && setting !== 'off' && setting !== 'on') throw Error('Invalid legacy walking output setting');
  const base = fs.realpathSync(root), output = path.join(base, 'dist');
  if (!fs.existsSync(output) || fs.lstatSync(output).isSymbolicLink() || !fs.statSync(output).isDirectory() || !fs.existsSync(path.join(output, 'index.html'))) throw Error('Expected generated dist with index.html');
  const realOutput = fs.realpathSync(output);
  if (realOutput !== output) throw Error('Refusing redirected build output');
  const targets = setting === 'on' ? ['walking-trial'] : ['walking-trial', 'walking-v30'];
  // Check every target before deleting any generated directory.
  const paths = targets.map(name => {
    const target = path.resolve(output, name);
    if (path.dirname(target) !== realOutput || (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink())) throw Error('Invalid generated output path');
    return target;
  });
  for (const target of paths) fs.rmSync(target, {recursive:true, force:true});
  return {excluded:targets, legacyIncluded:setting === 'on'};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  console.log(JSON.stringify(finalizeWalkingOutput(root)));
}
