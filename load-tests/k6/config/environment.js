// ============================================================================
// Meow k6 Environment, Safety Guards & Load Stage Configuration
// ============================================================================
// Pure ESM module compatible with both k6 (__ENV) and Node.js (process.env).

export const VALID_QUIZ_MODES = ['practice', 'topic', 'speed', 'mock'];

export const LOCAL_DEFAULT_BASE_URL = 'http://127.0.0.1:10000';

const PRODUCTION_ENV_PATTERN = /(?:^|[._-])prod(?:uction)?(?:$|[._-])|^prod(?:uction)?$/i;
const PRODUCTION_HOST_PATTERN = /(?:^|[._-])prod(?:uction)?(?:$|[._-])/i;
const STAGING_HOST_HINT_PATTERN = /(?:stag(?:e|ing)|uat|qa|sandbox|preview|dev|local)/i;

export const LOAD_PROFILES = {
  smoke: {
    name: 'smoke',
    label: 'Stage 1 — Smoke (5 VUs)',
    peakVus: 5,
    stages: [
      { duration: '10s', target: 5 },
      { duration: '30s', target: 5 },
      { duration: '10s', target: 0 },
    ],
  },
  baseline: {
    name: 'baseline',
    label: 'Stage 2 — Baseline (25 VUs)',
    peakVus: 25,
    stages: [
      { duration: '20s', target: 25 },
      { duration: '2m', target: 25 },
      { duration: '20s', target: 0 },
    ],
  },
  moderate: {
    name: 'moderate',
    label: 'Stage 3 — Moderate (50–100 VUs)',
    peakVus: 100,
    stages: [
      { duration: '30s', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '2m', target: 100 },
      { duration: '30s', target: 0 },
    ],
  },
  target: {
    name: 'target',
    label: 'Stage 4 — Target (250–500 VUs)',
    peakVus: 500,
    stages: [
      { duration: '45s', target: 250 },
      { duration: '1m', target: 500 },
      { duration: '4m', target: 500 },
      { duration: '30s', target: 0 },
    ],
  },
  stress: {
    name: 'stress',
    label: 'Stage 5 — Stress (750–1,000 VUs)',
    peakVus: 1000,
    stages: [
      { duration: '1m', target: 750 },
      { duration: '1m30s', target: 1000 },
      { duration: '3m', target: 1000 },
      { duration: '45s', target: 0 },
    ],
  },
  soak: {
    name: 'soak',
    label: 'Stage 6 — Soak (150 VUs, 30m)',
    peakVus: 150,
    stages: [
      { duration: '2m', target: 150 },
      { duration: '30m', target: 150 },
      { duration: '2m', target: 0 },
    ],
  },
  ramp: {
    name: 'ramp',
    label: 'Full Staged Ramp (50 -> 100 -> 250 -> 500 -> 750 -> 1000 VUs)',
    peakVus: 1000,
    stages: [
      { duration: '30s', target: 50 },
      { duration: '1m30s', target: 50 },
      { duration: '30s', target: 100 },
      { duration: '2m', target: 100 },
      { duration: '45s', target: 250 },
      { duration: '2m', target: 250 },
      { duration: '1m', target: 500 },
      { duration: '3m', target: 500 },
      { duration: '1m', target: 750 },
      { duration: '2m', target: 750 },
      { duration: '1m', target: 1000 },
      { duration: '2m', target: 1000 },
      { duration: '45s', target: 0 },
    ],
  },
};

