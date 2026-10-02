# Architecture implementation and evidence

This records the sequential implementation of the 30 recommendations supplied on 2026-10-02. Repository work and local verification are complete for the scope below. Cloud activation, sustained staging capacity, real Redis recovery and Android device proof remain separate gates. This is not a claim that every suggested migration or production rollout is complete.

| Stage | Recommendations | Status |
| --- | --- | --- |
| 1 | 3: request/dependency/job tracing | Implemented; real local OTLP export verified |
| 2 | 2: keyset pagination and client migration | Question bank/inbox migrated; compatible exam-feed cursor API added |
| 3 | 1: durable queue/retries/deduplication/draining | BullMQ maintenance scheduling added behind a flag; existing durable jobs retained |
| 4 | 9: shared idempotency | Implemented and checked across two HTTP app instances |
| 5 | 5, 6, 8, 15, 22: cache hierarchy, coalescing, SWR, invalidation, batch reads | Implemented for shared metadata and catalogs |
| 6 | 7, 14: materialized reads and database round trips | Compact completion evidence added; metadata reads combined |
| 7 | 10, 11, 23, 27, 29: dependency budgets, shedding, readiness, rollouts | Implemented; gated changes remain off by default |
| 8 | 4, 24, 25: SLOs, load stages and failure/multi-instance tests | Local checks passed; C10 creation latency target failed; staging/Redis gates remain |
| 9 | 16-21, 28: shared frontend caching, client boundaries, virtualization, prefetch, offline recovery, retries | Implemented; browser/coverage/build checks passed; offline training remains gated |
| 10 | 12, 13, 26, 30: canary preparation and measurement-based cloud operations | Canary policy/workflow prepared; cloud changes deferred to measurements |

Existing Mongo-backed attachment, tutor and concept jobs, notification claims, battle outbox, revision checks and learner read models are retained. A Redis queue must not silently change durable job ownership or make Redis a hard dependency for quiz answers.

Cloud tier/region changes and canary traffic activation are conditional on staging evidence and available infrastructure. The current production workflow explicitly selects quiz-only mode and disables embedded workers; new worker features therefore require deliberate configuration at deployment.

## Recommendation-by-recommendation result

