# Meow — k6 Load Testing Suite & Windows Beginner Runbook

Automated, safe, repeatable k6 load-testing system for Meow's `/api/v1/quiz/*`, authentication, progress, and `/api/questions/*` endpoints.

**Core guarantees built into the suite:**
- **Production is permanently blocked**: `local` permits loopback hosts only (`127.0.0.1` / `localhost`); `staging` requires explicit `K6_ALLOW_STAGING=true` (`-AllowStaging`) and rejects production hostnames or databases.
- **No weak auth or shortcuts**: Every authenticated scenario logs in real synthetic accounts, sends real JWT Bearer tokens, rotates refresh cookies against trusted `Origin`, and enforces zero unexpected 401/403s.
- **No false-PASS results**: Reports distinguish expected business errors from infrastructure failures and fail with `NO_SAMPLES` if a scenario records zero samples.
- **Zero answer-key leaks & zero duplicates**: Every batch response is inspected for forbidden answer/solution fields (`answer_key_leaks_total == 0`) and cross-batch duplicate UIDs (`duplicate_questions_total == 0`).

---

## 1. Directory Structure

```text
load-tests/k6/
├── config/
│   └── environment.js              # Env validation, prod blocklist, 6 load profiles + ramp + stage0..7
├── helpers/
│   ├── auth.js                     # Isolated VU auth, token pool sharding, JWT exp refresh, CSRF Origin
│   ├── data.js                     # Filter builders, weighted quiz modes, leak & duplicate detectors
│   ├── reporting.js                # JSON + human TXT report builder, VERDICT engine, /metrics scraper
│   ├── thresholds.js               # Profile-aware SLO thresholds & custom counters
│   └── thresholds-constants.js     # Required metric & sample counter mappings (pure JS)
├── scenarios/
│   ├── health.js                   # GET /live and GET /api/health
│   ├── authentication.js           # Full auth smoke: login -> /users/me -> refresh -> /users/me -> logout
│   ├── question-delivery.js        # /topic-counts, /counts, /api/questions, legacy /meta & /session cursor
│   ├── quiz-session.js             # v1 lifecycle: POST sessions -> cursor prefetch -> answers (idempotency) -> submit -> result
│   ├── user-progress.js            # /users/me, /api/progress/topics(/private), /api/user/performance, practice-reminder
│   └── mixed-workload.js           # Realistic multi-journey mix (55% quiz-session, 25% question-delivery, 15% progress, 5% health)
├── scripts/
│   ├── preflight.mjs               # 10-point automated preflight check (zero secret leakage)
│   ├── run-k6.mjs                  # Cross-platform launcher used by npm scripts & run.ps1
│   └── staging-test-data.mjs       # Safe synthetic user & question seeding/cleanup (staging/local only)
├── reports/                        # Gitignored timestamped .json and .txt reports + preflight JSON
├── meow-question-delivery.js       # Backward-compatible entry script refactored onto modular helpers
├── meow-production-readiness.js    # Comprehensive 6-journey benchmark suite (quiz + mock + training + battle)
├── run.ps1                         # Single Windows PowerShell launcher
└── README.md
```

---

## 2. Installing k6 on Windows

Open **PowerShell** and run one of the following commands:

```powershell
# Recommended (Windows Package Manager / winget):
winget install k6 --source winget

# Alternative (Chocolatey):
choco install k6
```

Restart your PowerShell terminal after installation and verify k6 and Node.js 22+ are available:

```powershell
k6 version
node -v
```

---

## 3. Configuring Staging & Local Environments

> **Safety Rule:** Never hardcode credentials or commit `.env.k6.*` files. Staging requires BOTH a staging target URL and `-AllowStaging` (`K6_ALLOW_STAGING=true`).

### Staging Environment Defaults (Reference)
- **Staging API host**: `https://quizguru-stage-1177891703.azurewebsites.net`
- **Staging trusted frontend Origin**: `https://meowguru.me` (required by `/auth/refresh` and `/auth/logout`)
- **Staging MongoDB DB**: `quizDB_staging` on cluster host `quizguru-staging.c8bkump.mongodb.net`

