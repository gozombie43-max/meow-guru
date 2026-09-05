import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';

const build = resolve('.next');
const budget = JSON.parse(await readFile('performance-budget.json', 'utf8'));
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(join(dir, e.name)) : join(dir, e.name)))).flat();
}
const manifests = (await walk(join(build, 'server/app'))).filter(f => f.endsWith('page_client-reference-manifest.js'));
if (!manifests.length) throw new Error('No client manifests found; run the production build first.');
const sizes = new Map();
const rows = [];
for (const file of manifests) {
  const sandbox = { globalThis: {} };
  vm.runInNewContext(await readFile(file, 'utf8'), sandbox, { timeout: 1000 });
  for (const [route, manifest] of Object.entries(sandbox.globalThis.__RSC_MANIFEST ?? {})) {
    const chunks = [...new Set(Object.values(manifest.entryJSFiles ?? {}).flat())].filter(f => f.endsWith('.js'));
    if (!chunks.length) throw new Error(`No entry chunks found for ${route}; inspect manifest format.`);
    let gzipBytes = 0;
    for (const chunk of chunks) {
      const name = chunk.replace(/^\/_next\//, '').replace(/^\//, '');
      const path = resolve(build, name);
      if (!path.startsWith(build + '/')) {
        // Windows uses backslashes in resolved paths.
        if (!path.startsWith(build + '\\')) throw new Error('Invalid chunk path');
      }
      if (!sizes.has(path)) sizes.set(path, gzipSync(await readFile(path)).length);
      gzipBytes += sizes.get(path);
    }
    rows.push({ route, gzipBytes, limit: route.includes('(auth)') ? budget.authEntryGzipBytes : budget.routeEntryGzipBytes });
  }
}
rows.sort((a, b) => b.gzipBytes - a.gzipBytes);
await stat(join(build, 'diagnostics'));
await writeFile(join(build, 'diagnostics/performance-budget.json'), JSON.stringify(rows, null, 2));
console.table(rows.slice(0, 10));
const failures = rows.filter(row => row.gzipBytes > row.limit);
if (failures.length) throw new Error(`Entry JS budget exceeded: ${failures.map(row => row.route).join(', ')}`);
