# Meow Question Delivery — k6 Load-Test Suite & 500-VU Scalability Runbook

Production load-testing suite for Meow's standardized `/api/v1/quiz/*` question delivery architecture and legacy `/api/questions/*` compatibility routes.

- **Primary script**: [`meow-question-delivery.js`](./meow-question-delivery.js)
- **Workload model**: Realistic concurrent quiz-taker traffic (85% of VUs) executing the full session lifecycle — weighted across `practice` (40%), `topic` (30%), `speed` (15%), and `mock` (15%) modes — plus a secondary read-only legacy scenario (15% of VUs) exercising `GET /api/questions/meta` and `GET /api/questions/session?limit=25`.
- **Built-in integrity assertions**:
  - **Zero answer-key leakage** on `POST /api/v1/quiz/sessions`, `GET /api/v1/quiz/sessions/:id/questions`, legacy `GET /api/questions/session`, and pre-submit `mock`/`speed` answers (`answer_key_leaks_total == 0`).
  - **Zero duplicate questions** across multi-batch cursor prefetching (`duplicate_questions_total == 0`).
  - **Zero failed answer submissions** including periodic idempotent `Idempotency-Key` replay checks (`failed_answer_submissions_total == 0`).
  - **Automatic `/metrics` scraping** before and after the run (when `METRICS_TOKEN` is set) to report tiered & Redis-layer cache hit ratios (`>80%` target) and MongoDB pool waiting counts.

---

## 1. Prerequisites

1. Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/):
   - **Windows (winget)**: `winget install k6 --source winget`
   - **Windows (Chocolatey)**: `choco install k6`
   - **macOS (Homebrew)**: `brew install k6`
   - **Linux (Debian/Ubuntu)**: `sudo apt-get install k6`
2. Provision synthetic load-test user account(s) on your target staging/local environment.
   > **Important for Stage 3–6 (250–1000 VUs)**: `questionReadLimiter` enforces per-user rate limits (2,400 req / 15 min authenticated). For 50–100 VUs, a single `TEST_EMAIL` / `AUTH_TOKEN` is sufficient; for 250–1000 VUs, supply a pool of accounts via `TEST_ACCOUNTS_JSON` or `AUTH_TOKENS` (e.g., 20–50 synthetic learners) so load testing measures backend capacity rather than single-user rate limiting.

---

## 2. Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `BASE_URL` | No | `http://127.0.0.1:10000` | Backend API origin (no trailing slash). |
| `STAGE` | No | `stage4` | Stage profile: `stage1`, `stage2`, `stage3`, `stage4`, `stage5`, `stage6`, or `ramp`. |
| `REDIS_MODE` | No | `enabled` | Tag for side-by-side comparison (`enabled` or `disabled`). |
| `AUTH_TOKEN` | Conditional | — | Pre-minted bearer JWT (reused across VUs). |
| `AUTH_TOKENS` | Conditional | — | Comma-separated pool of bearer JWTs sharded across VUs. |
| `TEST_EMAIL` / `TEST_PASSWORD` | Conditional | — | Credentials for automatic `POST /auth/login` in `setup()` (with auto-refresh on 401 during long ramps). |
| `TEST_ACCOUNTS_JSON` | Conditional | — | JSON array of `[{"email":"...","password":"..."}]` logged in during `setup()` and sharded across VUs. |
| `EXAM_MODE` | No | — | Optional exam mode filter (`ssc` or `iit-jam`). |
| `TOPIC` | No | — | Optional topic filter (e.g. `Percentage`). |
| `SUBJECT` | No | — | Optional subject filter (e.g. `mathematics`). |
| `BATCH_SIZE` | No | `20` | Questions per batch (`1..50`). |
| `LEGACY_LIMIT` | No | `25` | `limit` param for legacy `GET /api/questions/session`. |
| `LEGACY_ENABLED` | No | `true` | Set `false` to run 100% of VUs on `/api/v1/quiz/*`. |
| `LEGACY_RATIO` | No | `0.15` | Fraction of VUs allocated to legacy read-only compatibility (`0.05..0.5`). |
| `THINK_TIME_SCALE` | No | `1.0` | Multiplier for realistic reading/thinking sleeps (`0.2` for fast smoke tests, `0` to disable sleeps). |
| `METRICS_TOKEN` | No | — | Bearer token for `GET /metrics` before/after scrape (cache hit ratio & Mongo pool waiting). |
| `SUMMARY_OUTPUT` | No | `load-tests/k6/results-<stage>-<redis_mode>.json` | Destination path for JSON summary artifact. |

