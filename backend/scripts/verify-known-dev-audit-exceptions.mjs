import { readFile } from 'node:fs/promises';

const [auditPath, lockPath] = process.argv.slice(2);
if (!auditPath || !lockPath) {
  throw new Error('Usage: node verify-known-dev-audit-exceptions.mjs <audit.json> <package-lock.json>');
}

const [audit, lock] = await Promise.all([
  readFile(auditPath, 'utf8').then(JSON.parse),
  readFile(lockPath, 'utf8').then(JSON.parse),
]);

const allowedPackages = new Set([
  'braces',
  'chokidar',
  'nodemon',
]);
const knownAdvisory = 'GHSA-vfj7-8cjw-p6xm';
const serious = Object.entries(audit.vulnerabilities || {})
  .filter(([, finding]) => ['high', 'critical'].includes(finding.severity));

const unexpected = serious.filter(([name]) => !allowedPackages.has(name));
if (unexpected.length) {
  throw new Error(
    `Unexpected high/critical backend audit findings: ${unexpected.map(([name]) => name).join(', ')}`,
  );
}

if (!serious.length) {
  console.log('Backend full dependency audit has no high/critical findings.');
  process.exit(0);
}

const bracesFinding = audit.vulnerabilities?.braces;
const advisoryFound = Array.isArray(bracesFinding?.via) && bracesFinding.via.some(item =>
  typeof item === 'object' && String(item.url || '').includes(knownAdvisory)
);
if (!advisoryFound) {
  throw new Error(`Expected the known ${knownAdvisory} advisory for braces, but it was not present`);
}

const lockPackages = lock.packages || {};
const packagePaths = {
  braces: ['node_modules/braces'],
  chokidar: ['node_modules/chokidar'],
  nodemon: ['node_modules/nodemon'],
};

for (const [name] of serious) {
  const entries = (packagePaths[name] || []).map(path => lockPackages[path]).filter(Boolean);
  if (!entries.length) throw new Error(`Could not prove ${name} is dev-only from package-lock.json`);
  if (entries.some(entry => entry.dev !== true)) {
    throw new Error(`Known audit exception ${name} is no longer dev-only`);
  }
}

console.warn(
  `Accepted known dev-only backend audit exception ${knownAdvisory}; production dependencies were audited separately. ` +
  'Remove this exception when the upstream chokidar/nodemon chain no longer depends on an affected braces release.',
);