> **Staging Capacity Note (B1 Hardware vs Target 500 VUs):**  
> Staging currently runs on a **single Azure App Service B1 instance (1 vCPU, 1.75 GB RAM, `REDIS_URL` unconfigured unless provisioned)**. Use staging for Stages 1–2 (`smoke` 5 VUs, `baseline` 25 VUs) to verify real Azure network, MongoDB Atlas TLS, and auth behavior, and expect Stage 3–4 (100–500 VUs) to saturate single-B1 CPU unless scaled out (P1v3+) with Azure Cache for Redis / Valkey enabled. Never extrapolate B1 saturation as a code failure, and **never run load tests against production**.

### Option A: PowerShell Session Variables (Recommended)

```powershell
# 1. Target staging safely (explicit opt-in required)
$env:K6_ENV = "staging"
$env:K6_ALLOW_STAGING = "true"
$env:K6_BASE_URL = "https://quizguru-stage-1177891703.azurewebsites.net"
$env:K6_ORIGIN = "https://meowguru.me"

# 2. Optional: Staging MongoDB URI to allow preflight to inspect indexes & seed synthetic users
# $env:STAGING_MONGODB_URI = "mongodb+srv://<user>:<pass>@quizguru-staging.c8bkump.mongodb.net/?retryWrites=true&w=majority"
# $env:STAGING_MONGODB_DB = "quizDB_staging"

# 3. Synthetic test account pool (see Section 4 to create these safely)
# Never paste production passwords here!
```

### Option B: Optional Env File (`-EnvFile`)

You can place temporary non-committed variables in a local file such as `.env.k6.staging` (outside git):

```ini
K6_ENV=staging
K6_ALLOW_STAGING=true
K6_BASE_URL=https://quizguru-stage-1177891703.azurewebsites.net
K6_ORIGIN=https://meowguru.me
K6_USERS_JSON=[{"email":"k6-load-1@loadtest.invalid","password":"REPLACE_ME"}]
```

Then pass `-EnvFile .env.k6.staging` to [`run.ps1`](./run.ps1) — values are loaded into the process without ever being echoed to your terminal or reports.

---

## 4. Preparing Synthetic Test Accounts & Rate-Limit Sizing

Meow enforces real rate limits in staging/production (`backend/middleware/rateLimiter.js`):
- `authLimiter`: **100 requests / 15 min per IP** on `/auth/*` (`POST /auth/login`).
- `questionReadLimiter`: **2,400 requests / 15 min per authenticated user** across `/api/v1/quiz/*` and `/api/questions/*` (600/15m unauthenticated).

Because `questionReadLimiter` is **per user ID**, a single user account caps out at ~2.6 req/sec sustained over 15 minutes (~40–50 VUs with think time). Size your synthetic account pool properly:

| Stage / Profile | Peak VUs | Recommended Accounts | Why |
| --- | --- | --- | --- |
| `smoke` | 5 VUs | 5 accounts | Clean 1:1 VU isolation, zero shared progress/session collisions |
| `baseline` | 25 VUs | 10–25 accounts | Well below `questionReadLimiter` (2,400/user) & `authLimiter` (100 logins/IP) |
| `moderate` | 50–100 VUs | 25 accounts | Up to 60,000 req / 15m across pool; 25 logins during `setup()` |
| `target` | 250–500 VUs | 30–50 accounts | Up to 120,000 req / 15m; stays safely under 100/15m `authLimiter` in `setup()` |
| `stress` | 750–1,000 VUs | 50–80 accounts | Stays under 100 IP logins during `setup()` while giving 192,000 req / 15m capacity |
| `soak` | 100–200 VUs (30–60m) | 30–50 accounts | Prevents single-user limiter exhaustion over 30–60 minutes |

> **Important:** All logins in `setup()` originate from your runner IP (`authLimiter` = 100 req/15m/IP). Keep `setup()` account counts `<= 80` (or pre-mint `K6_AUTH_TOKENS`) so `setup()` does not hit 429 on `POST /auth/login`.

### Create Synthetic Staging Accounts (One Command)