---

## 3. Running Stages 1–6 & Full Staged Ramp

Run all commands from the repository root so JSON artifacts land in `load-tests/k6/results-<stage>-<redis_mode>.json`.

### Stage Profiles Overview

| Stage | Peak VUs | Purpose | Ramp / Hold / Cooldown |
| --- | --- | --- | --- |
| `stage1` | 50 VUs | Baseline correctness & latency sanity | 20s / 2m / 20s |
| `stage2` | 100 VUs | Redis cache warming & DB index validation | 30s / 3m / 20s |
| `stage3` | 250 VUs | Early bottleneck discovery (pool / CPU / serialization) | 45s / 3m / 30s |
| `stage4` | **500 VUs** | **Production target SLO gate (default)** | 1m / 4m / 30s |
| `stage5` | 750 VUs | 1.5x headroom & stress verification | 1m30s / 4m / 45s |
| `stage6` | 1000 VUs | 2x capacity boundary & graceful degradation | 2m / 4m / 45s |
| `ramp` | 50 → 1000 VUs | Full continuous stepped ramp across all 6 plateaus | ~19m total |

### Exact Commands (Bash / Linux / macOS)

```bash
export BASE_URL="https://staging-api.example.com"
export TEST_EMAIL="load-learner-1@staging.invalid"
export TEST_PASSWORD="replace-with-synthetic-password"
export METRICS_TOKEN="replace-with-staging-metrics-token"

# Stage 1 — 50 VUs baseline
k6 run -e BASE_URL -e TEST_EMAIL -e TEST_PASSWORD -e METRICS_TOKEN \
  -e STAGE=stage1 -e REDIS_MODE=enabled \
  load-tests/k6/meow-question-delivery.js

# Stage 2 — 100 VUs cache & DB validation
k6 run -e BASE_URL -e TEST_EMAIL -e TEST_PASSWORD -e METRICS_TOKEN \
  -e STAGE=stage2 -e REDIS_MODE=enabled \
  load-tests/k6/meow-question-delivery.js

# Stage 3 — 250 VUs bottleneck discovery
k6 run -e BASE_URL -e TEST_ACCOUNTS_JSON -e METRICS_TOKEN \
  -e STAGE=stage3 -e REDIS_MODE=enabled \
  load-tests/k6/meow-question-delivery.js

# Stage 4 — 500 VUs production target (default STAGE)
k6 run -e BASE_URL -e TEST_ACCOUNTS_JSON -e METRICS_TOKEN \
  -e STAGE=stage4 -e REDIS_MODE=enabled \
  load-tests/k6/meow-question-delivery.js

# Stage 5 — 750 VUs headroom / stress
k6 run -e BASE_URL -e TEST_ACCOUNTS_JSON -e METRICS_TOKEN \
  -e STAGE=stage5 -e REDIS_MODE=enabled \
  load-tests/k6/meow-question-delivery.js

# Stage 6 — 1000 VUs capacity boundary
k6 run -e BASE_URL -e TEST_ACCOUNTS_JSON -e METRICS_TOKEN \
  -e STAGE=stage6 -e REDIS_MODE=enabled \
  load-tests/k6/meow-question-delivery.js

# Full staged ramp (50 -> 100 -> 250 -> 500 -> 750 -> 1000 VUs)
k6 run -e BASE_URL -e TEST_ACCOUNTS_JSON -e METRICS_TOKEN \
  -e STAGE=ramp -e REDIS_MODE=enabled \
  load-tests/k6/meow-question-delivery.js
```

