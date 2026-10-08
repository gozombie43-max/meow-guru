import { copyFile, readdir } from 'node:fs/promises';

const contractsRoot = new URL('../', import.meta.url);
const buildRoot = new URL('build/', contractsRoot);

// Emit away from checked-in declarations: resolving a sibling .js import can
// read its existing .d.ts, which must not also be the compiler's output file.
for (const name of await readdir(buildRoot)) {
  if (name.endsWith('.d.ts')) {
    await copyFile(new URL(name, buildRoot), new URL(name, contractsRoot));
  }
}
