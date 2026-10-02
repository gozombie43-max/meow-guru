# Verified performance and reliability plan

Review baseline: local clean `main` at `c75815a7`, checked 2026-10-02. The supplied review contains repository findings, historical measurements, hypotheses, and operational work; they require different evidence. This document tracks all 25 items and is updated with results after implementation.

## Execution order and acceptance

1. Repair browser measurement; split `/play` into a server entry/static content and client interaction, load insights on demand. Verify URLs, exam switching, setup, both themes and repeated production-server desktop/mobile measurements. TTFB <800 ms, observed LCP <2500 ms, CLS <0.10; missing observations fail the gate. These local measurements do not establish real-user percentiles.
2. Instrument history, learner state, pool, due lookup, exposure, selection, hydration, insertion and invalidation with bounded-label histograms and trace spans. Run disposable local C1, C5, C10 with cold/warm phases. Preserve adaptive selection and hydration contracts. Optimize the dominant measured stage; stop progression at the first failed objective (dashboard 300 ms, create 800 ms, answer 350 ms p95, zero errors).
3. Keep cursor browsing as the internal default; bound and log legacy offsets without breaking shallow compatibility. Add a disposable 10K/50K/100K Mongo benchmark reporting p50/p95 and execution statistics for deep, sorted and filtered pages. Separate queue connection configuration and verify durability before worker/scheduler activation.
4. Supply staging monitoring/probe configuration and an ordered rollout checklist. Keep operational outcomes pending until actual staging/device/cloud evidence exists. Preserve the current production deployment path until canary prerequisites are provisioned and verified.

## Finding-by-finding disposition

| Review item | Current verification | Action and completion evidence |
| --- | --- | --- |
| 1. `/play` TTFB | Client page and eager insights confirmed. Historical 965.10 ms is recorded in the existing browser error context; it is not a current production percentile. Client components already prerender, so moving files alone does not prove a TTFB fix. | Server static content/client interaction split, deferred insights, real observer-based metrics, repeated production-server browser runs. |
| 2. Creation spans | Coarse log events confirmed; existing pool timer includes due and exposure. | Add individual traces/histograms, retain existing events, collect phase distributions. |
| 3. Pool stampede | Cold-key builders have no coalescing. Shared mode currently depends on live Redis; absent Redis every caller builds separately. | Measure first, then add bounded single-flight/tiered caching only if pool dominates; retain revisions, ObjectIds and caller-specific exclusions. |
| 4. Smaller candidate volumes | 900/450/900/1200 limits confirmed. | Do not reduce defaults without weak-topic/repetition/selection-quality comparison. |
| 5. Learner-state snapshot | 2000 reviews/5000 skills and completionEpoch confirmed. | Measure first. A cache requires coherent revision reads and completion/rebuild invalidation; defer if not dominant. |
| 6. Offset retirement | Quiz fetcher already uses cursor by default; Mongo compatibility skip remains. | Verify all internal call sites; retain bounded shallow compatibility, log legacy usage and provide cursor error on extreme offsets. |
| 7. Pagination scale proof | Cursor tests exist; explicit dataset-depth benchmark missing. | Add and run disposable benchmark, including filtered/sorted and reverse/last-page queries. |
| 8. Observability activation | OTEL, metrics, rules, Grafana assets exist. External activation is not evidenced. | Prepare scrape/collector configuration and verification commands; remote activation needs isolated target and monitoring access. |
| 9. External uptime | Local liveness/readiness endpoints exist; backend counters cannot prove reachability. | Prepare external blackbox probes and alerts for both endpoints. |
| 10. Alert delivery | Rules alone do not establish delivery. | Document receiver configuration and a controlled operator delivery test; no unsolicited notification sending. |
| 11. C1/C5/C10 | Historical C10 breach is recorded in ARCHITECTURE_IMPLEMENTATION.md. | New instrumented isolated-local cold/warm runs, report exact results and stop on failure. |
| 12. Azure/Atlas load | Isolated staging workflow exists. | Run only against verified staging; highest passing stage is capacity boundary. Pending remote evidence. |
| 13. Redis crash drill | CI tests exist, no live multi-instance crash proof. | Staging drill: traffic, Redis stop/restore, answers/progress/invalidation/reconnection evidence. Pending isolated infrastructure. |
| 14. Separate durable Redis | BullMQ currently uses REDIS_URL only; docs require persistence/noeviction. | Add QUEUE_REDIS_URL and explicit verified fallback; reject unsuitable configuration before scheduling work. |
| 15. Worker kill/recovery | Retry/stalled policies exist. | Keep flag off until staging worker death proves one durable result and recovery. |
| 16. Overload test | Gated middleware and critical-route isolation tests exist. | Run local isolation checks; intentional real staging saturation remains pending. |
| 17. Threshold tuning | Defaults are present, collapse point unmeasured. | Preserve defaults pending staging event-loop/RSS/pool evidence. |
| 18. Compact history | Flag, stable cohort hashing and legacy fallback exist. | Preserve gates; 0/1/10/50/100 rollout needs parity/payload/latency evidence at each step. |
| 19. Android offline | IndexedDB flag and browser/unit tests exist. | Keep build flag gated pending physical WebView kill/restart/offline/account-switch proof. |
| 20. Canary prerequisites | Promotion workflow exists; normal deployment targets production. | Prepare exact artifact/slot/settings/synthetic/observation requirements; avoid replacing deployment before provisioning. |
| 21. Same artifact | Locked production packaging and release IDs exist. | Preserve build-once promotion and verify release identity at each step. |
| 22. Mongo restore | No actual restore/RTO/RPO evidence supplied. | Separate restored database, readiness and lifecycle verification, measured recovery times. |
| 23. Atlas tier | No measurements establish a tier purchase. | No tier change; decide from CPU/IOPS/working-set/pool/query evidence. |
| 24. Old PRs | Live GitHub check on 2026-10-02 confirmed #28/#27/#26/#10/#9/#8/#7 remain open with conflicts. | PR triage is an external work package; preserve unique useful changes before any remote cleanup. |
| 25. Issues | Live GitHub check on 2026-10-02 confirmed zero open issues. | Issue-ready work packages are in the staging runbook; no remote issue or notification was published. |