### Exact Commands (PowerShell / Windows)

```powershell
$env:BASE_URL = "http://127.0.0.1:10000"
$env:TEST_EMAIL = "load-learner-1@staging.invalid"
$env:TEST_PASSWORD = "replace-with-synthetic-password"
$env:METRICS_TOKEN = "replace-with-metrics-token"

# Run Stage 4 (500 VUs production target)
k6 run -e STAGE=stage4 -e REDIS_MODE=enabled load-tests/k6/meow-question-delivery.js

# Run Stage 1 with explicit topic & examMode filters
k6 run -e STAGE=stage1 -e REDIS_MODE=enabled -e EXAM_MODE=ssc -e TOPIC=Percentage `
  load-tests/k6/meow-question-delivery.js
```

---

## 4. Redis ON vs OFF Side-by-Side Comparison

Use the exact same stage, dataset, and user pool with Redis enabled (`REDIS_URL` set) vs disabled (`REDIS_URL` unset on the backend) to quantify Redis offloading and verify graceful MongoDB fallback.

### Step 1: Run with Redis Enabled

Ensure backend has `REDIS_URL`, `REDIS_NAMESPACE`, and `QUESTIONS_NORMALIZED_KEYS=true`, then run:

```bash
k6 run \
  -e BASE_URL="$BASE_URL" \
  -e TEST_ACCOUNTS_JSON="$TEST_ACCOUNTS_JSON" \
  -e METRICS_TOKEN="$METRICS_TOKEN" \
  -e STAGE=stage4 \
  -e REDIS_MODE=enabled \
  load-tests/k6/meow-question-delivery.js
# Writes: load-tests/k6/results-stage4-enabled.json
```

### Step 2: Run with Redis Disabled (MongoDB Fallback Validation)

Restart the staging/local backend with `REDIS_URL=""` (unset), wait for `/api/health` to report `dependencies.redis === "disabled"` and `state === "ready"`, then run:

```bash
k6 run \
  -e BASE_URL="$BASE_URL" \
  -e TEST_ACCOUNTS_JSON="$TEST_ACCOUNTS_JSON" \
  -e METRICS_TOKEN="$METRICS_TOKEN" \
  -e STAGE=stage4 \
  -e REDIS_MODE=disabled \
  load-tests/k6/meow-question-delivery.js
# Writes: load-tests/k6/results-stage4-disabled.json
```

### Step 3: Compare Both JSON Artifacts Side-by-Side

```bash
node -e '
  const fs = require("fs");
  const on = JSON.parse(fs.readFileSync("load-tests/k6/results-stage4-enabled.json", "utf8"));
  const off = JSON.parse(fs.readFileSync("load-tests/k6/results-stage4-disabled.json", "utf8"));
  console.table([
    {
      mode: "REDIS ON",
      verdict: on.verdict.passed ? "PASS" : "FAIL",
      rps: on.throughput.requestsPerSec,
      batchP95Ms: on.latency.questionsBatch?.p95Ms,
      batchP99Ms: on.latency.questionsBatch?.p99Ms,
      createP95Ms: on.latency.sessionCreate?.p95Ms,
      errRatePct: +(on.throughput.httpFailedRate * 100).toFixed(3),
      cacheHitPct: on.prometheusMetrics?.tieredCacheHitRatio ?? "n/a",
      mongoCmds: on.prometheusMetrics?.mongoCommandsDelta ?? "n/a",
    },
    {
      mode: "REDIS OFF",
      verdict: off.verdict.passed ? "PASS" : "FAIL",
      rps: off.throughput.requestsPerSec,
      batchP95Ms: off.latency.questionsBatch?.p95Ms,
      batchP99Ms: off.latency.questionsBatch?.p99Ms,
      createP95Ms: off.latency.sessionCreate?.p95Ms,
      errRatePct: +(off.throughput.httpFailedRate * 100).toFixed(3),
      cacheHitPct: off.prometheusMetrics?.tieredCacheHitRatio ?? "n/a",
      mongoCmds: off.prometheusMetrics?.mongoCommandsDelta ?? "n/a",
    },
  ]);