| # | Result and practical boundary |
| --- | --- |
| 1 | Opt-in BullMQ schedules concept grouping, scheduled notifications, daily reminders, streak protection and battle seasons while preserving configured poll intervals. Global queue concurrency, retries with jitter, delayed/prioritized deduplicated enqueueing, stalled recovery, retained failed jobs and draining are configured. Attachment/tutor/concept ownership remains in Mongo; battle results retain their durable outbox and deadlines. Season finalization now recovers expired/legacy claims and commits rewards/completion in a fenced transaction. Synchronous JSON AI endpoints retain their contracts. |
| 2 | Question bank listings now use compound `id/_id` cursors with natural ordering, filter binding, search/exam/facet parity and first/previous/next/last navigation. Inbox defaults to date/_id cursors; exam-update feeds support cursor opt-in. Legacy offset contracts and numbered low-volume admin user/notification/integrity pages remain. This is not complete deletion of every `.skip()` call. |
| 3 | Opt-in OpenTelemetry preload instruments HTTP/fetch, Express and Mongo. Redis commands and dependency budgets have manual spans. Request IDs/W3C context propagate through browser requests, logs, stored job carriers, attachment children and Socket.IO handlers. URL/query/database-body and process-argument attributes are stripped before export. Live Vercel/Android/collector traces were not observed. |
| 4 | Protected Prometheus scrape, HTTP/dependency histograms, pool-wait/default process metrics, a six-panel Grafana dashboard, 99.9% availability objective and multiwindow burn alerts are supplied. Alerts and dashboard import are not activated remotely. External probes are still needed for unreachable ingress and abandoned requests. |
| 5 | Bounded L1 + optional Redis L2 caches, in-process coalescing and renewable distributed refresh locks cover shared question metadata/training catalogs. Redis commands and queues have finite time/size limits. Actual two-worker Redis tests are configured in CI and remain unrun locally. |
| 6 | Metadata uses roughly five-minute fresh / thirty-minute stale retention with TTL jitter and background refresh. Correctness-sensitive training question selection disallows stale catalogs. |
| 7 | Existing learner read models are retained. Completed sessions now store versioned scalar dashboard evidence atomically with learning updates. Gated compact history projections omit question/answer/result rows once durable learner state is ready, with a legacy-record fallback and parity checks. Dashboard construction still performs several indexed reads. |
| 8 | Writers publish advisory `question.changed` invalidation and API/worker subscribers clear local caches. Shared Mongo revisions remain authoritative after missed Pub/Sub events. This is cache invalidation, not a durable analytics event bus. |
| 9 | User/operation/path/input-scoped Mongo idempotency wraps training create/actions/diagnosis, mock submission, question answers, battle claims and AI question generation. Pending outcomes never steal a lease and return reconciliation errors. Existing bulk import, tutor attachment and mock-start protocols are preserved; mock start must return current saved progress. JSON snapshots are capped at 1 MiB and retained for 24 hours. |
| 10 | Application-wide per-process budgets protect heavy Mongo work, AI, OCR, PDF rendering/extraction, image transforms, object storage and Firebase. Queues are bounded and callers have deadlines/cancellation; uncooperative work retains its slot until it settles. BullMQ has a separate cross-worker concurrency cap. Per-process provider limits multiply when scaling the fleet. |
| 11 | Opt-in admission sheds optional AI/enrichment POSTs on memory, event-loop, Mongo pool or AI queue pressure, returning `503 Retry-After: 3`. Quiz actions, finish, auth and progress remain admitted. Redis/worker-backlog-driven shedding is not enabled; their own queues/clients are bounded. |
| 12 | Existing primary-read and pooling behavior is retained. Dedicated Atlas tier, PITR/backups, autoscaling and termination protection are operational gates requiring current measurements, budget and restore verification; no Atlas mutation was performed. |
| 13 | Region movement remains conditional on measured cross-cloud latency. No hosting region or database migration was performed. |
| 14 | Question metadata's separate total/exam/concept/letter reads are combined into one `$facet`. Revision reads coalesce concurrent requests; compact dashboard history reduces transferred/scanned evidence. This does not promise one or two database calls for every endpoint. |
| 15 | Topic-count warmup primes independent shared count keys with one Redis `MGET` and avoids subsequent per-key shared GETs during that pass. |
| 16 | Only public topic counts receive Vercel CDN cache headers. Personalized progress, answer/session data and credential-bearing requests stay outside shared caches. Live CDN hit rate is unmeasured. |
| 17 | Shared topic metadata uses Next's supported `fetch` revalidation/tags in the existing configuration. Global Cache Components/remote-cache mode was not switched on across authenticated routes. This supplies shared server caching without a whole-app migration. |
| 18 | Four subject hub page entry points fetch shared metadata on the server and seed their client islands. Existing interactive hub/quiz components remain client components. No broad hydration or Core Web Vitals improvement is claimed. |
| 19 | Mobile rail/grid and desktop palettes virtualize above 100 questions. Browser checks navigate to question 500 with bounded DOM rows; mobile checks cover both themes, overflow and 44px targets. Admin/feed/history pages are already bounded by paging and were not all converted to virtual lists. |
| 20 | Topic cards/rows prefetch on hover/focus/touch intent. Quiz sessions begin next-page prefetch near the end of their loaded window. Existing bounded page requests and cache deduplication remain. |
| 21 | Gated training recovery stores per-user snapshots, revision and one pending mutation in IndexedDB. Reload/online replays the same idempotency key before fetching authoritative state. It never invents offline grading. Other quiz types retain their existing persistence; real Android/WebView recovery is not verified. |
| 22 | Shared metadata may return retained stale values during refresh/provider failure. Revision lookup has a 300 ms deadline with its last known value as a noncritical fallback. Expired data and correctness-sensitive writes do not silently succeed from stale cache. |
| 23 | Mongo/migrations remain hard readiness dependencies. `/live` checks process liveness; `/health` exposes optional Redis/queue/storage/worker states. Unprobed dependencies report `unknown` instead of falsely reporting healthy. |
| 24 | Local/staging tooling supports C1/C5/C10/C25/C50/C100 with latency/error/payload reporting. Local and staging gates enforce GET/dashboard 300 ms, create 800 ms and answer 350 ms p95 and stop progression after failure. Local C10 breached create latency; no remote capacity result is claimed. Dependency/process metrics require the configured monitoring collector during staging runs. |
| 25 | Tests cover cache failure/stale expiry, provider deadlines/circuits, overload isolation, ambiguous post-commit writes, duplicate writes across two apps, existing Mongo job/outbox leases and multi-instance realtime. Season tests recover expired/legacy finalization and roll back an old owner's reward writes after ownership changes. CI adds actual Redis queue retry/dedup and cross-cache locking tests. Killing live Redis/Mongo/cloud providers or crashing real worker processes was not performed. |
| 26 | Canary policy rejects missing/stale observations, bad release/readiness, insufficient volume and latency/availability breaches. An opt-in protected Azure slot workflow routes 5%, observes, evaluates, swaps and checks rollback identity. It assumes an already deployed canary and supported existing slot/monitor source. Authenticated synthetic lifecycle remains an operator gate; no traffic was changed. |
| 27 | Common stable user-cohort helper supports 0/1/10/50/100 percentages; compact history uses it. Queue, shedding, telemetry and offline recovery use explicit opt-in infrastructure/build flags. Existing global read flags are preserved. |
| 28 | Client retries use exponential jitter and full `Retry-After`. Writes require valid idempotency keys before retry; ordinary POSTs remain unretried. Read-only storage retries are bounded; generic mutation retries are prohibited. |
| 29 | Shared dependency boundary provides tracing, metrics, concurrency/queue budgets, deadlines and circuit recovery for migrated heavy/provider paths. Mongo/Redis retain driver timeouts and existing fallback contracts; unrelated domain queries were not indiscriminately wrapped or automatically retried. |
| 30 | The Express API with supervised workers, Redis, Mongo and existing object storage remains the topology. No microservices, sharding, Kubernetes or extra Web Apps were introduced. |

