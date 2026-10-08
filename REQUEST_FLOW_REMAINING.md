# Remaining request-flow work

Implemented and verified locally on 2026-10-08 from `9c9eb3ec`. This continues the [original audit](REQUEST_FLOW_AUDIT.md) and batches A-D. Actual Atlas measurements and production before/after waterfalls are pending the target URLs, Atlas project/cluster, dedicated account and monitoring access requested in chat. No deployment or production database writes have been performed.

## F3: separate concept-group polling

```text
Quiz setup -> GET /api/questions/meta once -> cached metadata + fingerprint/status
  -> processing: wait 10 seconds
  -> GET /api/questions/concept-groups/:fingerprint every 10 seconds
     -> completed cache OR one projected conceptGroupMetadata.findOne
     -> status; completed response additionally supplies groups
  -> ready / failed: stop polling
```

The status route does not read questions, reconstruct full metadata, enqueue a job, or write Mongo. Malformed fingerprints fail before Mongo; missing records return 404 without initialization. Matching fingerprints fence late responses after topic changes. Shared completed results retain the existing immutable fingerprint contract; the grouping worker and validation remain intact. Pending requests for the same fingerprint coalesce within an API process.

Sources: [public status route](backend/routes/questionRoutes.js), [projected read](backend/repositories/conceptGroupRepository.js), [frontend polling](frontend/hooks/useQuestionsMeta.ts). Real-Mongo integration tests and frontend timer tests cover completion, failure, cancellation and preserved totals.

## F16: read-only mock catalog

```text
Deployment/operator -> npm run db:migrate --workspace backend
  -> migration 018 -> bounded bulk $setOnInsert for default mock slots
  -> mark migration complete; subsequent deployment skips this data seed

Open exam -> GET /api/mocktest/:exam/slots
  -> one projected catalog aggregation
  -> stored summaries OR read-only static fallback
  -> no upsert; no second catalog query
```

Migration retries preserve existing titles and fixed papers. Completed migration records prevent ordinary deployments from restoring intentionally deleted database rows. Static configuration still supplies the existing practice fallback when a catalog is empty; this preserves availability without making GET write. The existing authenticated admin seed endpoint remains an explicit operator action.

Sources: [catalog service](backend/services/mock/mockSlotService.js), [migration 018](backend/migrations/018-default-mock-slots.js), [migration runner](backend/migrations/runner.js).

## F5: durable catalog presence before readiness

```text
Deployment -> migrate -> db:initialize-public-catalog
  -> current-revision snapshots for mathematics/reasoning/english/general-awareness
  -> persist each snapshot -> release deployment

API startup -> readiness checks -> initializePublicCatalogs
  -> reuse usable persisted public snapshot OR build/persist missing subject
  -> only then open HTTP listener
  -> background refresh of all subjects now and every 15 minutes

Question-bank mutation -> advance durable question-bank revision
  -> retain previous persisted public catalog
  -> existing application write path warms mathematics
  -> public stale read / periodic refresh updates other subjects

Open mathematics -> public persisted catalog -> HTML/RSC
  -> stale public revision may trigger background refresh
  -> private progress/scoring continue to require their current-revision contracts
```

Initialization repairs missing durable records even when a local/Redis snapshot is warm. Subjects refresh sequentially; each subject retains its existing batches of at most four topic queries. Both deployment workflows read the runtime normalized-key flag so they initialize the matching snapshot variant. A failed rebuild preserves existing snapshots; explicit release initialization fails instead of silently releasing an uninitialized catalog.

This guarantees presence at successful initialization, not permanent availability during Mongo outages, deletion of metadata outside application paths, or more than 24 hours of failed refreshes. Public stale snapshots retain the existing 24-hour bound. Ordinary mutations retain usable prior data; freshness for non-mathematics subjects can lag until a public read or the 15-minute refresh. The cold aggregation cost moves to initialization rather than disappearing. Live release/startup behavior has not been tested on Azure.