'
```

---

## 5. Production SLO Thresholds

Enforced directly in `meow-question-delivery.js` (`options.thresholds`):

| Metric | Threshold | Meaning |
| --- | --- | --- |
| `http_req_duration{endpoint:questions_batch}` | `p(95) < 200ms`, `p(99) < 400ms` | Batch 2+ cursor prefetch (`GET /api/v1/quiz/sessions/:id/questions`) stays sub-200ms at P95. |
| `http_req_duration{endpoint:session_create}` | `p(95) < 250ms` | Session creation + batch 1 hydration (`POST /api/v1/quiz/sessions`). |
| `http_req_failed` | `rate < 0.001` (`< 0.1%`) | 99.9%+ HTTP request reliability. |
| `duplicate_questions_total` | `count == 0` | Zero duplicate question UIDs within any session across batches. |
| `answer_key_leaks_total` | `count == 0` | Zero `correctAnswer`/`solution`/`explanation` fields in delivered questions or pre-submit exam answers. |
| `failed_answer_submissions_total` | `count == 0` | 100% atomic idempotent answer persistence. |
| Tiered / Redis Cache Hit Ratio (`/metrics`) | `> 80%` (when `REDIS_MODE=enabled`) | Verified via `meow_cache_operations_total` before/after delta. |

---

## 6. Production Sizing Checklist (500 Concurrent Users + 750–1000 VU Headroom)

### A. Azure App Service (API Tier & Worker Separation)

- **Separate background workers from the API tier**:
  - Build and deploy [`backend/Dockerfile.worker`](../../backend/Dockerfile.worker) (which runs `npm run start:worker` -> [`backend/worker.js`](../../backend/worker.js)) on a dedicated worker container/App Service instance with `PROCESS_ROLE=worker`.
  - If Tutor attachments are active, run `npm run start:attachments` (`backend/attachment-worker.js`) with `PROCESS_ROLE=attachments`.
  - On all **API** instances set:
    ```env
    PROCESS_ROLE=api
    RUN_EMBEDDED_WORKERS=false
    RUN_CONCEPT_GROUPING_WORKER=false
    ```
    This prevents background cron/maintenance jobs, concept grouping, and battle outbox polling from competing with quiz-delivery event loops.
- **Compute SKU & horizontal scaling**:
  - Minimum for **500 concurrent users**: **2× Azure App Service P1v3** (2 vCPU, 8 GB RAM each; 4 vCPU total) behind App Service load balancer with **ARR Affinity = Off** (stateless JWT + shared Redis) and **Always On = On**.
  - Recommended for **750–1000 VU headroom**: **3× P1v3** or **2× P2v3** (4 vCPU, 16 GB RAM each) with autoscale rule on CPU > 65% or HTTP queue length > 50.
- **Health probes**:
  - Liveness: `GET /live`
  - Readiness: `GET /health` (or `GET /api/health`) — verifies MongoDB ping, applied migrations, and reports `redisCacheStats` + `cacheHitSummary`.

### B. Azure Cache for Redis (`allkeys-lru`)

- **SKU**: **Standard C1 (1 GB)** minimum for 500 VUs; **Standard C2 (2.5 GB)** or **Premium P1 (6 GB)** for 750–1000 VUs or multi-region/high-throughput workloads.
- **Eviction Policy**: Set `maxmemory-policy` to **`allkeys-lru`** on the cache Redis instance (`backend/config/redis.js` exposes `recommendedEvictionPolicy: 'allkeys-lru'`).
  - **Do NOT share the cache Redis instance with BullMQ durable queues**: if `USE_DURABLE_QUEUE=true`, provision a **separate** Redis instance (`QUEUE_REDIS_URL`) with `noeviction` and AOF/RDB persistence enabled (`QUEUE_REDIS_ALLOW_SHARED=false`).
- **Required backend env tuning**:
  ```env
  REDIS_URL=rediss://:<key>@<name>.redis.cache.windows.net:6380
  REDIS_NAMESPACE=meow:prod
  REDIS_COMMANDS_QUEUE_MAX=4096        # Bounds in-flight queue per socket (default 2048; raise to 4096-8192 for 500-1000 VUs)
  REDIS_COMMAND_TIMEOUT_MS=1000        # Per-command round-trip deadline
  REDIS_CONSECUTIVE_TIMEOUT_THRESHOLD=3 # Trips circuit breaker without tearing down sockets on 1 slow reply
  ```
- **Socket isolation**: Already built into `backend/config/redis.js` (`getRedisClient()` for tiered read cache vs `getRateLimitRedisClient()` for `express-rate-limit` bursts), preventing rate-limit spikes from stalling question-delivery reads.

### C. MongoDB Atlas Sizing & Normalized Keys

- **Cluster Tier**:
  - **M10** (2 vCPU, 2 GB RAM, 1,500 max connections) — minimum for 500 VUs with Redis hit ratio > 80% and normalized indexes active.
  - **M30** (2 vCPU, 8 GB RAM, 3,000 max connections) — recommended for 500–1000 VUs and 100k+ question working sets so compound indexes (`questions`, `quizSessions`, `idempotencyRecords`) remain 100% resident in WiredTiger cache even during a full Redis outage.
- **Required backend env flags**:
  ```env
  QUESTIONS_NORMALIZED_KEYS=true       # Enables exact-match normalized keys (topicKey, subjectKey, examKey, conceptKey, modeKey, yearInt, shiftInt) + selectionKey ring scans
  MONGO_MAX_POOL_SIZE=50               # Per API instance (e.g. 50 x 3 API instances + 15 worker = 165 connections, well below Atlas limit)
  MONGO_MIN_POOL_SIZE=10               # Pre-warmed pool avoids cold-connect latency spikes during traffic bursts
  ```
- **Index & migration verification**:
  - Confirm all migrations (including `026-mock-pyq-optimization.js` and `quizSessions` / `selectionKey` compound indexes) are applied (`GET /health` -> `migrations` ready).
  - Never run unindexed `$regex` or deep `$skip` queries on hot paths; use `/api/v1/quiz/sessions*` cursor delivery and `QUESTIONS_NORMALIZED_KEYS=true`.

---

## 7. Prometheus Monitoring Queries (PromQL)

All metric names match [`backend/infrastructure/metrics.js`](../../backend/infrastructure/metrics.js) and [`backend/observability/slo-rules.yml`](../../backend/observability/slo-rules.yml).

### HTTP Delivery Latency — P50 / P95 / P99 (ms)

```promql
# Overall P50 / P95 / P99 across v1 quiz delivery endpoints (in ms)
1000 * histogram_quantile(0.50, sum by (le, route) (rate(meow_http_duration_seconds_bucket{route=~"/api/v1/quiz/.*"}[5m])))
1000 * histogram_quantile(0.95, sum by (le, route) (rate(meow_http_duration_seconds_bucket{route=~"/api/v1/quiz/.*"}[5m])))
1000 * histogram_quantile(0.99, sum by (le, route) (rate(meow_http_duration_seconds_bucket{route=~"/api/v1/quiz/.*"}[5m])))

