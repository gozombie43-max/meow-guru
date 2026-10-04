import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const failures = [];
function inspect(folder) {
  for (const entry of readdirSync(join(root, folder), { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== '__tests__') { inspect(join(folder, entry.name)); continue; }
    if (!entry.isFile() || !entry.name.endsWith('.js') || entry.name.includes('.test.')) continue;
    const source = readFileSync(join(root, folder, entry.name), 'utf8');
    if (/from\s*['"][^'"]*config\/mongodb\.js['"]|\.collection\s*\(/.test(source)) failures.push(`${folder}/${entry.name}: transport cannot own Mongo persistence`);
  }
}
for (const folder of ['routes', 'controllers', 'agents']) inspect(folder);
for (const path of [
  'services/questionService.js', 'services/tutorJobs.js', 'services/conceptGroupingWorker.js',
  'services/questions/questionCache.js', 'services/questions/questionMetadataCache.js',
  'services/questions/topicCountSnapshot.js', 'services/questions/conceptGroupService.js',
  'services/training/application/rebuildLearnerState.js',
]) {
  const source = readFileSync(join(root, path), 'utf8');
  if (/from\s*['"][^'"]*config\/mongodb\.js['"]|\.collection\s*\(/.test(source)) failures.push(`${path}: application code must use domain persistence APIs`);
}
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const name of ['@azure/cosmos', '@azure/storage-blob']) {
  if (manifest.dependencies[name]) failures.push(`${name} belongs to tools/azure-migration`);
}
if (failures.length) throw new Error(failures.join('\n'));
console.log('Runtime boundaries passed: transport uses domain persistence APIs; migration SDKs are isolated.');
