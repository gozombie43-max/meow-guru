import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MongoClient } from 'mongodb';
import {
  getStageProfile,
  isLocalHostname,
  isProductionHostname,
  LOCAL_DEFAULT_BASE_URL,
  parseHttpUrl,
  stripUrlCredentials,
  validateTargetEnvironment,
} from '../config/environment.js';
import { assertSafeDatabaseTarget, stripMongoUriCredentials } from './staging-test-data.mjs';

// ============================================================================
// Meow k6 Automated 10-Point Preflight Checker
// ============================================================================
// Pure ESM module (zero k6/* imports). Never logs passwords, tokens, or URIs.

export const REQUIRED_INDEXES = Object.freeze({
  questions: [
    'questions_selection_id',
    'questions_topic_selection_id',
    'questions_examMode_subject_selection_id',
    'question_canonical_identity',
  ],
  quizSessions: ['quizSessions_session_id'],
  users: ['account_identity', 'account_email_identity'],
  userQuestionProgress: ['canonical_user_question_progress'],
  idempotencyRecords: ['_id_', 'idempotency_expiry'],
});

const PRODUCTION_ENV_PATTERN = /(?:^|[._-])prod(?:uction)?(?:$|[._-])|^prod(?:uction)?$|\bprod(?:uction)?\b/i;

export function parsePreflightArgs(argv = []) {
  const args = Array.isArray(argv) ? argv : [];
  const flags = {
    env: null,
    profile: null,
    scenario: null,
    baseUrl: null,
    redisMode: null,
    allowStaging: false,
    requireRedis: false,
    requireIndexes: false,
    jsonPath: null,
    quiet: false,
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
        flags.env = nextVal();
        break;
      case '--profile':
      case '--stage':
        flags.profile = nextVal();
        break;
      case '--scenario':
        flags.scenario = nextVal();
        break;
      case '--base-url':
        flags.baseUrl = nextVal();
        break;
      case '--redis-mode':
        flags.redisMode = nextVal();
        break;
      case '--allow-staging':
        flags.allowStaging = true;
        break;
      case '--require-redis':
        flags.requireRedis = true;
        break;
      case '--require-indexes':
        flags.requireIndexes = true;
        break;
      case '--json':
        flags.jsonPath = nextVal();
        break;
      case '--quiet':
        flags.quiet = true;
        break;
      default:
        throw new Error(`Unknown CLI flag "${key}"`);
    }
  }

  return flags;
}

export function resolveAuthInputsForPreflight(env = {}) {
  const tokensRaw = String(env.K6_AUTH_TOKENS || env.AUTH_TOKENS || '').trim();
  if (tokensRaw) {
    const tokens = tokensRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length > 0) {
      return { source: 'tokens', tokens, accounts: [] };
    }
  }

  const singleToken = String(env.K6_AUTH_TOKEN || env.AUTH_TOKEN || '').trim();
  if (singleToken) {
    return { source: 'token', tokens: [singleToken], accounts: [] };
  }

  const usersJsonRaw = String(env.K6_USERS_JSON || env.TEST_ACCOUNTS_JSON || '').trim();
  if (usersJsonRaw) {
    let parsed;
    try {
      parsed = JSON.parse(usersJsonRaw);
    } catch (err) {
      throw new Error(`Invalid K6_USERS_JSON / TEST_ACCOUNTS_JSON: ${err.message}`);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('K6_USERS_JSON / TEST_ACCOUNTS_JSON must be a non-empty JSON array of { email, password }');
    }
    const accounts = parsed
      .map((item) => ({
        email: String(item?.email || '').trim(),
        password: String(item?.password || ''),
      }))
      .filter((item) => item.email && item.password);
    if (accounts.length === 0) {
      throw new Error('K6_USERS_JSON / TEST_ACCOUNTS_JSON contained no valid { email, password } entries');
    }
    return { source: 'users_json', tokens: [], accounts };
  }

  const numberedAccounts = [];
  for (let i = 1; i <= 200; i++) {
    const email = String(env[`K6_USER_EMAIL_${i}`] || env[`EMAIL_${i}`] || '').trim();
    const password = String(env[`K6_USER_PASSWORD_${i}`] || env[`PASSWORD_${i}`] || '');
    if (email && password) {
      numberedAccounts.push({ email, password });
    }
  }
  if (numberedAccounts.length > 0) {
    return { source: 'numbered', tokens: [], accounts: numberedAccounts };
  }

  const email = String(env.K6_TEST_EMAIL || env.TEST_EMAIL || '').trim();
  const password = String(env.K6_TEST_PASSWORD || env.TEST_PASSWORD || '');
  if (email && password) {
    return { source: 'single', tokens: [], accounts: [{ email, password }] };
  }

  return { source: 'none', tokens: [], accounts: [] };
}