## Verification actually completed

- Backend: **87 files / 502 tests passed**, with the **two Redis tests skipped** because this machine has no disposable Redis server. Existing coverage thresholds passed: statements 74.82%, branches 66.88%, functions 70.93%, lines 77.29%.
- Frontend: **84 files / 386 tests passed**, including IndexedDB user isolation, uncertain writes, replay ordering, reconnect and definitive conflicts. Coverage thresholds passed: statements 42.42%, branches 35.02%, functions 36.79%, lines 44.48%.
- Both workspace lints and frontend typecheck passed. Next production build and entry gzip budgets passed. These are not Lighthouse/real-user Core Web Vitals results.
- **10 Playwright checks passed** across desktop/mobile projects: assessment save/reload/submit, training persistence, mobile quiz design and 500-question palette navigation. Fixtures use local backend/data and mocked shared question responses.
- Interface checks passed in light/dark at widths 320, 390, 768, 1366 and 1440, with quiz safe-bottom checks for 0/24/34/48 px and the shared UI contract.
- Real ESM preload/fetch/Mongo auto-instrumentation exported spans to a disposable local OTLP collector, with URL/process-argument redaction. The HTTP export smoke also passed from an isolated **production-only `npm ci`** artifact after materializing runtime contracts and verifying deployment dependencies/credential-free app startup.
- Official checksum-verified Prometheus 3.5.0 `promtool` accepted **12 rules** and passed healthy-versus-burn behavior tests. Workflow/rule YAML and Grafana JSON parsed. Grafana import, alert routing, Azure commands and GitHub CI execution were not observed.
- Workspace backend/frontend audits each reported **zero vulnerabilities**. `git diff --check` passed.

The final C1/C5 CI-equivalent local load run passed all three scenarios with zero errors:

| Scenario | C1 create p95 | C5 create p95 | C5 dashboard p95 | C5 answer p95 |
| --- | --- | --- | --- | --- |
| Section Mathematics | 333.43 ms | 574.96 ms | 110.75 ms | 37.18 ms |
| Adaptive all | 176.43 ms | 493.74 ms | 57.47 ms | Create-only scenario |
| Mission all | 230.81 ms | 708.75 ms | 75.05 ms | Create-only scenario |

Earlier section lifecycle exploration completed C1/C5/C10/C25/C50 with zero failed learners, but create p95 increased to 986.91/1766.48/3408.50 ms at C10/C25/C50. After adding the objective gate, a separate run **correctly exited 1 at C10**, with create p95 **987.35 ms** against 800 ms (answer p95 64.52 ms, dashboard p95 147.02 ms, zero failed learners). C100 was not attempted after that failed gate. These are short isolated-local measurements, not sustained Atlas/Azure load or production capacity.

## Deployment gates and remaining work

1. Apply additive migrations **013-idempotency** and **014-feed-keysets** to the intended database in a controlled release; application readiness requires them. Local integration migration checks do not apply production indexes.
2. Keep `USE_DURABLE_QUEUE`, `USE_COMPACT_TRAINING_HISTORY`, `USE_OVERLOAD_SHEDDING`, `OTEL_ENABLED` and `NEXT_PUBLIC_OFFLINE_TRAINING` off until their associated staging checks pass. Compact history supports stable per-user percentages and safe legacy fallback. Existing learner-state rebuild populates evidence; any production backfill needs a reviewed dry run, controlled apply and reconciliation.
3. Run the disposable real Redis suite in CI/staging, including an actual Redis restart/crash drill before queue activation. Durable jobs require persistent, non-evicting Redis. An eviction cache instance or a different logical DB on it does not provide that guarantee.
4. Configure the OTLP/Prometheus/Grafana/external probe integrations and collect dependency/pool/process metrics alongside sequential sustained staging stages. Resolve the measured C10 create-latency bottleneck before treating higher stages as accepted capacity.
5. Verify an enabled offline build through reload/reconnect and real Android WebView before activation. Unit hook/storage proof and the default-flag-off browser suite are different evidence classes.
6. Use [the canary runbook](backend/CANARY_RUNBOOK.md) only after a supported existing slot, protected environment, observation source and scoped synthetic lifecycle credentials are available. Keep the present production deployment workflow until then. Atlas tier/backup/region changes remain measurement-dependent.
7. Retire legacy offset contracts and remaining numbered admin pagination through a separate coordinated client migration if their measured volume justifies it. Current callers retain those contracts; the main question/inbox paths use cursors.

