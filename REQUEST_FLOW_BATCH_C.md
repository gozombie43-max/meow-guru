# Request-flow Batch C

Implemented locally on 2026-10-08 over checkout `8a65e94d`, preserving the uncommitted Batch A/B work. Scope follows items 10–13 in the supplied batch plan: Mathematics precomputation, public catalog stale-while-revalidate, safe Mongo concurrency, and public question reads during auth restoration. The original [audit](REQUEST_FLOW_AUDIT.md) remains a pre-change baseline.

## Updated flows

### Mathematics snapshot and public catalog: F5

```text
API starts after Mongo readiness -> HTTP listener ready
  -> optional Mathematics prewarm, immediately and every 15 minutes
     -> strict revisioned snapshot cache -> persisted Mongo snapshot
     -> rebuild when missing, a different revision, or >=1 hour old
        -> prime Redis count caches
        -> existing batches of <=4 topic count reads/aggregations
        -> revision check -> fenced Mongo snapshot save -> tiered cache

Question bank application write
  -> existing revision advancement/cache invalidation
  -> existing awaited Mathematics snapshot precomputation

Open /mathematics
  -> Next server public fetch, existing 60-second data-cache revalidation
     -> direct Express GET /api/questions/topic-counts
        -> public tiered cache / persisted Mongo snapshot
        -> valid snapshot younger than 24 hours: respond immediately
           -> if old revision or >=1 hour old: refresh strict snapshot in background
        -> absent/invalid/too old: await strict rebuild
  -> shared totals seed -> render
```

Prewarming covers normal API startup and periodic recovery for external imports; it does not delay listener readiness. Shutdown stops the timer and drains its current warmup. Existing write-time precomputation already existed and remains intact. Refreshes coalesce per process and normalized-key mode, and the existing tiered lease and revision-fenced persisted write protocols remain in use.

Only this **public catalog** can serve a previous bank revision. Express bounds reuse to 24 hours by its source timestamp; subjects, revision, timestamps, complete canonical totals, and nonnegative integer counts are validated. The response whitelists public fields. A five-second public cache freshness window avoids repeated persisted lookups; stale cache entries can be refreshed in the background. Existing Next/CDN caching adds its own revalidation window and can retain an older rendered seed during failed revalidation; this is not an end-to-end 24-hour browser age guarantee.

Private progress still calls the strict snapshot reader. Question pages, scoring, auth validation, and durable progress generation checks retain their existing consistency rules. No initial snapshot means the first request can still wait for a rebuild, especially if it races startup warmup. The rebuild still has 23 Mathematics topic queries and legacy fallbacks; this batch moves their cost away from eligible public rendering requests rather than claiming fewer aggregations.

Sources: [snapshot readers and prewarm](backend/services/questions/topicCountSnapshot.js), [API startup](backend/index.js), [public route](backend/routes/questionRoutes.js), [existing write refresh](backend/services/questions/questionMetadataCache.js), [Next fetch](frontend/lib/server/publicCatalog.ts).

### Mission preparation: F9

```text
POST /api/training/sessions -> auth/rate limits
  -> mission lookup when needed
  -> (recent history || learner state)
  -> intelligence/configuration
  -> (question pool || due question documents)
  -> combine candidate IDs -> exposure
  -> selection -> hydration -> existing session transaction
```

Due-question inputs depend on intelligence/configuration, not on completion of the pool read. Exposure still waits for both candidate sets. Non-mission modes keep the due read as an empty local result. Existing selection, stage metrics, hydration, and transactions retain their responsibilities.

Source: [mission create](backend/services/training/application/createTrainingSession.js).

### Dashboard history: F9

```text
GET /api/training/dashboard -> auth
  -> expired-session reconciliation -> dashboard cache
  -> cache miss:
     + active sessions / catalog / mocks / reviews / skills ----------------+
     + learner-state metadata -> choose compact/full completed history ----+ parallel
     -> assemble intelligence/dashboard
```

History starts when metadata resolves, overlapping the remaining dashboard reads. Metadata is read once. Compact history still requires ready durable learner state and the existing feature flag. The expiry reconciliation before cache lookup remains a Batch D concern.

Sources: [repository dependency](backend/repositories/trainingRepository.js), [dashboard composition](backend/services/training/application/getTrainingDashboard.js).

### Topic progress and filtered quiz page: F4/F9

```text
GET /api/progress/topics -> optional auth
  -> (strict shared totals snapshot || owner-scoped durable progress cache)
  -> merge totals and private progress -> response

GET /api/questions/session with includeTotal=true
  -> validate filters / resolve resume anchor when needed
  -> (bounded projected question page || filtered countDocuments)
  -> DTO/page response

includeTotal=false -> page only; normal cursor pages still omit totals
```

Progress remains owner-scoped and generation-checked. Resumed anchor lookup/counting remains ordered because it determines the page offset. No transaction session is shared by these concurrent reads. Combining private progress with totals in one response remains intentional until Batch D's separate payload change.