export function redactSecrets(input, secretValues = []) {
  let out = String(input ?? '');
  out = out.replace(/(mongodb(?:\+srv)?:\/\/)([^/@\s]+)@/gi, '$1***@');
  out = out.replace(/(https?:\/\/)([^/@\s]+)@/gi, '$1***@');
  out = out.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer ***REDACTED***');
  out = out.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '***JWT_REDACTED***');
  for (const secret of secretValues) {
    if (typeof secret === 'string' && secret.length >= 4) {
      out = out.split(secret).join('***REDACTED***');
    }
  }
  return out;
}

function collectSecretValues(env = {}, authInputs = null) {
  const values = [];
  const envKeys = [
    'K6_AUTH_TOKEN',
    'AUTH_TOKEN',
    'K6_AUTH_TOKENS',
    'AUTH_TOKENS',
    'K6_TEST_PASSWORD',
    'TEST_PASSWORD',
    'K6_USER_PASSWORD',
    'STAGING_PROBE_PASSWORD',
    'K6_METRICS_TOKEN',
    'METRICS_TOKEN',
    'K6_USERS_JSON',
    'TEST_ACCOUNTS_JSON',
    'K6_MONGODB_URI',
    'STAGING_MONGODB_URI',
    'MONGODB_URI',
  ];
  for (const key of envKeys) {
    if (env[key]) values.push(String(env[key]));
  }
  if (authInputs) {
    for (const tok of authInputs.tokens || []) values.push(tok);
    for (const acc of authInputs.accounts || []) {
      if (acc.password) values.push(acc.password);
    }
  }
  return values;
}

export function detectK6Binary(execFn = execFileSync) {
  const candidates = process.platform === 'win32' ? ['k6', 'k6.exe'] : ['k6'];
  for (const bin of candidates) {
    try {
      const output = execFn(bin, ['version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
      });
      const versionLine = String(output || '').trim().split(/\r?\n/)[0] || 'k6 installed';
      return { ok: true, binary: bin, version: versionLine };
    } catch {
      // try next candidate
    }
  }
  return { ok: false, binary: null, version: null };
}

async function fetchJsonWithTimeout(url, init = {}, timeoutMs = 10_000, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const rawText = await response.text();
    let body = null;
    try {
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = null;
    }
    return { ok: true, status: response.status, body, text: rawText };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      text: '',
      error: error?.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : error?.message || 'Fetch error',
    };
  } finally {
    clearTimeout(timer);
  }
}

function makeCheck(number, id, name, passed, details, { warning = null } = {}) {
  return {
    number,
    id,
    name,
    status: passed ? 'PASS' : 'FAIL',
    passed: Boolean(passed),
    warning: passed && warning ? warning : null,
    details,
  };
}

