import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  getStageProfile,
  LOCAL_DEFAULT_BASE_URL,
  stripUrlCredentials,
  validateTargetEnvironment,
} from '../config/environment.js';
import { detectK6Binary, formatPreflightSummary, redactSecrets, runPreflight } from './preflight.mjs';

// ============================================================================
// Meow k6 Cross-Platform Test Runner & Report Orchestrator
// ============================================================================

export const SCENARIO_SCRIPTS = Object.freeze({
  'mixed-workload': 'load-tests/k6/scenarios/mixed-workload.js',
  suite: 'load-tests/k6/scenarios/mixed-workload.js',
  'production-readiness': 'load-tests/k6/meow-production-readiness.js',
  authentication: 'load-tests/k6/scenarios/authentication.js',
  auth: 'load-tests/k6/scenarios/authentication.js',
  health: 'load-tests/k6/scenarios/health.js',
  'question-delivery': 'load-tests/k6/scenarios/question-delivery.js',
  'quiz-session': 'load-tests/k6/scenarios/quiz-session.js',
  'user-progress': 'load-tests/k6/scenarios/user-progress.js',
  'meow-question-delivery': 'load-tests/k6/meow-question-delivery.js',
  'legacy-delivery': 'load-tests/k6/meow-question-delivery.js',
});

export function parseRunnerArgs(argv = []) {
  const args = Array.isArray(argv) ? argv : [];
  const opts = {
    env: null,
    profile: null,
    scenario: null,
    baseUrl: null,
    redisMode: null,
    allowStaging: false,
    strictSlo: false,
    skipPreflight: false,
    requireRedis: false,
    requireIndexes: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = String(args[i]);
    const eqIdx = arg.indexOf('=');
    const key = eqIdx !== -1 ? arg.slice(0, eqIdx) : arg;
    const inlineVal = eqIdx !== -1 ? arg.slice(eqIdx + 1) : null;
    const nextVal = () => {
      if (inlineVal !== null) return inlineVal;
      i += 1;
      return args[i];
    };

    switch (key) {
      case '--env':
      case '-e':
        opts.env = nextVal();
        break;
      case '--profile':
      case '--stage':
      case '-p':
        opts.profile = nextVal();
        break;
      case '--scenario':
      case '-s':
        opts.scenario = nextVal();
        break;
      case '--base-url':
      case '-u':
        opts.baseUrl = nextVal();
        break;
      case '--redis-mode':
        opts.redisMode = nextVal();
        break;
      case '--allow-staging':
        opts.allowStaging = true;
        break;
      case '--strict-slo':
        opts.strictSlo = true;
        break;
      case '--skip-preflight':
        opts.skipPreflight = true;
        break;
      case '--require-redis':
        opts.requireRedis = true;
        break;
      case '--require-indexes':
        opts.requireIndexes = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      default:
        throw new Error(`Unknown CLI option "${key}"`);
    }
  }

  return opts;
}

