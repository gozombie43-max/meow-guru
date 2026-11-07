import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CRITICAL_SMOKE_SPECS = [
  'e2e/assessment.spec.ts',
  'e2e/resource.spec.ts',
  'e2e/web-guidelines.spec.ts',
];

export const DESKTOP_FULL_SPECS = [
  ...CRITICAL_SMOKE_SPECS,
  'e2e/navigation.spec.ts',
  'e2e/mock-flow-navigation.spec.ts',
  'e2e/architecture.spec.ts',
  'e2e/concept-group-status.spec.ts',
  'e2e/remaining-performance.spec.ts',
  'e2e/training-play.spec.ts',
  'e2e/performance.spec.ts',
  'e2e/ai-chat.spec.ts',
  'e2e/iit-jam-mode.spec.ts',
  'e2e/paper-image-zip.spec.ts',
  'e2e/question-bank-image-zip.spec.ts',
];

export const MOBILE_FULL_SPECS = [
  ...CRITICAL_SMOKE_SPECS,
  'e2e/mock-flow-navigation.spec.ts',
  'e2e/architecture.spec.ts',
  'e2e/mobile-quiz-design.spec.ts',
  'e2e/home-hero-carousel.spec.ts',
  'e2e/remaining-performance.spec.ts',
  'e2e/training-play.spec.ts',
  'e2e/performance.spec.ts',
  'e2e/ai-chat.spec.ts',
  'e2e/iit-jam-mode.spec.ts',
];

// Risk-based trigger rules mapping changed paths to targeted E2E suites on pull requests.
// Backend API changes are covered by backend unit/integration suites + CRITICAL_SMOKE_SPECS.
const RISK_RULES = [
  {
    name: 'auth-and-session',
    pattern:
      /^frontend\/(?:proxy\.ts|lib\/early-session|context\/Auth|app\/\(auth\)\/|app\/access-code\/)/,
    specs: ['e2e/remaining-performance.spec.ts'],
  },
  {
    name: 'quiz-engine',
    pattern:
      /^frontend\/(?:features\/quiz\/|hooks\/useQuiz|hooks\/useQuestions|app\/\(app\)\/\(subjects\)\/|components\/LangToggle)/,
    specs: [
      'e2e/architecture.spec.ts',
      'e2e/mobile-quiz-design.spec.ts',
      'e2e/concept-group-status.spec.ts',
      'e2e/remaining-performance.spec.ts',
    ],
  },
  {
    name: 'navigation-controller',
    pattern: /^frontend\/lib\/navigation-controller/,
    specs: ['e2e/navigation.spec.ts', 'e2e/mock-flow-navigation.spec.ts'],
  },
  {
    name: 'exam-mode-and-jam',
    pattern: /^frontend\/(?:lib\/exam-mode|app\/\(app\)\/subjects\/iit-jam)/,
    specs: ['e2e/iit-jam-mode.spec.ts'],
  },
  {
    name: 'mock-test-navigation-and-review',
    pattern:
      /^frontend\/app\/\(app\)\/mock-test\/(?:\[examSlug\]\/\[testId\]\/(?:review|result)|_shared\/(?:MockTestShell|MockReview|MockResult))/,
    specs: ['e2e/mock-flow-navigation.spec.ts'],
  },
  {
    name: 'training-ui-and-play',
    pattern:
      /^frontend\/(?:app\/\(app\)\/play\/|components\/training\/(?!session\/hooks\/))/,
    specs: ['e2e/training-play.spec.ts', 'e2e/performance.spec.ts'],
  },
  {
    name: 'ai-tutor-and-chat',
    pattern: /^frontend\/(?:app\/\(app\)\/ai-chat\/|components\/.*Tutor)/,
    specs: ['e2e/ai-chat.spec.ts', 'e2e/remaining-performance.spec.ts'],
  },
  {
    name: 'admin-and-uploads',
    pattern: /^frontend\/app\/admin/,
    specs: ['e2e/paper-image-zip.spec.ts', 'e2e/question-bank-image-zip.spec.ts'],
  },
  {
    name: 'css-and-responsive-layout',
    pattern:
      /^frontend\/(?:app\/[^/]+\.css$|app\/\(app\)\/page\.tsx$|components\/(?:Header|Sidebar|Mobile))/,
    specs: [
      'e2e/home-hero-carousel.spec.ts',
      'e2e/mobile-quiz-design.spec.ts',
      'e2e/architecture.spec.ts',
    ],
  },
];