Sources: [progress route](backend/routes/progress.routes.js), [session reader](backend/services/questions/questionSessionService.js).

### Dynamic mock paper: F9

```text
Mock start -> loaded slot/configuration
  -> section queries 1 || 2 || 3
  -> next batch of <=3 section queries
  -> merge in configuration order -> public paper + private answer key
  -> existing attempt insertion/response
```

Concurrency is capped at three section reads per paper. Each section builds a local answer key, and ordered merging preserves the prior precedence for repeated IDs. Fixed papers follow their existing path. Failed dynamic section reads retain the existing warning/partial-paper behavior.

Source: [paper builder](backend/services/mock/mockPaperService.js).

### Public question loading and resume safety: F17

```text
Cold fresh topic/quiz route:
  + cookie restoration -> private /users/me profile/history --------------+
  + public counts or (metadata || initial question session) -------------+ overlap
     -> explicit public SWR policy
     -> transport auth=none: no bearer/cookies, no 401 session restoration
  -> initial owner becomes ready without remounting/repeating public reads
  -> Start becomes available after auth and question readiness

Cold ?resume=1 quiz:
  + cookie restoration -> /users/me -> saved filters/index/anchor ---------+
  + public metadata ----------------------------------------------------+ overlap
  -> first question session only after saved window initialization
  -> private resume detail remains auth-gated
```

Only counts, metadata, and identity-independent question sessions opt out of the global auth fetch gate. Private queries still wait and caches still reset on account changes/logout. Public responses stay in the existing SWR cache when bootstrap assigns its initial owner, suppressing a second read. Resume initialization gates its question window separately. Start/local-resume actions retain auth readiness so fetching earlier cannot silently skip authenticated answer persistence.

Sources: [SWR gate and ownership](frontend/app/providers.tsx), [explicit public policy](frontend/features/quiz/api/publicQuery.ts), [counts](frontend/hooks/useQuestionCounts.ts), [metadata](frontend/hooks/useQuestionsMeta.ts), [session transport](frontend/hooks/useQuizSession.ts), [resume window gate](frontend/features/quiz/hooks/useQuizFilters.ts), [action readiness](frontend/features/quiz/hooks/useQuizSessionLifecycle.ts).

## Expected impact

Qualitative estimates, not measured production latency:

| Change | User-visible latency benefit | Server-load effect |
|---|---|---|
| Valid stale/precomputed Mathematics catalog | High on eligible cold catalog renders | Moves rebuilds off rendering; reuses persisted/tiered data; startup adds maintenance traffic |
| Fresh public quiz reads overlapping auth | Medium/high on cold routes | Query count stays the same; bootstrap does not repeat the early queries |
| Mission pool/due reads and dynamic mock sections | High when these reads are slow | Same queries, less serial wait; bounded extra instantaneous concurrency |
| Dashboard history and topic progress concurrency | Medium on cache misses | Same queries; metadata remains one read |
| Filtered page/count concurrency | Medium when total counting is slow | Same queries; unfiltered/cursor totals remain suppressed |

This batch primarily shortens dependency chains. Batch A/B address much of the recurring redundant traffic. Mongo remains authoritative, Redis stays optional cache/coordination, and operations within a Mongo transaction remain sequential.

## Validation

- Full frontend suite: **104 files / 487 tests passed**.
- Full backend suite: **118 files / 719 tests passed; 4 files / 16 tests skipped**. Focused backend concurrency/snapshot/training checks passed **4 files / 71 tests**. After the final persisted-subject validation tightening, the snapshot integration file passed **9 tests**, including a complete snapshot stored under the wrong subject key.
- Frontend full lint/typecheck and production Next build passed. Backend full lint/build/typecheck/runtime-boundary checks passed.
- Browser checks: **10 desktop/mobile tests passed**, using Microsoft Edge and the production Next build with local Express/Mongo fixtures (`npx playwright test e2e/remaining-performance.spec.ts`).
- Integration regressions verify public stale responses during a blocked rebuild, strict private reads, startup prewarming/draining, invalid/ancient persisted snapshots, metadata-dependent history projection, mission dependency order, parallel page/count reads, omitted totals, bounded ordered mock sections, and progress overlapping cold shared counts.
- Browser checks hold `/auth/refresh` open and observe metadata/fresh session reads before restoration, then verify one saved resume-window request after restoration. Actual public request headers contain neither the session bearer nor cookies. Existing deep resume, stable answer replay/counters/history, and migrated chat append/reconnect checks remain green.
- `git diff --check` passed. No live database writes, commits, pushes, or deployments were performed.

Browser backend traffic is intercepted and forwarded to loopback fixtures; these checks do not measure production rewrite latency, Atlas plans, multi-instance cold starts, or sustained load. The prewarm schedule and stale-catalog policy still need deployment/production observation before assigning latency or load numbers.