export async function runPreflight(options = {}) {
  const env = { ...(options.env || process.env) };
  const rawEnvName = String(options.envName || env.K6_ENV || env.ENVIRONMENT || 'local')
    .trim()
    .toLowerCase();
  const rawProfile = String(options.profile || env.K6_PROFILE || env.PROFILE || env.STAGE || 'smoke')
    .trim()
    .toLowerCase();
  const effectiveProfileName = rawProfile === 'check' || rawProfile === 'auth' || rawProfile === 'health' ? 'smoke' : rawProfile;
  const scenario = String(
    options.scenario ||
      env.K6_SCENARIO ||
      (rawProfile === 'auth' ? 'authentication' : rawProfile === 'health' ? 'health' : 'mixed-workload'),
  )
    .trim()
    .toLowerCase();
  const redisMode = String(options.redisMode || env.K6_REDIS_MODE || env.REDIS_MODE || 'enabled')
    .trim()
    .toLowerCase() === 'disabled'
    ? 'disabled'
    : 'enabled';
  const requireRedis =
    Boolean(options.requireRedis) ||
    String(env.K6_REQUIRE_REDIS || '').trim().toLowerCase() === 'true';
  const requireIndexes = Boolean(options.requireIndexes);

  if (options.allowStaging) {
    env.K6_ALLOW_STAGING = 'true';
  }

  let peakVus = 5;
  try {
    peakVus = getStageProfile(effectiveProfileName, env).peakVus;
  } catch {
    peakVus = 5;
  }

  const rawBaseUrl = String(options.baseUrl || env.K6_BASE_URL || env.BASE_URL || '').trim();
  const execFn = options.execCommand || execFileSync;
  const fetchImpl = options.fetchImpl || fetch;
  const mongoClientFactory = options.mongoClientFactory || ((uri) => new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  }));

  let parsedAuthInputs = { source: 'none', tokens: [], accounts: [] };
  let authParseError = null;
  try {
    parsedAuthInputs = resolveAuthInputsForPreflight(env);
  } catch (err) {
    authParseError = err.message;
  }

  const secrets = collectSecretValues(env, parsedAuthInputs);
  const sanitize = (msg) => redactSecrets(msg, secrets);

  const checks = [];
  const isHealthOnly = scenario === 'health';

  // --------------------------------------------------------------------------
  // Check 1: k6 is installed
  // --------------------------------------------------------------------------
  const k6Info = detectK6Binary(execFn);
  checks.push(
    makeCheck(
      1,
      'k6_installed',
      'k6 binary installed',
      k6Info.ok,
      k6Info.ok
        ? k6Info.version
        : 'k6 was not found on PATH. Windows install: winget install k6 --source winget',
    ),
  );

  // --------------------------------------------------------------------------
  // Check 2: Valid, credential-free, non-production BASE_URL
  // --------------------------------------------------------------------------
  let resolvedBaseUrl = null;
  let parsedUrl = null;
  let urlValid = false;
  let urlDetails = '';

  if (PRODUCTION_ENV_PATTERN.test(rawEnvName)) {
    urlDetails = `Refusing production environment ("${rawEnvName}").`;
  } else if (rawEnvName !== 'local' && rawEnvName !== 'staging') {
    urlDetails = `Unsupported environment "${rawEnvName}". Expected "local" or "staging".`;
  } else if (rawEnvName === 'staging' && !rawBaseUrl) {
    urlDetails = 'Missing BASE_URL / K6_BASE_URL for staging environment.';
  } else {
    try {
      const candidate = rawBaseUrl || LOCAL_DEFAULT_BASE_URL;
      parsedUrl = parseHttpUrl(candidate);
      if (isProductionHostname(parsedUrl.hostname)) {
        urlDetails = `Refusing production-looking host "${parsedUrl.hostname}" in ${stripUrlCredentials(parsedUrl.normalizedUrl)}.`;
      } else if (rawEnvName === 'local' && !isLocalHostname(parsedUrl.hostname)) {
        urlDetails = `Local environment requires loopback host (localhost / 127.0.0.1 / ::1); got "${parsedUrl.hostname}".`;
      } else {
        urlValid = true;
        resolvedBaseUrl = parsedUrl.normalizedUrl;
        urlDetails = `${resolvedBaseUrl} (${rawEnvName})`;
      }
    } catch (err) {
      urlDetails = sanitize(err.message);
    }
  }
  checks.push(makeCheck(2, 'base_url_valid', 'BASE_URL configured & safe', urlValid, urlDetails));

  // --------------------------------------------------------------------------
  // Check 3: Selected environment explicitly approved
  // --------------------------------------------------------------------------
  let envApproved = false;
  let envDetails = '';
  if (!urlValid) {
    envDetails = 'Cannot approve environment until BASE_URL / target environment check passes.';
  } else {
    try {
      const validated = validateTargetEnvironment(rawEnvName, resolvedBaseUrl, env);
      envApproved = true;
      envDetails =
        validated.envName === 'local'
          ? 'local loopback target approved'
          : `staging explicitly approved (K6_ALLOW_STAGING=true, host=${validated.hostname})`;
    } catch (err) {
      envDetails = sanitize(err.message);
    }
  }
  checks.push(makeCheck(3, 'environment_approved', 'Environment explicitly approved', envApproved, envDetails));

  // --------------------------------------------------------------------------
  // Check 4: Required environment variables exist (never prints values)
  // --------------------------------------------------------------------------
  const missingVars = [];
  const envWarnings = [];
  if (rawEnvName === 'staging') {
    if (!rawBaseUrl) missingVars.push('K6_BASE_URL (or BASE_URL)');
    const allowStagingFlag =
      String(env.K6_ALLOW_STAGING ?? env.ALLOW_STAGING ?? '').trim().toLowerCase() === 'true';
    if (!allowStagingFlag) missingVars.push('K6_ALLOW_STAGING=true');
    if (scenario === 'authentication' && !env.K6_ORIGIN && !env.FRONTEND_URL && !env.CORS_ALLOWED_ORIGINS) {
      envWarnings.push('Set K6_ORIGIN=https://meowguru.me on staging for /auth/refresh & /auth/logout');
    }
  }
  if (!isHealthOnly && parsedAuthInputs.source === 'none') {
    if (authParseError) {
      missingVars.push(`valid auth env (${authParseError})`);
    } else {
      missingVars.push('K6_USERS_JSON or K6_USER_EMAIL_1/K6_USER_PASSWORD_1 or K6_TEST_EMAIL/K6_TEST_PASSWORD or K6_AUTH_TOKEN(S)');
    }
  }

  const reqVarsPassed = missingVars.length === 0;
  checks.push(
    makeCheck(
      4,
      'required_env_vars',
      'Required environment variables',
      reqVarsPassed,
      reqVarsPassed
        ? `Present (authSource=${isHealthOnly ? 'not-required' : parsedAuthInputs.source})`
        : `Missing: ${missingVars.join('; ')}`,
      { warning: envWarnings.join(' ; ') || null },
    ),
  );

  // --------------------------------------------------------------------------
  // Check 5: Backend health endpoint responds
  // --------------------------------------------------------------------------
  let healthBody = null;
  let healthOk = false;
  let healthDetails = '';
  if (!urlValid || !envApproved) {
    healthDetails = 'Skipped because target URL/environment check failed.';
  } else {
    const res = await fetchJsonWithTimeout(`${resolvedBaseUrl}/api/health`, { method: 'GET' }, 10_000, fetchImpl);
    if (!res.ok) {
      healthDetails = sanitize(`GET /api/health failed: ${res.error}`);
    } else if (res.status !== 200 || !res.body) {
      healthDetails = sanitize(`GET /api/health returned HTTP ${res.status}`);
    } else if (res.body.environment === 'production') {
      healthDetails = 'Target /api/health reports environment="production"; refusing load test.';
    } else if (res.body.ok !== true || res.body.state !== 'ready') {
      healthDetails = `GET /api/health not ready (ok=${res.body.ok}, state=${res.body.state})`;
    } else {
      healthBody = res.body;
      healthOk = true;
      healthDetails = `HTTP 200 ok=true state=${res.body.state} env=${res.body.environment || 'unknown'}`;
    }
  }
  checks.push(makeCheck(5, 'backend_health', 'Backend /api/health responds ready', healthOk, healthDetails));

  // --------------------------------------------------------------------------
  // Check 6: Authentication works end-to-end
  // --------------------------------------------------------------------------
  let activeToken = null;
  let authOk = false;
  let authWarning = null;
  let authDetails = '';

  if (isHealthOnly) {
    authOk = true;
    authDetails = 'Skipped (health-only scenario)';
  } else if (!healthOk) {
    authDetails = 'Skipped because backend health check failed.';
  } else if (parsedAuthInputs.source === 'none') {
    authDetails = authParseError || 'No credentials or bearer tokens configured.';
  } else {
    const poolSize = parsedAuthInputs.tokens.length || parsedAuthInputs.accounts.length;
    if (rawEnvName === 'staging' && peakVus >= 250 && poolSize < 15) {
      authWarning = `Pool size (${poolSize}) is small for ${peakVus} VUs against staging questionReadLimiter (2,400 req/15m/user); recommend >= 15 synthetic accounts.`;
    }
    if (parsedAuthInputs.tokens.length > 0) {
      activeToken = parsedAuthInputs.tokens[0];
    } else {
      const firstAccount = parsedAuthInputs.accounts[0];
      const loginRes = await fetchJsonWithTimeout(
        `${resolvedBaseUrl}/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: firstAccount.email, password: firstAccount.password }),
        },
        10_000,
        fetchImpl,
      );
      if (!loginRes.ok) {
        authDetails = sanitize(`POST /auth/login error: ${loginRes.error}`);
      } else if (loginRes.status !== 200 || !loginRes.body?.token) {
        authDetails = sanitize(
          `POST /auth/login failed (HTTP ${loginRes.status}${loginRes.body?.error ? `: ${loginRes.body.error}` : ''})`,
        );
      } else {
        activeToken = loginRes.body.token;
      }
    }

    if (activeToken) {
      const meRes = await fetchJsonWithTimeout(
        `${resolvedBaseUrl}/users/me`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${activeToken}` },
        },
        10_000,
        fetchImpl,
      );
      if (!meRes.ok) {
        authDetails = sanitize(`GET /users/me failed: ${meRes.error}`);
      } else if (meRes.status !== 200 || !meRes.body?.id) {
        authDetails = `GET /users/me rejected token with HTTP ${meRes.status}`;
      } else {
        authOk = true;
        authDetails = `Login + GET /users/me succeeded (poolSize=${poolSize}, source=${parsedAuthInputs.source})`;
      }
    }
  }
  checks.push(
    makeCheck(6, 'authentication_ready', 'Authentication & protected /users/me', authOk, authDetails, {
      warning: authWarning,
    }),
  );

  // --------------------------------------------------------------------------
  // Prepare optional direct MongoDB inspection for Checks 7, 8 & 10
  // --------------------------------------------------------------------------
  const mongoUri =
    rawEnvName === 'staging'
      ? env.K6_MONGODB_URI || env.STAGING_MONGODB_URI || ''
      : env.K6_MONGODB_URI || env.MONGODB_URI || '';
  const mongoDbName =
    env.K6_MONGODB_DB ||
    (rawEnvName === 'staging' ? env.STAGING_MONGODB_DB || 'quizDB_staging' : env.MONGODB_DB || 'quizDB');
  const expectedMongoHost = env.STAGING_MONGODB_EXPECTED_HOST || env.K6_EXPECTED_HOST || '';

  let mongoClient = null;
  let db = null;
  let dbTargetError = null;

  if (mongoUri && envApproved) {
    try {
      const safeTarget = assertSafeDatabaseTarget({
        envName: rawEnvName,
        uri: mongoUri,
        dbName: mongoDbName,
        allowStaging: rawEnvName === 'staging' ? env.K6_ALLOW_STAGING === 'true' : true,
        expectedHost: expectedMongoHost,
      });
      mongoClient = mongoClientFactory(mongoUri);
      await mongoClient.connect();
      db = mongoClient.db(safeTarget.dbName);
    } catch (err) {
      dbTargetError = sanitize(err.message);
      if (mongoClient) {
        await mongoClient.close().catch(() => {});
        mongoClient = null;
      }
    }
  }

  try {
    // ------------------------------------------------------------------------
    // Check 7: MongoDB connection is healthy
    // ------------------------------------------------------------------------
    const apiMongoHealthy = healthBody?.dependencies?.mongo === 'healthy';
    let mongoOk = false;
    let mongoDetails = '';

    if (dbTargetError) {
      mongoDetails = `Direct MongoDB check error (${stripMongoUriCredentials(mongoUri)}): ${dbTargetError}`;
    } else if (db) {
      try {
        await db.command({ ping: 1 });
        if (!healthOk) {
          mongoDetails = 'Direct MongoDB ping succeeded, but backend /api/health failed.';
        } else if (!apiMongoHealthy) {
          mongoDetails = `Backend /api/health reports mongo=${healthBody?.dependencies?.mongo || 'unknown'}.`;
        } else {
          mongoOk = true;
          mongoDetails = `Healthy via /api/health and direct ping (${mongoDbName})`;
        }
      } catch (err) {
        mongoDetails = sanitize(`Direct MongoDB ping failed: ${err.message}`);
      }
    } else if (!healthOk) {
      mongoDetails = 'Cannot verify MongoDB health because /api/health failed.';
    } else if (apiMongoHealthy) {
      mongoOk = true;
      mongoDetails = 'Healthy via /api/health dependencies.mongo=healthy (direct DB URI not supplied)';
    } else {
      mongoDetails = `Backend /api/health reports mongo=${healthBody?.dependencies?.mongo || 'unknown'}`;
    }
    checks.push(makeCheck(7, 'mongodb_healthy', 'MongoDB connection healthy', mongoOk, mongoDetails));

    // ------------------------------------------------------------------------
    // Check 8: Required MongoDB indexes exist
    // ------------------------------------------------------------------------
    let indexesOk = false;
    let indexesWarning = null;
    let indexesDetails = '';

    if (dbTargetError) {
      indexesDetails = `Cannot inspect indexes: ${dbTargetError}`;
    } else if (db) {
      const missing = [];
      for (const [colName, expectedNames] of Object.entries(REQUIRED_INDEXES)) {
        try {
          const existing = await db.collection(colName).indexes();
          const nameSet = new Set(existing.map((idx) => idx.name));
          for (const idxName of expectedNames) {
            if (!nameSet.has(idxName)) {
              missing.push(`${colName}.${idxName}`);
            }
          }
        } catch (err) {
          missing.push(`${colName}.* (${sanitize(err.message)})`);
        }
      }
      if (missing.length === 0) {
        indexesOk = true;
        const totalChecked = Object.values(REQUIRED_INDEXES).reduce((sum, arr) => sum + arr.length, 0);
        indexesDetails = `All ${totalChecked} critical indexes verified present across 5 collections`;
      } else {
        indexesDetails = `Missing indexes: ${missing.join(', ')}. Run: npm run db:migrate --workspace backend`;
      }
    } else if (requireIndexes) {
      indexesDetails = 'K6_MONGODB_URI / STAGING_MONGODB_URI required to inspect indexes directly.';
    } else if (mongoOk) {
      indexesOk = true;
      indexesWarning =
        'Direct index check skipped (no K6_MONGODB_URI / STAGING_MONGODB_URI in shell). Set URI or run `node backend/scripts/audit-db-explain.js` to verify.';
      indexesDetails = 'Deferred (DB URI not provided; backend /api/health ready)';
    } else {
      indexesDetails = 'Cannot verify indexes because MongoDB check failed.';
    }
    checks.push(
      makeCheck(8, 'mongodb_indexes', 'Required MongoDB indexes present', indexesOk, indexesDetails, {
        warning: indexesWarning,
      }),
    );

    // ------------------------------------------------------------------------
    // Check 9: Redis/Valkey connection status
    // ------------------------------------------------------------------------
    const apiRedisState = healthBody?.dependencies?.redis || 'unknown';
    let redisOk = false;
    let redisWarning = null;
    let redisDetails = '';

    if (!healthOk) {
      redisDetails = 'Cannot inspect Redis/Valkey state because /api/health failed.';
    } else if (apiRedisState === 'healthy') {
      redisOk = true;
      redisDetails = 'Redis/Valkey healthy (cache circuit closed)';
    } else if (apiRedisState === 'disabled') {
      if (requireRedis) {
        redisDetails = 'Redis/Valkey is disabled on target backend, but --require-redis / K6_REQUIRE_REDIS=true was specified.';
      } else {
        redisOk = true;
        if (redisMode === 'enabled') {
          redisWarning = 'Target backend reports REDIS_URL disabled (L1+Mongo fallback active). Pass -RedisMode disabled or provision Valkey for >80% shared cache hit rate.';
        }
        redisDetails = 'Redis/Valkey disabled (optional; graceful MongoDB fallback active)';
      }
    } else {
      redisDetails = `Redis/Valkey state is "${apiRedisState}" (circuit=${healthBody?.dependencies?.redisCircuit || 'unknown'})`;
    }
    checks.push(
      makeCheck(9, 'redis_valkey_health', 'Redis/Valkey health', redisOk, redisDetails, {
        warning: redisWarning,
      }),
    );

    // ------------------------------------------------------------------------
    // Check 10: Test accounts & question data exist
    // ------------------------------------------------------------------------
    let dataOk = false;
    let dataWarning = null;
    let dataDetails = '';

    if (!healthOk) {
      dataDetails = 'Skipped because backend health check failed.';
    } else {
      let dbQuestionCount = null;
      let syntheticUserCount = null;
      if (db) {
        try {
          const prefix = String(env.K6_USER_PREFIX || env.STAGING_PROBE_PREFIX || 'k6-load')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-');
          [dbQuestionCount, syntheticUserCount] = await Promise.all([
            db.collection('questions').countDocuments({}),
            db.collection('users').countDocuments({ k6Synthetic: true, k6Prefix: prefix }),
          ]);
        } catch {
          dbQuestionCount = null;
        }
      }

      const headers = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
      const checkSubject = String(env.K6_SUBJECT || env.SUBJECT || 'mathematics').trim();
      const checkExamMode = String(env.K6_EXAM_MODE || env.EXAM_MODE || 'ssc').trim();
      const checkTopic = String(env.K6_TOPIC || env.TOPIC || '').trim();
      const qParams = new URLSearchParams();
      if (checkSubject) qParams.set('subject', checkSubject);
      if (checkExamMode) qParams.set('examMode', checkExamMode);
      if (checkTopic) qParams.set('topic', checkTopic);
      const sessionParams = new URLSearchParams(qParams);
      sessionParams.set('limit', '5');
      const metaQuery = qParams.toString() ? `?${qParams.toString()}` : '';
      const [sessionRes, metaRes] = await Promise.all([
        fetchJsonWithTimeout(`${resolvedBaseUrl}/api/questions/session?${sessionParams.toString()}`, { method: 'GET', headers }, 10_000, fetchImpl),
        fetchJsonWithTimeout(`${resolvedBaseUrl}/api/questions/meta${metaQuery}`, { method: 'GET', headers }, 10_000, fetchImpl),
      ]);

      const returnedCount = Array.isArray(sessionRes.body?.questions) ? sessionRes.body.questions.length : 0;
      const metaTotal = typeof metaRes.body?.total === 'number' ? metaRes.body.total : null;
      const knownTotal = dbQuestionCount ?? metaTotal;

      if (!sessionRes.ok || sessionRes.status !== 200) {
        dataDetails = sanitize(
          `GET /api/questions/session?limit=5 failed (status=${sessionRes.status}${sessionRes.error ? `, ${sessionRes.error}` : ''})`,
        );
      } else if (returnedCount === 0) {
        dataDetails =
          'Question bank returned 0 deliverable questions. Seed data via: node load-tests/k6/scripts/staging-test-data.mjs seed --env local --seed-questions';
      } else if (knownTotal !== null && knownTotal < 40) {
        dataDetails = `Only ${knownTotal} total questions found (need >= 40 for realistic quizzes). Run staging-test-data.mjs seed --seed-questions.`;
      } else if (!isHealthOnly && !authOk) {
        dataDetails = `Questions exist (${knownTotal ?? `${returnedCount}+`}), but test authentication is not ready.`;
      } else {
        dataOk = true;
        const poolCount = parsedAuthInputs.tokens.length || parsedAuthInputs.accounts.length;
        dataDetails = `Questions=${knownTotal ?? `${returnedCount}+ sample ok`}, authPool=${isHealthOnly ? 'n/a' : poolCount}${syntheticUserCount !== null ? `, dbSyntheticUsers=${syntheticUserCount}` : ''}`;
        if (dbQuestionCount !== null && dbQuestionCount < 100) {
          dataWarning = `Question count is ${dbQuestionCount}; >= 100 questions recommended for zero-repeat multi-batch sessions.`;
        }
      }
    }
    checks.push(
      makeCheck(10, 'test_data_ready', 'Test accounts & question volume ready', dataOk, dataDetails, {
        warning: dataWarning,
      }),
    );
  } finally {
    if (mongoClient) {
      await mongoClient.close().catch(() => {});
    }
  }

  const failedChecks = checks.filter((c) => !c.passed);
  const warnings = checks.filter((c) => c.warning).map((c) => `${c.id}: ${c.warning}`);

  return {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    environment: rawEnvName,
    profile: rawProfile,
    scenario,
    baseUrl: resolvedBaseUrl || stripUrlCredentials(rawBaseUrl) || null,
    passed: failedChecks.length === 0,
    totalChecks: checks.length,
    passedCount: checks.length - failedChecks.length,
    failedCount: failedChecks.length,
    warningCount: warnings.length,
    checks,
    warnings,
  };
}