export function resolveExecutionPlan(opts = {}, env = process.env) {
  const rawEnvName = String(opts.env || env.K6_ENV || env.ENVIRONMENT || 'local')
    .trim()
    .toLowerCase();
  const rawBaseUrl = String(opts.baseUrl || env.K6_BASE_URL || env.BASE_URL || '').trim();
  const childEnv = { ...env };
  if (opts.allowStaging) {
    childEnv.K6_ALLOW_STAGING = 'true';
  }
  if (opts.strictSlo) {
    childEnv.K6_STRICT_SLO = 'true';
  }
  if (opts.requireRedis) {
    childEnv.K6_REQUIRE_REDIS = 'true';
  }
  if (opts.redisMode) {
    childEnv.K6_REDIS_MODE = opts.redisMode;
  }

  // Strictly block production and validate target before doing any work.
  const validatedTarget = validateTargetEnvironment(rawEnvName, rawBaseUrl || (rawEnvName === 'local' ? LOCAL_DEFAULT_BASE_URL : ''), childEnv);

  const requestedProfile = String(opts.profile || env.K6_PROFILE || env.PROFILE || env.STAGE || 'smoke')
    .trim()
    .toLowerCase();
  const isCheckOnly = requestedProfile === 'check' || requestedProfile === 'preflight';

  let scenarioKey = String(opts.scenario || env.K6_SCENARIO || '').trim().toLowerCase();
  let k6Profile = requestedProfile;

  if (!scenarioKey) {
    if (requestedProfile === 'auth' || requestedProfile === 'authentication') {
      scenarioKey = 'authentication';
      k6Profile = String(env.K6_PROFILE || 'smoke').trim().toLowerCase();
    } else if (requestedProfile === 'health') {
      scenarioKey = 'health';
      k6Profile = String(env.K6_PROFILE || 'smoke').trim().toLowerCase();
    } else if (isCheckOnly) {
      scenarioKey = 'mixed-workload';
      k6Profile = 'smoke';
    } else {
      scenarioKey = 'mixed-workload';
    }
  } else if (k6Profile === 'auth') {
    k6Profile = 'smoke';
  } else if (k6Profile === 'health') {
    k6Profile = 'smoke';
  } else if (isCheckOnly) {
    k6Profile = 'smoke';
  }

  const scriptRelPath = SCENARIO_SCRIPTS[scenarioKey];
  if (!scriptRelPath) {
    throw new Error(
      `Unknown scenario "${scenarioKey}". Expected one of: ${Object.keys(SCENARIO_SCRIPTS).join(', ')}`,
    );
  }

  const stageProfile = getStageProfile(k6Profile, childEnv);
  const redisMode = String(childEnv.K6_REDIS_MODE || childEnv.REDIS_MODE || 'enabled').trim().toLowerCase() === 'disabled'
    ? 'disabled'
    : 'enabled';

  childEnv.K6_ENV = validatedTarget.envName;
  childEnv.K6_BASE_URL = validatedTarget.baseUrl;
  childEnv.K6_PROFILE = stageProfile.name;
  childEnv.K6_REDIS_MODE = redisMode;

  return {
    isCheckOnly,
    envName: validatedTarget.envName,
    baseUrl: validatedTarget.baseUrl,
    scenarioKey,
    scriptRelPath,
    k6Profile: stageProfile.name,
    profileLabel: stageProfile.label,
    redisMode,
    childEnv,
  };
}

function makeTimestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export async function executeRunner(argv = [], deps = {}) {
  const opts = parseRunnerArgs(argv);
  const env = deps.env || process.env;
  const repoRoot = deps.repoRoot || process.cwd();
  const plan = resolveExecutionPlan(opts, env);

  const reportsDir = path.resolve(repoRoot, 'load-tests/k6/reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const stamp = makeTimestampSlug();
  const preflightJsonPath = path.join(reportsDir, `preflight-${plan.envName}-${stamp}.json`);

  if (plan.isCheckOnly) {
    if (opts.dryRun) {
      return {
        exitCode: 0,
        dryRun: true,
        mode: 'check',
        plan: { ...plan, childEnv: undefined },
        preflightJsonPath,
      };
    }
    const report = await runPreflight({
      env: plan.childEnv,
      envName: plan.envName,
      profile: plan.k6Profile,
      scenario: plan.scenarioKey,
      baseUrl: plan.baseUrl,
      redisMode: plan.redisMode,
      allowStaging: plan.envName === 'staging',
      requireRedis: opts.requireRedis,
      requireIndexes: opts.requireIndexes,
    });
    fs.writeFileSync(preflightJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(formatPreflightSummary(report));
    console.log(`[k6] Preflight JSON report saved: ${path.relative(repoRoot, preflightJsonPath).replace(/\\/g, '/')}`);
    return {
      exitCode: report.passed ? 0 : 1,
      mode: 'check',
      report,
      preflightJsonPath,
    };
  }

  const timestampedJsonPath = path.join(
    reportsDir,
    `${plan.scenarioKey.replace(/[^a-z0-9_-]/gi, '-')}-${plan.k6Profile}-${plan.envName}-${stamp}.json`,
  );
  const timestampedJsonRel = path.relative(repoRoot, timestampedJsonPath).replace(/\\/g, '/');
  plan.childEnv.K6_SUMMARY_OUTPUT = timestampedJsonRel;

  if (opts.dryRun) {
    const k6Bin = detectK6Binary(deps.execCommand).binary || 'k6';
    console.log('[k6][dry-run] Resolved configuration (secrets redacted):');
    console.log(JSON.stringify({
      environment: plan.envName,
      baseUrl: stripUrlCredentials(plan.baseUrl),
      scenario: plan.scenarioKey,
      script: plan.scriptRelPath,
      profile: plan.k6Profile,
      profileLabel: plan.profileLabel,
      redisMode: plan.redisMode,
      skipPreflight: opts.skipPreflight,
      summaryOutput: timestampedJsonRel,
      command: `${k6Bin} run ${plan.scriptRelPath}`,
    }, null, 2));
    return {
      exitCode: 0,
      dryRun: true,
      mode: 'run',
      plan: { ...plan, childEnv: undefined },
      summaryOutput: timestampedJsonRel,
    };
  }

  if (!opts.skipPreflight) {
    const preflightReport = await runPreflight({
      env: plan.childEnv,
      envName: plan.envName,
      profile: plan.k6Profile,
      scenario: plan.scenarioKey,
      baseUrl: plan.baseUrl,
      redisMode: plan.redisMode,
      allowStaging: plan.envName === 'staging',
      requireRedis: opts.requireRedis,
      requireIndexes: opts.requireIndexes,
    });
    fs.writeFileSync(preflightJsonPath, `${JSON.stringify(preflightReport, null, 2)}\n`, 'utf8');
    process.stdout.write(formatPreflightSummary(preflightReport));
    if (!preflightReport.passed) {
      console.error('[k6] Aborting load test because automated preflight failed.');
      return {
        exitCode: 1,
        mode: 'preflight-failed',
        preflightReport,
        preflightJsonPath,
      };
    }
  }

  const k6Info = detectK6Binary(deps.execCommand);
  if (!k6Info.ok || !k6Info.binary) {
    throw new Error('k6 binary not found on PATH. Install on Windows with: winget install k6 --source winget');
  }

  const scriptAbsPath = path.resolve(repoRoot, plan.scriptRelPath);
  if (!fs.existsSync(scriptAbsPath)) {
    throw new Error(`k6 script not found: ${plan.scriptRelPath}`);
  }

  console.log(`[k6] Launching ${plan.profileLabel} | scenario=${plan.scenarioKey} | env=${plan.envName} | target=${plan.baseUrl}`);

  const spawnFn = deps.spawnCommand || spawnSync;
  const runResult = spawnFn(k6Info.binary, ['run', plan.scriptRelPath], {
    cwd: repoRoot,
    env: plan.childEnv,
    stdio: 'inherit',
  });

  if (runResult.error) {
    throw runResult.error;
  }

  let summaryReport = null;
  if (fs.existsSync(timestampedJsonPath)) {
    try {
      summaryReport = JSON.parse(fs.readFileSync(timestampedJsonPath, 'utf8'));
    } catch {
      summaryReport = null;
    }
  }

  const canonicalBase = path.join(
    reportsDir,
    `${plan.scenarioKey.replace(/[^a-zA-Z0-9_-]/g, '-')}-${plan.k6Profile.replace(/[^a-zA-Z0-9_-]/g, '-')}-${plan.envName.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
  );
  const latestTxtPath = `${canonicalBase}.txt`;
  const timestampedTxtPath = timestampedJsonPath.replace(/\.json$/i, '.txt');
  if (fs.existsSync(latestTxtPath)) {
    try {
      fs.copyFileSync(latestTxtPath, timestampedTxtPath);
    } catch {
      // non-fatal copy error
    }
  }

  console.log(`[k6] JSON summary report: ${timestampedJsonRel}`);
  if (fs.existsSync(timestampedTxtPath)) {
    console.log(`[k6] Text summary report: ${path.relative(repoRoot, timestampedTxtPath).replace(/\\/g, '/')}`);
  }
  if (summaryReport?.verdict?.status) {
    console.log(`[k6] Final Verdict: ${summaryReport.verdict.status}`);
  }

  const exitCode = typeof runResult.status === 'number' && runResult.status !== 0
    ? runResult.status
    : summaryReport?.verdict?.passed === false
      ? 1
      : 0;

  return {
    exitCode,
    mode: 'run',
    summaryOutput: timestampedJsonRel,
    summaryReport,
  };
}

const isEntrypoint =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isEntrypoint) {
  executeRunner(process.argv.slice(2))
    .then((result) => {
      process.exit(result.exitCode ?? 0);
    })
    .catch((err) => {
      console.error(`[k6][runner] ERROR: ${redactSecrets(err?.message || String(err))}`);
      process.exit(1);
    });
}