export function selectE2ESpecs({
  project = 'desktop',
  eventName = 'pull_request',
  ref = '',
  changedFiles = null,
} = {}) {
  if (project !== 'desktop' && project !== 'mobile') {
    throw new Error(`Unsupported Playwright project: ${project}`);
  }
  const allowedPool = project === 'desktop' ? DESKTOP_FULL_SPECS : MOBILE_FULL_SPECS;
  const allowedSet = new Set(allowedPool);

  const isMainBranchPush =
    eventName === 'push' && (ref === 'refs/heads/main' || ref === 'refs/heads/master');
  const isFullSuiteEvent =
    isMainBranchPush || eventName === 'schedule' || eventName === 'workflow_dispatch';

  if (
    isFullSuiteEvent ||
    !Array.isArray(changedFiles) ||
    changedFiles.length === 0
  ) {
    return [...allowedPool];
  }

  const selected = new Set(CRITICAL_SMOKE_SPECS.filter(spec => allowedSet.has(spec)));
  let matchedAppRule = false;

  for (const file of changedFiles) {
    for (const rule of RISK_RULES) {
      if (rule.pattern.test(file)) {
        matchedAppRule = true;
        for (const spec of rule.specs) {
          if (allowedSet.has(spec)) selected.add(spec);
        }
      }
    }
  }

  if (!matchedAppRule) {
    for (const file of changedFiles) {
      if (file.startsWith('frontend/e2e/') && file.endsWith('.spec.ts')) {
        const relSpec = file.slice('frontend/'.length);
        if (allowedSet.has(relSpec)) selected.add(relSpec);
      }
    }
  }

  return allowedPool.filter(spec => selected.has(spec));
}

export function resolveChangedFiles({
  baseRef = process.env.GITHUB_BASE_REF || 'main',
  cwd = process.cwd(),
} = {}) {
  const candidates = [`origin/${baseRef}...HEAD`, `${baseRef}...HEAD`, 'HEAD~1...HEAD'];
  for (const range of candidates) {
    try {
      const out = execFileSync('git', ['diff', '--name-only', '-z', range], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const files = out.split('\0').filter(Boolean);
      if (files.length > 0) return files;
    } catch {
      // Try next diff range candidate
    }
  }
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const projectArg = args.find(arg => arg.startsWith('--project='));
  const project = projectArg ? projectArg.slice('--project='.length) : 'desktop';
  const shouldRun = args.includes('--run');
  const passthrough = args.filter(arg => arg !== '--run' && !arg.startsWith('--project='));

  const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const repoRoot = resolve(frontendDir, '..');
  const eventName = process.env.GITHUB_EVENT_NAME || 'pull_request';
  const ref = process.env.GITHUB_REF || '';
  const changedFiles = resolveChangedFiles({ cwd: repoRoot });
  const specs = selectE2ESpecs({ project, eventName, ref, changedFiles });

  console.log(
    `[e2e-selector] project=${project} event=${eventName} specs=${specs.length}/${
      project === 'desktop' ? DESKTOP_FULL_SPECS.length : MOBILE_FULL_SPECS.length
    }: ${specs.join(' ')}`,
  );

  if (shouldRun) {
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const result = spawnSync(
      npxCmd,
      ['playwright', 'test', ...specs, `--project=${project}`, ...passthrough],
      {
        cwd: frontendDir,
        stdio: ['ignore', 'inherit', 'inherit'],
        shell: process.platform === 'win32',
        env: process.env,
      },
    );
    process.exit(result.status ?? 1);
  }
}