Sources: [catalog initializer and refresh](backend/services/questions/topicCountSnapshot.js), [startup](backend/index.js), [explicit initialization](backend/scripts/initialize-public-catalog.js), [mutation revision fence](backend/repositories/questionBankMutation.js), [production workflow](.github/workflows/main_quizguru-backend.yml), [staging workflow](.github/workflows/main_quizguru-backend-staging.yml).

## F1: measure before changing authorization

```text
Protected request -> JWT -> assertSession caller counter
  -> same-session/process in-flight coalescing
  -> actual authorization burst histogram
  -> authSessions.findOne || users.findOne, comment=meow.auth.validation
  -> local cache HIT: endpoint work
  -> MISS: Redis -> second Mongo pair -> cache -> endpoint work

Mongo command monitoring -> bounded collection/command/purpose/outcome counters
  -> actual driver attempts, including retries
  -> driver command duration histograms
HTTP completion -> X-Request-ID + Mongo command summary in structured logs
```

The real local Mongo regression confirms **four cold commands and two warm commands**, with one warm find per authorization collection. Concurrent callers can share these commands; use measured burst counts rather than multiplying every HTTP request by two. Authorization ordering, cross-instance revocation and privilege checks are preserved; all existing race tests still apply.

New recording rules:

```promql
# Authorization commands/second, aggregate every API replica in one environment.
sum(rate(meow_mongo_commands_total{purpose="authorization"}[5m]))

# Successful command p95 by collection, seconds.
histogram_quantile(0.95, sum by (le, collection) (
  rate(meow_mongo_command_duration_seconds_bucket{purpose="authorization",outcome="success"}[5m])
))

# Actual authorization burst p95, including its Redis/dependency wait, seconds.
histogram_quantile(0.95, sum by (le) (
  rate(meow_auth_validation_burst_duration_seconds_bucket{outcome="success"}[5m])
))
```