# Question batch fetch SLO check (target P95 < 200ms, P99 < 400ms)
1000 * histogram_quantile(0.95, sum by (le) (rate(meow_http_duration_seconds_bucket{route="/api/v1/quiz/sessions/:id/questions",method="GET"}[5m])))
1000 * histogram_quantile(0.99, sum by (le) (rate(meow_http_duration_seconds_bucket{route="/api/v1/quiz/sessions/:id/questions",method="GET"}[5m])))

# Session create SLO check (target P95 < 250ms)
1000 * histogram_quantile(0.95, sum by (le) (rate(meow_http_duration_seconds_bucket{route="/api/v1/quiz/sessions",method="POST"}[5m])))

# HTTP 5xx error ratio (target < 0.1% = 0.001)
sum(rate(meow_http_requests_total{status=~"5.."}[5m])) / clamp_min(sum(rate(meow_http_requests_total[5m])), 0.001)
```

### Redis & Tiered Cache Hit Ratio (`meow_cache_operations_total`)

```promql
# Overall Tiered Cache Hit Ratio (L1 + Redis hits & stale vs all reads; target > 0.80)
sum(rate(meow_cache_operations_total{layer=~"l1|redis",outcome=~"hit|stale"}[5m]))
/
clamp_min(
  sum(rate(meow_cache_operations_total{layer=~"l1|redis",outcome=~"hit|stale"}[5m]))
  + sum(rate(meow_cache_operations_total{layer="source",outcome="miss"}[5m]))
  + sum(rate(meow_cache_operations_total{outcome="bypass"}[5m])),
  0.001
)

