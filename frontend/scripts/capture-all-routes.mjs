import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const { values: options } = parseArgs({
  options: {
    theme: { type: 'string', default: 'light' },
    project: { type: 'string', default: 'all' },
    mobile: { type: 'boolean', default: false },
    desktop: { type: 'boolean', default: false },
  },
  strict: false,
});

let themes = [];
if (options.theme === 'both' || options.theme === 'all') {
  themes = ['light', 'dark'];
} else if (options.theme === 'dark' || options.theme === 'light') {
  themes = [options.theme];
} else {
  throw new Error('Choose --theme=light, --theme=dark, or --theme=all.');
}

let projects = ['mobile', 'desktop'];
if (options.mobile && !options.desktop) {
  projects = ['mobile'];
} else if (options.desktop && !options.mobile) {
  projects = ['desktop'];
} else if (options.project === 'mobile') {
  projects = ['mobile'];
} else if (options.project === 'desktop') {
  projects = ['desktop'];
} else if (options.project !== 'all') {
  throw new Error('Choose --project=mobile, --project=desktop, or --project=all.');
}

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SCREENSHOT_DIR = path.join(ROOT, 'screenshots');
const DOWNLOAD_DIR = String.raw`C:\Users\91906\Downloads`;
const ARCHIVE_ROOT = 'Meow-All-Routes-Screenshots';
const playwrightCLI = require.resolve('@playwright/test/cli');
const captureEnv = {
  ...process.env,
  API_URL: 'http://127.0.0.1:3111',
  NEXT_PUBLIC_API_URL: '/backend-api',
  NEXT_PUBLIC_SOCKET_URL: 'http://127.0.0.1:3111',
  SCREENSHOT_THEME: themes[0],
  PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(SCREENSHOT_DIR, 'capture-report.json'),
};

function runNode(args) {
  execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: captureEnv });
}

function screenshotCount(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((count, entry) => {
    if (entry.isDirectory()) return count + screenshotCount(path.join(dir, entry.name));
    return count + Number(entry.name === 'screenshot.png');
  }, 0);
}

function testsInSuites(suites = []) {
  return suites.flatMap(suite => [
    ...(suite.specs ?? []).flatMap(spec => spec.tests ?? []),
    ...testsInSuites(suite.suites),
  ]);
}

function timestamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}_${values.hour}-${values.minute}-${values.second}`;
}

function uniqueZipPath(theme) {
  const projectSuffix = projects.length === 1 ? `_${projects[0]}` : '';
  const basename = `${ARCHIVE_ROOT}${theme === 'dark' ? '_dark' : ''}${projectSuffix}_${timestamp()}`;
  let destination = path.join(DOWNLOAD_DIR, `${basename}.zip`);
  for (let suffix = 2; fs.existsSync(destination); suffix++) {
    destination = path.join(DOWNLOAD_DIR, `${basename}_${suffix}.zip`);
  }
  return destination;
}

function powershellLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function main() {
  if (process.platform !== 'win32') throw new Error('This command uses Windows PowerShell to save the ZIP in C:\\Users\\91906\\Downloads.');
  console.log(`\nMeow Route Screenshot Capture (${themes.join(', ')} theme(s) | Projects: ${projects.join(', ')})\n`);

  if (!process.env.PLAYWRIGHT_CHANNEL && !fs.existsSync(chromium.executablePath())) {
    console.log('Installing the Playwright Chromium browser...');
    runNode([playwrightCLI, 'install', 'chromium']);
  }

  console.log('\nBuilding the current frontend for the existing Playwright server...\n');
  runNode([require.resolve('next/dist/bin/next'), 'build']);

  let anyCaptureFailed = false;

  for (const theme of themes) {
    captureEnv.SCREENSHOT_THEME = theme;
    console.log(`\n======================================================`);
    console.log(`Capturing all routes in ${theme} theme on ${projects.join(', ')}...`);
    console.log(`======================================================\n`);

    // Both recursive cleanup targets are fixed children of known directories.
    if (path.dirname(SCREENSHOT_DIR) !== path.resolve(ROOT)) throw new Error('Invalid screenshot directory.');
    console.log('Cleaning previous temporary screenshots...');
    fs.rmSync(SCREENSHOT_DIR, { recursive: true, force: true });
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    let captureFailed = false;
    const projectArgs = projects.map(project => `--project=${project}`);
    try {
      runNode([playwrightCLI, 'test', 'e2e/all-routes-screenshots.spec.ts', ...projectArgs, '--reporter=list,json']);
    } catch {
      captureFailed = true;
      console.warn('\nSome captures failed. Available screenshots will still be zipped.\n');
    }

    const counts = Object.fromEntries(projects.map(project => [project, screenshotCount(path.join(SCREENSHOT_DIR, project))]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) throw new Error('No screenshots were generated; no ZIP was created. See the Playwright output above.');
    const reportPath = path.join(SCREENSHOT_DIR, 'capture-report.json');
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const browserErrorCaptures = testsInSuites(report.suites).filter(test =>
        test.annotations?.some(annotation => annotation.type === 'page-errors'),
      ).length;
      if (browserErrorCaptures) console.warn(`${browserErrorCaptures} screenshot(s) include browser errors. See capture-report.json for details.`);
      if (report.stats?.skipped) {
        captureFailed = true;
        console.warn(`${report.stats.skipped} captures were skipped. See capture-report.json for unresolved routes.`);
      }
    }
    for (const project of projects) {
      if (!counts[project]) captureFailed = true;
    }

    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const zipPath = uniqueZipPath(theme);
    const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meow-route-screenshots-'));
    try {
      // Compress the named folder itself, so it is the ZIP's top-level directory.
      const archiveFolder = path.join(stagingDir, ARCHIVE_ROOT);
      fs.cpSync(SCREENSHOT_DIR, archiveFolder, { recursive: true });
      console.log('\nCreating ZIP...\n');
      execFileSync('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        `$ErrorActionPreference = 'Stop'; Compress-Archive -LiteralPath ${powershellLiteral(archiveFolder)} -DestinationPath ${powershellLiteral(zipPath)} -CompressionLevel Optimal`,
      ], { stdio: 'inherit' });
    } finally {
      const resolvedStaging = path.resolve(stagingDir);
      if (path.dirname(resolvedStaging) === path.resolve(os.tmpdir()) && path.basename(resolvedStaging).startsWith('meow-route-screenshots-')) {
        fs.rmSync(resolvedStaging, { recursive: true, force: true });
      }
    }

    const zipSize = fs.statSync(zipPath).size / (1024 * 1024);
    console.log(`\n${captureFailed ? 'PARTIAL CAPTURE ARCHIVED' : 'SCREENSHOTS COMPLETE'}`);
    console.log(`Theme: ${theme}`);
    console.log(projects.map(p => `${p.charAt(0).toUpperCase() + p.slice(1)}: ${counts[p]} screenshots`).join(' | '));
    console.log(`ZIP: ${zipPath}\nSize: ${zipSize.toFixed(2)} MB\n`);
    if (captureFailed) anyCaptureFailed = true;
  }

  if (anyCaptureFailed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`\nScreenshot capture failed: ${error.message}`);
  process.exitCode = 1;
}