export function formatPreflightSummary(report) {
  const divider = '='.repeat(96);
  const sub = '-'.repeat(96);
  const lines = [
    '',
    divider,
    ` MEOW K6 AUTOMATED PREFLIGHT — env=${report.environment} | profile=${report.profile} | scenario=${report.scenario}`,
    ` Target: ${report.baseUrl || '(unresolved)'} | Timestamp: ${report.timestamp}`,
    divider,
  ];

  for (const check of report.checks) {
    const tag = check.status === 'PASS' ? '[PASS]' : '[FAIL]';
    const num = String(check.number).padStart(2, ' ');
    const name = check.name.padEnd(36, ' ');
    lines.push(` ${tag} ${num}. ${name} ${check.details}`);
    if (check.warning) {
      lines.push(`        [WARN] ${check.warning}`);
    }
  }

  lines.push(sub);
  lines.push(
    ` PREFLIGHT RESULT: ${report.passed ? 'PASS' : 'FAIL'} (${report.passedCount}/${report.totalChecks} checks passed, ${report.warningCount} warning(s))`,
  );
  lines.push(divider);
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const flags = parsePreflightArgs(process.argv.slice(2));
  const report = await runPreflight({
    envName: flags.env,
    profile: flags.profile,
    scenario: flags.scenario,
    baseUrl: flags.baseUrl,
    redisMode: flags.redisMode,
    allowStaging: flags.allowStaging,
    requireRedis: flags.requireRedis,
    requireIndexes: flags.requireIndexes,
  });

  if (flags.jsonPath) {
    const absPath = path.resolve(flags.jsonPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  if (!flags.quiet) {
    process.stdout.write(formatPreflightSummary(report));
  }

  if (!report.passed) {
    process.exitCode = 1;
  }
}

const isEntrypoint =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isEntrypoint) {
  main().catch((err) => {
    console.error(`[k6][preflight] ERROR: ${redactSecrets(err?.message || String(err))}`);
    process.exit(1);
  });
}
