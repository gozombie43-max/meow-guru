import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Run this from the extracted artifact, so the checkout cannot hide omissions.
// Resolve from each workspace: npm can install dependencies locally or hoist them.
const workspaces = ['backend', 'contracts'];
let failures = 0;
for (const workspace of workspaces) {
  const actualUrl = new URL(`../../${workspace}/package.json`, import.meta.url);
  const manifest = JSON.parse(readFileSync(actualUrl, 'utf8'));
  const require = createRequire(actualUrl);
  for (const dependency of Object.keys(manifest.dependencies || {})) {
    const specifiers = dependency === '@meow/contracts'
      ? Object.keys(JSON.parse(readFileSync(new URL('../../contracts/package.json', import.meta.url), 'utf8')).exports)
        .map((key) => `${dependency}${key.slice(1)}`)
      : [dependency];
    for (const specifier of specifiers) {
      try {
        require.resolve(specifier);
      } catch (error) {
        failures++;
        console.error(`${workspace}: cannot resolve ${specifier}: ${error.code}`);
      }
    }
  }
}
if (failures) {
  console.error(`Production artifact has ${failures} missing dependency entry points.`);
  process.exitCode = 1;
} else {
  console.log('Production dependency entry points resolve from backend and contracts.');
}