## External prerequisites

Isolated Azure/Atlas staging target and learner credentials; monitoring collector/Prometheus/Grafana access; persistent noeviction queue Redis; external probe host and receiver destination; two API instances and a worker; supported Azure slot/protected GitHub environment/observations endpoint; physical Android device; separate restore destination and approved backup. None of these are inferred from production `.env` files.

## Results

Repository changes cover the applicable local findings. Cloud activation, fault injection, sustained capacity, physical Android, canary promotion and restore remain open external gates in [RELIABILITY_STAGING_RUNBOOK.md](backend/RELIABILITY_STAGING_RUNBOOK.md). No production flags, migrations, deployment targets or resource tiers were changed.

### Training creation

Nine named trace spans and `meow_training_create_stage_duration_seconds{stage,outcome}` separate history, learner state, pool, due, exposure, selection, hydration, insertion and invalidation. The baseline cold C10 section p95 was **959.36 ms**, breaching the 800 ms gate. Pool coalescing/revisioned EJSON caching and hoisted normalization remove measured repeated work while retaining pool volumes and caller-specific exclusions.

| C10 create p95 | Cold | Warm |
| --- | ---: | ---: |
| Section mathematics | 286.68 ms | 174.86 ms |
| Exam-wide adaptive | 200.12 ms | 166.86 ms |
| Daily mission | 276.77 ms | 244.89 ms |

All 18 combinations of three scenarios × C1/C5/C10 × cold/warm pass the local objectives with zero request errors/failed learners. [Before](backend/training-load-before.json), [after](backend/training-load-after.json), and [27 baseline-ranking parity cases](backend/training-selection-parity.json) retain the evidence. These are short bursts over 3,500 disposable local questions with candidate/catalog L1 caches and Redis disabled; they do not establish large-history, sustained or Atlas capacity. The final cold protocol also explicitly clears the legacy catalog cache between stages; the initial baseline did not, so this is a diagnostic comparison rather than a controlled capacity estimate. Stage count/mean diagnostics overlap where work runs concurrently and must not be summed.

### Pagination and queue safety

[Pagination evidence](backend/pagination-benchmark.json): five repetitions at 10K/50K/100K, cursor/offset ID parity, first/deep/sorted/filtered/reverse/last pages and execution stats. At 100K, sorted page 1000 p95 is **3.94 ms cursor vs 49.65 ms offset**. Cursor seek depth remains bounded; low-selectivity filters and exact last-page counts are reported separately. Existing indexes suffice for measured seeks. Default/zero-offset internal browsing uses cursors; offsets above 1000 fail with a migration instruction, while shallow external compatibility remains logged.