# Redis-layer-only Hit Ratio (excluding L1 hits)
sum(rate(meow_cache_operations_total{layer="redis",outcome=~"hit|stale"}[5m]))
/
clamp_min(sum(rate(meow_cache_operations_total{layer="redis",outcome=~"hit|stale|miss"}[5m])), 0.001)

# Hit Ratio broken down by cache namespace (question-item, question-key, topic-pool, quiz-session, question-page)
sum by (cache) (rate(meow_cache_operations_total{layer=~"l1|redis",outcome=~"hit|stale"}[5m]))
/
clamp_min(
  sum by (cache) (rate(meow_cache_operations_total{layer=~"l1|redis",outcome=~"hit|stale"}[5m]))
  + sum by (cache) (rate(meow_cache_operations_total{layer="source",outcome="miss"}[5m])),
  0.001
)

# Redis circuit state (0=closed, 1=open, 2=half-open), timeouts, and fallbacks
max(meow_redis_circuit_state)
sum(rate(meow_redis_command_timeout_total[5m]))
sum(rate(meow_redis_fallback_total[5m]))
```

### MongoDB Query Duration (`meow_mongo_command_duration_seconds`) & Pool Waiting (`meow_mongo_pool_waiting`)

```promql
# MongoDB command P50 / P95 / P99 by collection & command (in ms)
1000 * histogram_quantile(0.50, sum by (le, collection, command) (rate(meow_mongo_command_duration_seconds_bucket{outcome="success"}[5m])))
1000 * histogram_quantile(0.95, sum by (le, collection, command) (rate(meow_mongo_command_duration_seconds_bucket{outcome="success"}[5m])))
1000 * histogram_quantile(0.99, sum by (le, collection, command) (rate(meow_mongo_command_duration_seconds_bucket{outcome="success"}[5m])))

# MongoDB QPS on hot quiz collections
sum by (collection, command) (rate(meow_mongo_commands_total{collection=~"questions|quizSessions|idempotencyRecords"}[5m]))

# Pending MongoDB connection checkouts (should stay near 0; sustained > 5 means raise MONGO_MAX_POOL_SIZE or scale Atlas/Redis)
max(meow_mongo_pool_waiting)

# MongoDB connection pool checkout P95 latency (in ms)
1000 * histogram_quantile(0.95, sum by (le) (rate(meow_dependency_duration_seconds_bucket{dependency="mongo.pool",operation="checkout"}[5m])))
```

### Question Delivery Payload Size & Duplicate Prevention

```promql
# P95 serialized payload bytes per question delivery endpoint
histogram_quantile(0.95, sum by (le, endpoint) (rate(meow_question_delivery_payload_bytes_bucket[5m])))

# Duplicate questions prevented server-side by surface
sum by (surface) (increase(meow_question_delivery_duplicates_prevented_total[15m]))
```