These are client-driver and application timings, not Atlas execution timings. Command durations follow the [Mongo driver monitoring events](https://www.mongodb.com/docs/drivers/node/v6.x/monitoring-and-logging/monitoring/). Histogram quantiles estimate within buckets; aggregate buckets across replicas before calculating the percentile, as described in [Prometheus histogram guidance](https://prometheus.io/docs/practices/histograms/).

Use Atlas [Namespace Insights](https://www.mongodb.com/docs/atlas/namespace-insights/) for `authSessions`/`users` collection latency alongside the same UTC measurement window and [process metrics](https://www.mongodb.com/docs/atlas/monitor-cluster-metrics/) for total cluster operations. Collection metrics include other users/profile activity. The fixed Mongo comment distinguishes these validation finds in available query records. The [Query Profiler](https://www.mongodb.com/docs/atlas/tutorial/query-profiler/) shows logged slow operations; its samples alone do not establish the p95 of every authorization read. Record the collection/server p95 and driver p95 separately.

Sources: [Mongo monitoring](backend/infrastructure/mongoOperationMetrics.js), [request summaries](backend/infrastructure/logger.js), [authorization instrumentation](backend/auth/sessions.js), [metrics and authenticated instance identity](backend/infrastructure/metrics.js), [recording rules](backend/observability/slo-rules.yml).

## Reproducible capture tools

The tools read explicitly supplied environment variables and do not implicitly load the developer's `.env`. Host and environment checks precede authenticated operations. Production requires HTTPS. Use a dedicated account: the browser journey submits one quiz answer and creates/answers/finishes a training session. Opening the AI panel performs no model generation; opening mock catalog/history does not start an attempt. Captures omit bodies, cookies, credential headers, prompts, traces and screenshots.

Authorization probe, from the backend workspace:

```powershell
$env:AUTH_PROBE_TARGET='production' # or staging/local
$env:AUTH_PROBE_API_URL='https://YOUR_API_HOST'
$env:AUTH_PROBE_EXPECTED_HOST='YOUR_API_HOST'
$env:AUTH_PROBE_REPORT='D:\measurements\authorization-after.json'
$env:AUTH_PROBE_ROUNDS='10'
$env:AUTH_PROBE_CONCURRENCY='1'
# Set AUTH_PROBE_EMAIL, AUTH_PROBE_PASSWORD, AUTH_PROBE_METRICS_TOKEN
# through your local secret environment; optional AUTH_PROBE_EXPECTED_RELEASE.
npm run test:probe:authorization
```

It logs in once, warms authorization, then reads the protected static capabilities endpoint. Bounds: 1-20 rounds, concurrency 1-3, one second between rounds, stop at any non-200. Reports HTTP timings, physical authorization command QPS and estimated p95 when metrics are supplied. Scrapes must have the same authenticated `X-Metrics-Instance`; the tool rejects replicas changing between scrapes. They still include ambient traffic on that process. Scrape every replica through monitoring for whole-service rates. This small probe is not a sustained capacity test; use the existing staged concurrency load procedure for staging.

Browser capture, from the frontend workspace:

```powershell
$env:FLOW_TARGET='production' # or staging/local
$env:FLOW_FRONTEND_URL='https://YOUR_FRONTEND_HOST'
$env:FLOW_EXPECTED_FRONTEND_HOST='YOUR_FRONTEND_HOST'
$env:FLOW_API_URL='https://YOUR_API_HOST'
$env:FLOW_EXPECTED_API_HOST='YOUR_API_HOST'
$env:FLOW_REPORT='D:\measurements\flows-after.json'
$env:FLOW_RELEASE='after'
$env:FLOW_RUNS='1'
$env:FLOW_DEVICE='desktop' # or mobile
# Set FLOW_EMAIL, FLOW_PASSWORD and FLOW_ACCESS_CODE (valid four-digit invite),
# or FLOW_STORAGE_STATE for an existing legitimate invite session.
# Optional FLOW_EXPECTED_RELEASE, FLOW_TOPIC_PATH, FLOW_QUIZ_PATH, FLOW_EXAM.
npm run test:request-flows
```

The browser records API/document/RSC request timings, response sizes and request IDs for all thirteen requested actions, plus setup transitions. `automationElapsedMs` includes Playwright waits and actionability checks and is explicitly not trusted-click latency. Runs are bounded to three and stop on errors, retaining a partial report. Only loopback fixtures receive a synthetic invite cookie. An empty or exhausted question bank may need a different quiz topic; the tool fails rather than pretending that action completed.

Export decoded `request completed` JSONL from **every API replica**, preserving `requestId`, `time` and `mongo`. Repeat the same device/journey on the controlled baseline and candidate releases. Changing only the artifact label does not create a baseline. Then, from backend:

```powershell
npm run test:compare:request-flows -- after.json after-logs.jsonl comparison.json before.json before-logs.jsonl
```

The comparison includes API requests per action, repeated logical IDs (transport retries retain their ID), endpoint frequencies, matched physical Mongo/auth commands and explicit unmatched coverage. It counts each physical retry completion once. Exact duplicate exported log rows are ignored and reported. Mongo deltas remain null when either capture has unmatched API traffic. Window-wide server counts additionally include SSR and ambient HTTP requests; they cannot be attributed solely to the learner. Detached background work, incomplete requests, unsynchronized clocks and missing replica logs limit completeness. Normal browser artifacts cannot expose Next's direct server-to-Express fetches; use server logs/OTel for that part of the trace.

## Priority and verification

| Remaining concern | User-visible latency | Server load | Next evidence |
|---|---|---|---|
| F1 authorization | Broad blocking dependency | Broadest remaining repeated database work | Replica-aggregated command QPS and Atlas/driver p95 |
| Production before/after | Determines the real bottleneck order | Separates code estimates from traffic | Same-account/device capture plus complete logs |
| F5 rare empty catalog | High during a true cold rebuild | High burst of aggregations | Deployed initialization/readiness and mutation recovery |
| F3 pending grouping | Low foreground impact after quiz data arrives | Reduced to one small status read per pending poll | Production pending-job frequency |
| F16 empty mock catalog | GET no longer waits on seeding | No write amplification from GET | Deployed migration record and catalog read |

Local production-build captures used Edge with a temporary Mongo replica set, 250 fixture questions, no Redis, and reduced fixture password-hashing cost. Catalog initialization completed before the fixture accepted traffic. These are current-build observations; no baseline capture exists, so the comparison artifacts leave before/after deltas null.

| Journey | Action API requests | Matched Mongo commands | Authorization commands | Unmatched API requests |
|---|---:|---:|---:|---:|
| Desktop, one run | 33 | 177 | 42 | 0 |
| Mobile, one run | 31 | 164 | 40 | 0 |

The capture uses document navigation for several opening actions, including dashboard reload, so these counts include cookie restoration/profile reads and do not describe warm SPA navigation. Setup navigation uses the router: training hub -> setup performed zero new API reads; training start and finish each used one request. Opening the solution and quiz AI panel performed zero API requests. The desktop mathematics render additionally caused one server-side catalog request with two metadata finds and no aggregation; it is included in the separate server-window totals, not browser API totals. Cache age and authorization coalescing explain differences between devices; the figures are not universal per-action counts.

Artifacts: [desktop summary](REQUEST_FLOW_REMAINING_LOCAL_desktop_SUMMARY.json), [mobile summary](REQUEST_FLOW_REMAINING_LOCAL_mobile_SUMMARY.json), [desktop requests](REQUEST_FLOW_REMAINING_LOCAL_desktop.json), [mobile requests](REQUEST_FLOW_REMAINING_LOCAL_mobile.json), [sanitized physical request logs](REQUEST_FLOW_REMAINING_LOCAL_MONGO.jsonl).

| Paced authorization probe | HTTP requests | Authorization Mongo commands | Command rate | HTTP p95 | Driver p95 estimate |
|---|---:|---:|---:|---:|---:|
| Five rounds, concurrency 1 | 5 | 10 | 2.37/s | 26.12 ms | 4.80 ms |
| Five rounds, concurrency 2 | 10 | 16 | 3.84/s | 23.54 ms | 4.80 ms |

The sequential probe confirms the two warm validation reads; overlapping requests in the second probe shared some validation bursts. Driver p95 is histogram interpolation from very few successful commands, and the command rate reflects the deliberately paced window. Neither measures Atlas, sustained throughput, production latency, or capacity. Sources: [concurrency 1 probe](REQUEST_FLOW_REMAINING_AUTH_C1.json), [concurrency 2 probe](REQUEST_FLOW_REMAINING_AUTH_C2.json).

Completed local validation:

- Backend full coverage: 123 files passed, 4 skipped; 732 tests passed, 16 skipped. A prior Windows worker/Mongo fixture startup failure was resolved by a fresh run; no assertion or coverage threshold was relaxed.
- Frontend full coverage with one worker: 108 files / 507 tests passed. An earlier two-worker run timed out in an unchanged AI-chat test; its isolated rerun and the complete one-worker rerun passed without changing that test or its timeout.
- Backend and frontend lint/typecheck passed; backend runtime boundaries passed.
- Current frontend production build passed. All 83 route entry budgets passed; the largest quiz entry was 120,840 gzip bytes against 180,000. Interface checks passed.
- Desktop/mobile browser regression suite: 18 tests passed, including status-only polling and existing performance flows. Both status-polling browser tests also passed after the final fixture/auth adjustments.
- Prometheus 3.5.0: all 18 rules passed syntax validation and rule unit tests passed, including replica aggregation for authorization QPS/p95.
- Final backend focused checks: five files / 16 tests passed, including real-Mongo status/catalog/migration/request-count checks and all six authorization race tests.

No production or Atlas acceptance is claimed. Live release initialization, complete replica logs, a controlled baseline/candidate pair and Atlas measurements remain pending the requested environment/account/monitoring details. No deployment was performed.