No commit, push, deployment, live-data migration, cloud purchase, region change, monitoring notification or production traffic mutation was performed.

Temporary artifact cleanup was rejected by automatic approval review with only `blocked by policy` as the reason. The isolated deployment/Prometheus fixture remains at `C:\Users\91906\AppData\Local\Temp\meow-architecture-runtime-db94d69e-c9ac-40ca-b5cb-0b798551f4b2`; generated reports and screenshots were removed from the repository worktree.

## Commit and deployment readiness review - 2026-10-02

The reviewed candidate contains **118 pending files** on top of `71b4fa9283f66f66db650d2d2b6cdbc8a295f70b`. A SHA-256 manifest confirmed that implementation sources stayed unchanged throughout this verification. No environment files, private key files, dependency/build directories or generated reports are part of the candidate. A limited high-confidence credential-pattern scan found no matches in added content; this is not a replacement for the CI Gitleaks scan.

The story checked is quiz/training browser requests through Express, authoritative Mongo state, persisted progress and response rendering, including dependency failures and release packaging.

| Check | Current review evidence |
| --- | --- |
| Backend tests and coverage | Fresh run: 87 files / 502 tests passed; 1 file / 2 real Redis tests skipped; coverage thresholds passed |
| Frontend tests and coverage | Fresh run: 84 files / 386 tests passed; coverage thresholds passed |
| Typecheck and lint | Fresh frontend typecheck and both workspace lints passed with zero warnings |
| Dependency audits | Fresh backend and frontend audits each reported zero vulnerabilities |
| Runtime startup | Fresh credential-free app/training-route smoke returned the expected 401 |
| Tracing | Fresh ESM preload/fetch/Mongo/local OTLP export and redaction check passed |
| Build and bundles | Existing production build covers all current frontend implementation sources; fresh entry bundle-budget check passed |
| Workflow and monitoring files | All three changed/new workflows and both rule files parsed as YAML; dashboard JSON parsed with six panels |
| Broader browser suite | All 44 tests were selected with optional navigation checks enabled. Run stopped at the first failure: 12 passed, 1 failed, 31 did not run |
| GitHub CI | The latest successful quality run covers existing HEAD `71b4fa92`, not these pending changes: [run 36904812860](https://github.com/gozombie43-max/meow-guru/actions/runs/36904812860) |

The browser failure is `performance.spec.ts`'s desktop `/play` TTFB assertion: **965.10 ms against an 800 ms limit**. Its trace shows the HTML request returned HTTP 200 with about 956 ms waiting, while the authenticated dashboard request returned HTTP 200 in about 44 ms. This identifies a document-response performance gate failure; it does not establish a backend dashboard regression or a production percentile. Profile the Next document response/middleware/startup path and rerun this unchanged gate before accepting the complete browser suite. The earlier ten focused browser checks remain valid, but are not a complete-suite pass.

**Decision:** a local checkpoint commit of the documented implementation is acceptable. **Production release/deployment approval is withheld.** Suggested checkpoint title: `feat: add runtime safeguards and resilient quiz data flows`. This decision does not claim the quality gate is green or authorize a push, migration, canary activation or feature-flag activation.

Release approval requires resolving the browser TTFB failure, completing the broader browser/remote CI checks for this exact candidate, passing real Redis tests and restart/crash recovery before queue activation, and accepting sustained staging load evidence after the recorded C10 create p95 **987.35 ms / 800 ms** breach. Migrations 013/014 and the canary/operator gates above also remain unapplied/unverified remotely. Keep the new gated features off meanwhile.

The current `main` push workflow applies database migrations and deploys automatically. A local checkpoint commit does not run that workflow. No commit, push, deployment or live-data mutation was performed during this readiness review.

## Authorized backend startup - 2026-10-02

After explicit user approval, migrations `013-idempotency` and `014-feed-keysets` were applied to `quizDB` on `quizguru-db.4ev4unh.mongodb.net`. Only those two migration definitions were run. All five expected indexes and the full required migration set were verified afterward. This completes the migration gate for that database; the browser, Redis recovery, staging capacity and canary gates above remain.

The backend was started with `npm start` at `http://localhost:10000` in the configured quiz-only mode, with embedded workers disabled. At verification time, `/live` and `/health` returned HTTP 200, readiness was `ready`, Mongo and Redis reported healthy, and the unauthenticated training capabilities route returned the expected HTTP 401. No deployment or feature-flag activation was performed.