// Backwards-compatible legacy STAGE presets from meow-question-delivery.js
export const LEGACY_STAGE_PROFILES = {
  stage0: {
    name: 'stage0',
    label: 'Stage 0 — Initial Ramp (30 VUs)',
    peakVus: 30,
    stages: [
      { duration: '15s', target: 30 },
      { duration: '2m', target: 30 },
      { duration: '15s', target: 0 },
    ],
  },
  stage1: {
    name: 'stage1',
    label: 'Stage 1 — Baseline (50 VUs)',
    peakVus: 50,
    stages: [
      { duration: '20s', target: 50 },
      { duration: '2m', target: 50 },
      { duration: '20s', target: 0 },
    ],
  },
  stage2: {
    name: 'stage2',
    label: 'Stage 2 — Cache & DB Validation (100 VUs)',
    peakVus: 100,
    stages: [
      { duration: '30s', target: 100 },
      { duration: '3m', target: 100 },
      { duration: '20s', target: 0 },
    ],
  },
  stage3: {
    name: 'stage3',
    label: 'Stage 3 — Bottleneck Discovery (250 VUs)',
    peakVus: 250,
    stages: [
      { duration: '45s', target: 250 },
      { duration: '3m', target: 250 },
      { duration: '30s', target: 0 },
    ],
  },
  stage4: {
    name: 'stage4',
    label: 'Stage 4 — Production Target (500 VUs)',
    peakVus: 500,
    stages: [
      { duration: '1m', target: 500 },
      { duration: '4m', target: 500 },
      { duration: '30s', target: 0 },
    ],
  },
  stage5: {
    name: 'stage5',
    label: 'Stage 5 — Headroom / Stress (750 VUs)',
    peakVus: 750,
    stages: [
      { duration: '1m30s', target: 750 },
      { duration: '4m', target: 750 },
      { duration: '45s', target: 0 },
    ],
  },
  stage6: {
    name: 'stage6',
    label: 'Stage 6 — Capacity Boundary (1000 VUs)',
    peakVus: 1000,
    stages: [
      { duration: '2m', target: 1000 },
      { duration: '4m', target: 1000 },
      { duration: '45s', target: 0 },
    ],
  },
  stage7: {
    name: 'stage7',
    label: 'Stage 7 — Headroom Capacity (1200–1500 VUs)',
    peakVus: 1500,
    stages: [
      { duration: '1m30s', target: 1200 },
      { duration: '1m', target: 1500 },
      { duration: '3m', target: 1500 },
      { duration: '45s', target: 0 },
    ],
  },
};

export function resolveRuntimeEnv(envOverrides) {
  if (envOverrides && typeof envOverrides === 'object') {
    return envOverrides;
  }
  if (typeof __ENV !== 'undefined' && __ENV) {
    return __ENV;
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env;
  }
  return {};
}

export function clampInt(raw, fallback, min, max) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function clampFloat(raw, fallback, min, max) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number.parseFloat(String(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function stripUrlCredentials(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!s) return '';
  return s.replace(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@]+)@/i, '$1***@');
}

