import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const lhciArgs = args.length > 0 ? args : ['autorun'];

// Store the scoped @lhci/cli runner inside the workspace cache rather than the shared OS temp directory.
const installDir = join(frontendRoot, 'node_modules', '.cache', 'lhci-runner');
const pkgPath = join(installDir, 'package.json');
const cliEntry = join(installDir, 'node_modules', '@lhci', 'cli', 'src', 'cli.js');

// Override deprecated transitive dependencies of @lhci/cli@0.15.1:
// - chrome-launcher 0.13.4 -> 0.15.2 (removes rimraf@3.0.2 -> glob@7.2.3 -> inflight@1.0.6)
// - tmp 0.1.0 -> 0.2.5 (removes rimraf@2.7.1 -> glob@7.2.3 -> inflight@1.0.6)
// - uuid 8.3.2 -> 11.1.1 (replaces deprecated uuid@8 with supported CommonJS uuid@11)
const expectedManifest = JSON.stringify(
  {
    private: true,
    dependencies: {
      '@lhci/cli': '0.15.1',
    },
    overrides: {
      '@lhci/cli': {
        'chrome-launcher': '0.15.2',
        tmp: '0.2.5',
        uuid: '11.1.1',
      },
    },
  },
  null,
  2,
);

mkdirSync(installDir, { recursive: true, mode: 0o700 });
writeFileSync(pkgPath, expectedManifest, { mode: 0o600 });

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const installResult = spawnSync(
  npmCmd,
  ['install', '--no-audit', '--no-fund', '--prefer-offline'],
  {
    cwd: installDir,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
  },
);

if (installResult.status !== 0) {
  process.exit(installResult.status ?? 1);
}

const env = { ...process.env };
if (!env.CHROME_PATH) {
  try {
    const { chromium } = await import('playwright-core');
    const pwChrome = chromium.executablePath();
    if (pwChrome) {
      env.CHROME_PATH = pwChrome;
    }
  } catch {
    // Fall back to system Chrome detection inside @lhci/cli
  }
}

const runResult = spawnSync(process.execPath, [cliEntry, ...lhciArgs], {
  cwd: frontendRoot,
  stdio: ['ignore', 'inherit', 'inherit'],
  env,
});

process.exit(runResult.status ?? 1);