Durable queue activation now requires `QUEUE_REDIS_URL` or explicit `QUEUE_REDIS_ALLOW_SHARED=true`; before scheduling or worker creation, inspection requires noeviction and healthy enabled AOF/RDB persistence. ACL-denied inspection fails activation. Separate storage/restart/RPO proof remains a staging gate; persistent configuration and remote flags were unchanged.

### Observability and checks

Staging templates provide authenticated per-instance scraping, OTLP collection, external liveness/readiness probes and an Alertmanager receiver secret file. Dashboard panels expose creation stages and external uptime. Checksum-verified Prometheus 3.5.0 `promtool check rules` and `promtool test rules` pass all 15 rules and alert fixtures. YAML/JSON parse checks pass. Template parsing/rule tests do not establish activation or delivery; operator-specific mounted-file config validation remains required.

Backend full suite: **511 passed, 2 skipped** (disposable Redis unavailable); backend lint passed.

### Frontend status and remaining startup gate

`/play` has a server entry/static content slots, client interactions and deferred insights. URL/exam/setup contracts remain covered. The browser gate now uses actual buffered LCP/layout-shift observers and fails on missing measurements. It makes three document navigations per desktop/mobile run and retains timing JSON.

Fresh-process diagnosis also found a separate startup cost: importing Sentry's build plugin during `next start` took about two seconds. Configuration now imports that plugin only for build/development, while built runtime instrumentation, both tunnel rewrites and trace metadata remain verified. The server SDK also skips loading when no DSN is configured; configured Node/Edge initialization, privacy settings and request-error forwarding have passing tests.

The strict [startup report](frontend/performance-play-startup-results.json) is **still failing**: first `/play` response headers after three fresh CLI starts are **1056.32 / 1065.61 / 1035.08 ms**, versus **3889.04 / 3780.55 / 2893.21 ms** before the startup corrections. Warm HTTP requests are 19.87–30.70 ms. This test sends the first request immediately after the CLI ready message, includes lazy framework initialization and uses a routing-only dummy cookie; it does not prove authenticated API access or browser rendering. Profiling points primarily to Next/Node module and filesystem loading on this Windows environment. No framework replacement or custom server was introduced to hide that remaining gate.

The fixture has unconfigured monitoring. Real cold/warm staging/browser measurements with the intended monitoring settings remain required before closing P0 `/play` performance. Run `npm run test:performance:startup -- --output performance-play-startup-results.json` from `frontend`; its nonzero exit records the failed cold objective. [Browser/intermediate/startup evidence](frontend/performance-play-results.json) distinguishes all measurements.

Final authenticated production-server browser measurements (warm after fixture login): desktop TTFB **12.7–80.6 ms**, observed LCP **128–232 ms**, CLS **0.035**; mobile TTFB **9.2–48.4 ms**, observed LCP **96–184 ms**, CLS **0**. Three document navigations per project pass; ten final browser tests cover these gates plus training/topic/mock routes and Play setup/reload/results in both themes. Earlier repeated `/play` runs also passed 18 navigations; the final six samples are retained above. These local fixtures do not establish real-user p75 or cold-production performance.

Final frontend checks: **391 tests passed across 84 files**, ten Playwright tests passed, production build generated 802 routes/pages, typecheck/lint/bundle budgets passed, and interface checks passed at 320/390/768/1366/1440 in both themes with safe-area cases. `git diff --check` passed. The only executed performance gate still failing is the explicit fresh-process startup check described above. No commit, push, deployment or remote repository mutation was made.

## Full pre-commit verification before the mobile exit fix — 2026-10-03

This checkpoint expanded the earlier ten-test browser scope. At that point, commit readiness was not ready for an all-green verification result. The final results below supersede its browser failures.