export function parseHttpUrl(rawUrl) {
  const cleaned = String(rawUrl || '').trim().replace(/\/+$/, '');
  const match = /^(https?):\/\/([^/?#]+)([^#]*)$/i.exec(cleaned);
  if (!match) {
    throw new Error(`Invalid BASE_URL "${stripUrlCredentials(cleaned)}": expected http:// or https:// URL`);
  }
  const protocol = match[1].toLowerCase();
  const authority = match[2];
  const pathPart = match[3] || '';

  if (authority.includes('@')) {
    throw new Error(`BASE_URL "${stripUrlCredentials(cleaned)}" must not embed credentials`);
  }

  let hostname = authority;
  let port = '';
  if (authority.startsWith('[')) {
    const bracketEnd = authority.indexOf(']');
    if (bracketEnd === -1) {
      throw new Error(`Invalid IPv6 host in BASE_URL "${stripUrlCredentials(cleaned)}"`);
    }
    hostname = authority.slice(0, bracketEnd + 1);
    const rest = authority.slice(bracketEnd + 1);
    if (rest.startsWith(':')) port = rest.slice(1);
  } else {
    const colonIdx = authority.lastIndexOf(':');
    if (colonIdx !== -1) {
      hostname = authority.slice(0, colonIdx);
      port = authority.slice(colonIdx + 1);
    }
  }

  if (!hostname) {
    throw new Error(`Invalid BASE_URL "${stripUrlCredentials(cleaned)}": missing hostname`);
  }

  return {
    normalizedUrl: `${protocol}://${authority}${pathPart}`,
    protocol,
    hostname: hostname.toLowerCase(),
    port,
  };
}

export function isLocalHostname(hostname) {
  const h = String(hostname || '').trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

export function isProductionHostname(hostname) {
  const h = String(hostname || '').trim().toLowerCase();
  if (!h) return false;
  if (PRODUCTION_HOST_PATTERN.test(h)) return true;
  if (/\bprod(?:uction)?\b/i.test(h)) return true;
  return false;
}

export function validateTargetEnvironment(envName, baseUrl, env = {}) {
  const rawEnv = String(envName || 'local').trim().toLowerCase();
  if (PRODUCTION_ENV_PATTERN.test(rawEnv) || /prod/i.test(rawEnv)) {
    throw new Error(
      `Refusing to run k6 load tests against production environment ("${rawEnv}"). Production is strictly blocked.`,
    );
  }
  if (rawEnv !== 'local' && rawEnv !== 'staging') {
    throw new Error(
      `Unsupported environment "${rawEnv}". Expected "local" or "staging".`,
    );
  }

  const candidateUrl = String(baseUrl || '').trim();
  if (rawEnv === 'staging' && !candidateUrl) {
    throw new Error(
      'Staging environment requires an explicit BASE_URL (or K6_BASE_URL).',
    );
  }

  const resolvedUrl = candidateUrl || LOCAL_DEFAULT_BASE_URL;
  const parsed = parseHttpUrl(resolvedUrl);

  // Unbypassable production hostname blocklist.
  if (isProductionHostname(parsed.hostname)) {
    throw new Error(
      `Refusing production-looking target hostname "${parsed.hostname}" in ${stripUrlCredentials(parsed.normalizedUrl)}.`,
    );
  }

  if (rawEnv === 'local') {
    if (!isLocalHostname(parsed.hostname)) {
      throw new Error(
        `Local environment only permits loopback hosts (localhost, 127.0.0.1, ::1); got "${parsed.hostname}".`,
      );
    }
    return {
      envName: 'local',
      baseUrl: parsed.normalizedUrl,
      hostname: parsed.hostname,
      allowStaging: false,
    };
  }

  // rawEnv === 'staging'
  const allowStaging =
    String(env.K6_ALLOW_STAGING ?? env.ALLOW_STAGING ?? '').trim().toLowerCase() === 'true';
  if (!allowStaging) {
    throw new Error(
      'Staging load tests require explicit approval: set K6_ALLOW_STAGING=true (or ALLOW_STAGING=true).',
    );
  }

  const approvedHost = String(
    env.K6_EXPECTED_HOST || env.STAGING_EXPECTED_HOST || env.K6_APPROVED_STAGING_HOST || '',
  )
    .trim()
    .toLowerCase();

  if (approvedHost && parsed.hostname !== approvedHost) {
    throw new Error(
      `Staging hostname "${parsed.hostname}" does not match expected host "${approvedHost}".`,
    );
  }

  if (
    !isLocalHostname(parsed.hostname) &&
    !STAGING_HOST_HINT_PATTERN.test(parsed.hostname) &&
    parsed.hostname !== approvedHost
  ) {
    throw new Error(
      `Refusing remote staging hostname "${parsed.hostname}" without staging/dev/test hint or K6_EXPECTED_HOST confirmation.`,
    );
  }

  return {
    envName: 'staging',
    baseUrl: parsed.normalizedUrl,
    hostname: parsed.hostname,
    allowStaging: true,
  };
}

function parseDurationMinutes(raw) {
  const s = String(raw || '').trim().toLowerCase();
  const mMatch = /^(\d+(?:\.\d+)?)m$/.exec(s);
  if (mMatch) return Number.parseFloat(mMatch[1]);
  const sMatch = /^(\d+(?:\.\d+)?)s$/.exec(s);
  if (sMatch) return Number.parseFloat(sMatch[1]) / 60;
  const hMatch = /^(\d+(?:\.\d+)?)h$/.exec(s);
  if (hMatch) return Number.parseFloat(hMatch[1]) * 60;
  return null;
}

export function getStageProfile(profileName, env = {}) {
  const rawName = String(profileName || 'smoke').trim().toLowerCase();
  if (rawName === 'soak') {
    const soakVus = clampInt(env.K6_SOAK_VUS ?? env.SOAK_VUS, 150, 100, 200);
    const override = String(env.K6_SOAK_DURATION_OVERRIDE || '').trim();
    let holdDuration = '30m';
    if (override) {
      if (parseDurationMinutes(override) === null) {
        throw new Error(`Invalid K6_SOAK_DURATION_OVERRIDE="${override}". Expected duration like "30s" or "10m".`);
      }
      holdDuration = override;
    } else if (env.K6_SOAK_DURATION || env.SOAK_DURATION) {
      const requested = String(env.K6_SOAK_DURATION || env.SOAK_DURATION).trim();
      const mins = parseDurationMinutes(requested);
      if (mins === null || mins < 30 || mins > 60) {
        throw new Error(
          `Invalid K6_SOAK_DURATION="${requested}". Soak duration must be between 30m and 60m (or use K6_SOAK_DURATION_OVERRIDE for dry runs).`,
        );
      }
      holdDuration = requested;
    }
    return {
      name: 'soak',
      label: `Stage 6 — Soak (${soakVus} VUs, ${holdDuration})`,
      peakVus: soakVus,
      stages: [
        { duration: '2m', target: soakVus },
        { duration: holdDuration, target: soakVus },
        { duration: '2m', target: 0 },
      ],
    };
  }

  const profile = LOAD_PROFILES[rawName] || LEGACY_STAGE_PROFILES[rawName];
  if (!profile) {
    const available = [...Object.keys(LOAD_PROFILES), ...Object.keys(LEGACY_STAGE_PROFILES)];
    throw new Error(`Unknown profile/stage "${rawName}". Expected one of: ${available.join(', ')}`);
  }

  return {
    name: profile.name,
    label: profile.label,
    peakVus: profile.peakVus,
    stages: profile.stages.map((step) => ({ ...step })),
  };
}

export function splitStages(stages, ratio, ensureAtLeastOne = true) {
  const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
  return stages.map((step) => {
    if (step.target === 0 || safeRatio === 0) {
      return { duration: step.duration, target: 0 };
    }
    const raw = Math.round(step.target * safeRatio);
    const target = ensureAtLeastOne ? Math.max(1, raw) : Math.max(0, raw);
    return { duration: step.duration, target };
  });
}

export function loadConfig(envOverrides, options = {}) {
  const env = resolveRuntimeEnv(envOverrides);
  const rawEnvName = env.K6_ENV || env.ENVIRONMENT || 'local';
  const rawBaseUrl = env.K6_BASE_URL || env.BASE_URL || '';
  const target = validateTargetEnvironment(rawEnvName, rawBaseUrl, env);

  const defaultProfile = options.defaultProfile || 'smoke';
  const profileName = String(
    env.K6_PROFILE || env.PROFILE || env.STAGE || defaultProfile,
  )
    .trim()
    .toLowerCase();
  const profile = getStageProfile(profileName, env);

  const rawRedis = String(env.K6_REDIS_MODE || env.REDIS_MODE || 'enabled').trim().toLowerCase();
  const redisMode = rawRedis === 'disabled' ? 'disabled' : 'enabled';

  const quizMode = String(env.K6_QUIZ_MODE || env.QUIZ_MODE || '').trim().toLowerCase();
  if (quizMode && !VALID_QUIZ_MODES.includes(quizMode)) {
    throw new Error(
      `Invalid QUIZ_MODE="${quizMode}". Expected one of: ${VALID_QUIZ_MODES.join(', ')}`,
    );
  }

  const legacyEnabled =
    String(env.K6_LEGACY_ENABLED ?? env.LEGACY_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
  const legacyRatio = legacyEnabled
    ? clampFloat(env.K6_LEGACY_RATIO ?? env.LEGACY_RATIO, 0.15, 0.05, 0.5)
    : 0;

  const scenarioName = String(options.scenarioName || env.K6_SCENARIO || 'suite').trim().toLowerCase();
  const explicitSummaryOutput = String(env.K6_SUMMARY_OUTPUT || env.SUMMARY_OUTPUT || '').trim();
  const strictSlo =
    String(env.K6_STRICT_SLO ?? env.STRICT_SLO ?? 'false').trim().toLowerCase() === 'true';
  const includeAuthScenario =
    String(env.K6_INCLUDE_AUTH_SCENARIO ?? 'false').trim().toLowerCase() === 'true';

  return {
    envName: target.envName,
    baseUrl: target.baseUrl,
    hostname: target.hostname,
    allowStaging: target.allowStaging,
    profileName: profile.name,
    profile,
    redisMode,
    quizMode,
    examMode: String(env.K6_EXAM_MODE || env.EXAM_MODE || '').trim(),
    topic: String(env.K6_TOPIC || env.TOPIC || '').trim(),
    subject: String(env.K6_SUBJECT || env.SUBJECT || '').trim(),
    batchSize: clampInt(env.K6_BATCH_SIZE ?? env.BATCH_SIZE, 20, 1, 50),
    legacyLimit: clampInt(env.K6_LEGACY_LIMIT ?? env.LEGACY_LIMIT, 25, 1, 50),
    legacyEnabled,
    legacyRatio,
    thinkTimeScale: clampFloat(env.K6_THINK_TIME_SCALE ?? env.THINK_TIME_SCALE, 1.0, 0, 5),
    metricsToken: String(env.K6_METRICS_TOKEN || env.METRICS_TOKEN || '').trim(),
    summaryOutputPath: explicitSummaryOutput || '',
    reportsDir: 'load-tests/k6/reports',
    scenarioName,
    strictSlo,
    includeAuthScenario,
    env,
  };
}