```powershell
# Provision 25 synthetic users in quizDB_staging (does NOT overwrite or delete real users)
$env:STAGING_MONGODB_URI = "mongodb+srv://<user>:<pass>@quizguru-staging.c8bkump.mongodb.net/?retryWrites=true&w=majority"
$env:K6_USER_PASSWORD = "UseARandomTestPassword123!"

node load-tests/k6/scripts/staging-test-data.mjs setup `
  --env staging `
  --allow-staging `
  --db quizDB_staging `
  --expected-host quizguru-staging.c8bkump.mongodb.net `
  --prefix k6-load `
  --count 25 `
  --skip-questions
```

Export `K6_USERS_JSON` in PowerShell for those accounts without hardcoding secrets:

```powershell
$env:K6_USERS_JSON = (
  1..25 | ForEach-Object { @{ email = "k6-load-$_@loadtest.invalid"; password = $env:K6_USER_PASSWORD } } |
  ConvertTo-Json -Compress
)
```

Check status or clean up synthetic users, their quiz sessions, progress, and idempotency records after testing:

```powershell
# Inspect synthetic user & session counts
node load-tests/k6/scripts/staging-test-data.mjs status --env staging --allow-staging --db quizDB_staging --expected-host quizguru-staging.c8bkump.mongodb.net --prefix k6-load

# Safe teardown (removes ONLY k6-load-* synthetic records; real users untouched)
node load-tests/k6/scripts/staging-test-data.mjs cleanup --env staging --allow-staging --db quizDB_staging --expected-host quizguru-staging.c8bkump.mongodb.net --prefix k6-load --count 25
```

---

## 5. Verifying MongoDB Indexes & Running Automated Preflight

### Step A: Apply & Verify Indexes (When You Have Staging DB Access)

```powershell
# Apply migrations (001 through 029) safely on staging
$env:MONGODB_URI = $env:STAGING_MONGODB_URI
$env:MONGODB_DB = "quizDB_staging"
npm run db:migrate --workspace backend

# Verify query execution plans (IXSCAN vs COLLSCAN) against local in-memory MongoDB + migrations 001–029
node backend/scripts/audit-db-explain.js
```

### Step B: Run 10-Point Automated Preflight (`PASS` / `FAIL`)

```powershell
# Against staging (fails safely if health, auth, URL, or staging approval is missing)
.\load-tests\k6\run.ps1 -Environment staging -Profile check -AllowStaging -BaseUrl https://quizguru-stage-1177891703.azurewebsites.net

# Or via npm script (uses current shell env)
npm run k6:check
```

The preflight checks:
1. `k6` binary installed on `PATH`
2. Valid, credential-free, non-production `BASE_URL`
3. Environment explicitly approved (`local` loopback or `staging` + `K6_ALLOW_STAGING=true`)
4. Required environment variables exist (names only, zero secret values printed)
5. Backend `/api/health` responds HTTP 200 with `ok: true` and `state: "ready"`
6. Authentication (`POST /auth/login` + protected `GET /users/me`) succeeds
7. MongoDB connection healthy (`/api/health` + direct ping when DB URI is set)
8. Required indexes exist (`questions_selection_id`, `questions_topic_selection_id`, `questions_examMode_subject_selection_id`, `question_canonical_identity`, `quizSessions_session_id`, `account_identity`, `account_email_identity`, `canonical_user_question_progress`, `idempotency_expiry`)
9. Redis/Valkey status (`healthy`, optional `disabled` fallback, or fails on `degraded` / `--require-redis`)
10. Synthetic accounts & sufficient question volume (`>= 40`) exist

---

## 6. Running Load Tests (Single-Command PowerShell Launcher & npm Scripts)

### Windows PowerShell Launcher (`run.ps1` — Recommended)

```powershell
# Stage 0: Automated preflight only (10 checks)
.\load-tests\k6\run.ps1 -Environment staging -Profile check -AllowStaging

# Dedicated Authentication Smoke (login -> /users/me -> refresh -> /users/me -> logout)
.\load-tests\k6\run.ps1 -Environment staging -Profile auth -AllowStaging

# Stage 1: Smoke (5 VUs, ~50s)
.\load-tests\k6\run.ps1 -Environment staging -Profile smoke -AllowStaging

# Stage 2: Baseline (25 VUs, ~2m40s)
.\load-tests\k6\run.ps1 -Environment staging -Profile baseline -AllowStaging