| Check | Fresh result |
| --- | --- |
| Lint and typecheck | Root typecheck and frontend/backend lint pass. |
| Frontend tests and coverage | 84 files / 391 tests pass; configured thresholds pass. Overall line coverage 44.47%; quiz session reducer lines/branches/functions are 100%. Vitest warns that it cannot parse the untested `lib/server/publicCatalog.ts` for coverage and omits it. |
| Backend tests and coverage | 88 files / 511 tests pass; one file / two real-Redis tests skipped because disposable Redis is unavailable. Overall line coverage 77.42%; configured auth/write thresholds pass. |
| Security | Root/frontend/backend npm audits each report zero vulnerabilities. Checksum-verified Gitleaks 8.30.1 finds zero leaks across 1,013 commits and 1,073 current source files. |
| Production build and bundle/interface | Production build generates 802 static pages; JavaScript budgets and interface checks pass. |
| Complete browser suite | With `NAVIGATION_APP_URL` set so optional tests actually execute: 44 tests run, 38 pass, **6 fail**, none skipped/flaky. All failures are mobile-width quiz exit tests at `quiz-navigation.spec.ts:73`: the open settings dialog has no `Leave quiz` button. This mobile settings/navigation implementation is unchanged in the current patch. |
| Authenticated Lighthouse | Chrome 131.0.6778.264, 18 fresh runs across six intended routes; route, successful API-data and console checks pass. CLI exits zero because budgets are configured as warnings. Five routes exceed median LCP 2.5 s; algebra quiz also misses score 0.9 and TBT 200 ms. |
| Backend runtime/monitoring checks | Optional-integration-free app smoke, ESM preload, HTTP/Mongo OTLP export/redaction, all 15 Prometheus rules and alert fixtures pass. |
| Training load | All 18 C1/C5/C10 cold/warm scenario combinations pass with zero errors. Section C10 creation p95 277.39 ms cold / 181.51 ms warm. |
| Pagination scale | Five repetitions across 10K/50K/100K, 48 navigation cases, ID parity and execution statistics complete successfully. |
| Fresh-process `/play` | **Fails**: response-header times 1098.56 / 1035.97 / 1045.88 ms, exceeding 800 ms. Warm requests remain 16.55–30.06 ms. |

Lighthouse medians: `/login` score 0.92, LCP 2979 ms; `/mathematics` 0.92 / 2941 ms; `/play` 0.93 / 2821 ms; training session 0.90 / 3354 ms; algebra quiz 0.84 / 3632 ms with TBT 299 ms; mock attempt 0.97 / 1847 ms. These are simulated mobile lab measurements, distinct from the unthrottled browser timings above.

At this checkpoint the six exit/navigation failures needed correction. Cold-start and simulated-mobile performance targets remained open. The frontend coverage omission and unavailable real-Redis evidence are retained as explicit limitations. Full JSON results are saved locally under the task's temporary verification directory; screenshots generated by tests were moved there so they do not enter the commit. This checkpoint did not change source behavior, test expectations or thresholds, and no commit was made.

## Mobile exit fix and final local commit readiness — 2026-10-03

The user explicitly deferred cold `/play` and `/play` LCP work. Those objectives remain open and are excluded from this commit-readiness decision; no startup benchmark or Lighthouse run was repeated, and no performance threshold was lowered or disabled.

The six browser failures shared one cause: mobile quiz settings had no `Leave quiz` action. Mobile settings now offers that action and closes before requesting the existing quiz exit confirmation through guarded navigation. Cancel keeps the quiz URL, submitted answer and session, and restores focus to the settings button. Confirm replaces the route with its explicit topic parent, including nested mathematics routes. The settings panel now scrolls within the available dynamic viewport and safe areas.

Existing browser assertions were preserved and strengthened to check settings dismissal, the quiz URL and focus after cancellation, plus a reachable action at least 44px high on 320/390px-wide, 568px-high screens.

| Final check | Result |
| --- | --- |
| Focused navigation browser suite | 8 passed, including all six previously failing cases. |
| Complete browser suite | **44 passed; zero failed, skipped or flaky.** The optional navigation tests were enabled with `NAVIGATION_APP_URL`. |
| Frontend tests and coverage | 84 files / 391 tests passed; configured thresholds passed. Overall line coverage 44.45%; the pre-existing `publicCatalog.ts` coverage-parser omission remains. |
| Lint and typecheck | Frontend/backend lint and final frontend typecheck passed. The strengthened browser test also passed targeted lint. |
| Production build / bundle / interface | 802 static pages; bundle budgets and interface checks passed, including both themes at five widths and safe-area cases. |
| Backend / security / runtime / load | The full checks above remain applicable to unchanged backend/dependency sources: 511 backend tests passed, two Redis tests skipped; audits, tracing, Prometheus, load and pagination checks passed. The final current-source secret scan also passed. |

**Ready for a local commit within the agreed scope.** Two real-Redis tests remain skipped because no disposable Redis is available. The coverage omission, warning-level Lighthouse results and external staging/device/production gates remain documented limitations; this does not claim production promotion readiness. No commit or push was made.