# Stage 3: Moderate (50–100 VUs, ~4m)
.\load-tests\k6\run.ps1 -Environment staging -Profile moderate -AllowStaging

# Stage 4: Target Capacity (250–500 VUs, ~6m15s)
.\load-tests\k6\run.ps1 -Environment staging -Profile target -AllowStaging

# Stage 5: Stress / Breaking Point (750–1,000 VUs, ~6m15s)
.\load-tests\k6\run.ps1 -Environment staging -Profile stress -AllowStaging

# Stage 6: Soak (150 VUs for 30–60 minutes; customize via $env:K6_SOAK_VUS / $env:K6_SOAK_DURATION)
.\load-tests\k6\run.ps1 -Environment staging -Profile soak -AllowStaging

# Run a specific modular scenario directly (e.g. quiz-session or question-delivery)
.\load-tests\k6\run.ps1 -Environment staging -Profile baseline -Scenario quiz-session -AllowStaging

# Dry-run config check without launching k6
.\load-tests\k6\run.ps1 -Environment staging -Profile smoke -AllowStaging -DryRun
```

### Root `npm` Scripts (Work Across Windows, macOS & Linux)

```powershell
# Defaults to local (http://127.0.0.1:10000); pass flags after "--" for staging
npm run k6:check
npm run k6:auth
npm run k6:smoke
npm run k6:baseline
npm run k6:moderate
npm run k6:target
npm run k6:stress
npm run k6:soak

# Run k6 against staging via npm:
npm run k6:smoke -- --env staging --allow-staging --base-url https://quizguru-stage-1177891703.azurewebsites.net
```

### Profile Summary

| Profile | Peak VUs | Duration | Purpose |
| --- | --- | --- | --- |
| `check` | 0 VUs | ~2s | 10-point automated preflight readiness gate |
| `auth` | 5 VUs | ~50s | Dedicated login, refresh rotation, `/users/me`, logout smoke |
| `smoke` | 5 VUs | ~50s | End-to-end correctness & zero-error sanity |
| `baseline` | 25 VUs | ~2m 40s | Normal baseline latency & throughput |
| `moderate` | 100 VUs | ~4m | Early pool, CPU, and index bottleneck detection |
| `target` | 500 VUs | ~6m 15s | Target capacity validation |
| `stress` | 1,000 VUs | ~6m 15s | Gradual ramp to identify breaking points |
| `soak` | 150 VUs | 34m (30–60m hold) | Memory leaks, connection pool leaks, latency drift |

---

## 7. Interpreting Results & Verdicts

Every run automatically saves both human-readable text and machine-readable JSON reports inside `load-tests/k6/reports/`:
- `<scenario>-<profile>-<env>.txt` and `<scenario>-<profile>-<env>.json` (latest run)
- `<scenario>-<profile>-<env>-<timestamp>.txt` and `.json` (archived timestamped run)
- `preflight-<env>-<timestamp>.json` (preflight check output)

Every summary prints:
- **Profile, environment, duration, peak VUs, total requests, RPS**
- **Endpoint-level P50 / P90 / P95 / P99 / Max latency**
- **Integrity counters**: `duplicates`, `answerKeyLeaks`, `failedAnswers`, `authFailures`, `unhandled5xx`, `rateLimit429`, `businessErrors`, `infraErrors`
- **Final Verdict**:
  - **`PASS`**: All thresholds satisfied, zero integrity/auth/5xx failures, all required endpoints recorded samples.
  - **`PASS WITH WARNINGS`**: Performance & integrity passed, but a non-fatal advisory triggered (e.g., `METRICS_TOKEN` skipped or Redis disabled/cache hit ratio `< 80%`).
  - **`FAIL`**: One or more SLO thresholds failed, unhandled 5xx / unexpected auth failure occurred, data integrity violated, or a required metric had `NO_SAMPLES`.

---

## 8. Troubleshooting Common Failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Refusing production environment` | `production` passed in `-Environment` or `BASE_URL` contains `prod` | Target `local` or an approved `staging` URL; production is strictly blocked. |
| `Staging load tests require explicit approval` | Missing `-AllowStaging` / `K6_ALLOW_STAGING=true` | Pass `-AllowStaging` or set `$env:K6_ALLOW_STAGING = "true"`. |
| `HTTP 401` on `POST /auth/refresh` or `/auth/logout` | Staging `requireTrustedOrigin` rejected `Origin` header | Set `$env:K6_ORIGIN = "https://meowguru.me"` before running `auth` or `mixed-workload`. |
| `HTTP 401` after staging redeploy | Staging workflow rotates `JWT_SECRET` every deploy | Use `K6_USERS_JSON` (logs in dynamically) rather than stale static `K6_AUTH_TOKENS`. |
| `HTTP 429` during `setup()` | More than 100 login calls from one IP in 15m (`authLimiter`) | Keep `setup()` account pool at 25–50 accounts (or space runs >15m apart). |
| `HTTP 429` during `baseline`/`target` | Single account exceeded 2,400 req/15m (`questionReadLimiter`) | Provision 25–50 synthetic accounts (`staging-test-data.mjs`) so load shards across users. |
| `NO_SAMPLES` verdict on `FAIL` | Backend unreachable or setup failed so endpoints had 0 requests | Run `.\load-tests\k6\run.ps1 -Environment staging -Profile check -AllowStaging` first. |
| `Missing indexes` in Preflight Check 8 | Migrations not yet applied on target DB | Run `npm run db:migrate --workspace backend` against staging DB. |
| Staging P95 rises sharply above 25–50 VUs | Staging App Service is a single B1 (1 vCPU) without Valkey | Expected hardware ceiling for B1; scale staging plan (P1v3+) + enable `REDIS_URL` before running `target`/`stress`. |

---

## 9. Appendix: Redis ON vs OFF Comparison & PromQL Queries

### Self-Contained Local 7-Stage Benchmark Harness

To benchmark up to 1,000–1,500 VUs completely offline using `MongoMemoryReplSet` + a local Express process + local TCP Redis stub:

```powershell
node backend/scripts/run-staged-k6-local.js --stages smoke --duration 10s --ramp 3s --cooldown 2s
```

### Redis ON vs OFF Comparison (`meow-question-delivery.js`)

Run with `$env:K6_REDIS_MODE = "enabled"` vs `"disabled"` (when comparing Redis provisioned vs disabled backend) and compare:

```powershell
node -e '
  const fs = require("fs");
  const on = JSON.parse(fs.readFileSync("load-tests/k6/reports/mixed-workload-baseline-staging.json", "utf8"));
  const off = JSON.parse(fs.readFileSync("load-tests/k6/reports/mixed-workload-baseline-local.json", "utf8"));
  console.table([on, off].map(r => ({
    env: r.environment,
    redisMode: r.redisMode,
    verdict: r.verdict.status,
    rps: r.rps,
    p95Ms: r.endpointLatency?.overallHttp?.p95Ms,
    cacheHitPct: r.prometheusMetrics?.tieredCacheHitRatio ?? "n/a",
  })));
'
```

### Key PromQL Queries (`GET /metrics` & `backend/observability/slo-rules.yml`)

```promql
# 1. Question batch P95 / P99 latency (ms)
1000 * histogram_quantile(0.95, sum by (le) (rate(meow_http_duration_seconds_bucket{route="/api/v1/quiz/sessions/:id/questions",method="GET"}[5m])))
1000 * histogram_quantile(0.99, sum by (le) (rate(meow_http_duration_seconds_bucket{route="/api/v1/quiz/sessions/:id/questions",method="GET"}[5m])))

# 2. Tiered cache hit ratio (L1 + Redis hits vs total reads; target > 0.80)
sum(rate(meow_cache_operations_total{layer=~"l1|redis",outcome=~"hit|stale"}[5m]))
/ clamp_min(
  sum(rate(meow_cache_operations_total{layer=~"l1|redis",outcome=~"hit|stale"}[5m]))
  + sum(rate(meow_cache_operations_total{layer="source",outcome="miss"}[5m]))
  + sum(rate(meow_cache_operations_total{outcome="bypass"}[5m])),
  0.001
)

# 3. MongoDB connection pool wait queue (target near 0)
max(meow_mongo_pool_waiting)
```
