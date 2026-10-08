# Request-flow Batch D

Implemented locally on 2026-10-08 over checkout `8a65e94d`, preserving the uncommitted Batch A–C changes. Scope follows items 14–20 in the supplied plan. The original [audit](REQUEST_FLOW_AUDIT.md) remains a pre-change baseline.

## Updated flows

### Stable mock queries and cancellation: F10

```text
Mock exam / attempt / result / review
  -> owner + resource + auth-ready dependencies
  -> one read for that mounted resource
  -> transport reads the current access token
  -> 401: shared refresh -> one transport replay
  -> token rotation alone: no new effect read or attempt reset

Navigate A -> B / logout / unmount
  -> abort superseded GET A
  -> ignore A's late response, including adapters that ignore cancellation
  -> load B; render only data matching its owner/resource
```

Mock autosave retains its coalescer and revision through token rotation and sends the latest token. Changing attempts creates a separate saver; an old completion cannot overwrite the new attempt's revision. Dynamic instruction-slot and exam-slot reads cancel on cleanup. Creation POSTs retain the existing stable-key protocol; cancellation does not establish that a mutation failed.

Training capabilities/dashboard use the existing owner/exam SWR keys plus a shared abortable read. One consumer leaving keeps a request alive for others. The final consumer leaving schedules cancellation after a microtask, allowing effect replay and immediate navigation to reacquire the same read. Training session reads and manual reloads cancel on navigation; dispatched offline actions keep their stable key and commit/recovery protocol.

Sources: [mock engine](frontend/app/(app)/mock-test/_shared/MockTestEngine.tsx), [exam](frontend/app/(app)/mock-test/_shared/ExamLandingPage.tsx), [results](frontend/app/(app)/mock-test/_shared/ResultReport.tsx), [review](frontend/app/(app)/mock-test/_shared/ReviewEngine.tsx), [mock transport](frontend/app/(app)/mock-test/_shared/api.ts), [shared ownership](frontend/lib/use-abortable-resource.ts), [training queries](frontend/app/(app)/play/hooks/trainingQueries.ts), [session reads](frontend/components/training/session/hooks/useTrainingSession.ts).

### One profile retry budget: F11

```text
Cookie restoration -> GET /users/me
  -> transport's initial send + at most two network/status retries
  -> existing exponential backoff with jitter / Retry-After
  -> at most one shared 401 refresh and replay
  -> terminal result -> AuthContext updates state once

New login / cleared auth / provider cleanup
  -> cancel obsolete profile reads
  -> reject late results from the previous auth generation
```

AuthContext no longer retries failed bootstrap in three outer rounds or refreshes again after transport's terminal 401. Persistent retryable profile failures have at most three profile sends instead of the audit's twelve; this bound excludes cookie exchange and a possible 401 replay. Provider cleanup cancels in-flight profile work. Account changes additionally fence late profile responses so an old bootstrap cannot replace a newly logged-in owner. Existing shared refresh coordination and mutation retry rules remain in the transport.

Sources: [AuthContext](frontend/context/AuthContext.tsx), [transport](frontend/lib/axios.ts), [retry policy](frontend/shared/api/policy.ts).

### Deferred solution translation and smaller lookahead: F13

```text
Choose Hindi / Bengali -> translate current question/options if missing
  -> prefetch at most one future question/options batch
  -> shared per-text cache and pending promises reuse identical work

Submit answer -> no automatic solution translation
Open solution after submission -> translate missing current solution
  -> reopening uses shared translation cache
```

Native translations, coding/numeric token protection, and English behavior remain supported. The first untranslated solution can take a provider round trip after opening; this deliberately trades speculative AI work for demand-driven work. Effect cleanup stops further lookahead and ignores obsolete UI results. An already dispatched shared translation batch remains active for its other consumers and can still consume provider quota.

Sources: [translation hook](frontend/hooks/useTranslatedQuestion.ts), [quiz integration](frontend/features/quiz/hooks/useQuizController.tsx), [shared translation](frontend/hooks/useTranslation.ts).

### Guarded route intent: F14

```text
Topic pointer-enter / focus / touch-start -> prefetchOnce(href)
  -> first intent: router.prefetch, full route prefetch
  -> repeated intents: guard hit
  -> Next onInvalidate or 60-second guard expiry: allow another prefetch
```

Both mobile card variants share a bounded 256-target guard. Coming-soon cards keep their existing gate. Default Link prefetch policies elsewhere remain unchanged. This reduces redundant router invocations; actual HTTP savings depend on Next's own cache/deduplication and whether the route executes server work.

Sources: [intent guard](frontend/lib/intent-prefetch.ts), [card](frontend/components/subject-hub/MobileTopicCard.tsx), [row](frontend/components/subject-hub/MobileTopicRow.tsx).

### Public catalog and private progress separated: F4

```text
Open Mathematics
  -> Next server -> direct Express /api/questions/topic-counts
     -> existing public snapshot cache -> public totals/revision
  -> CatalogSeed -> client public SWR data; no immediate duplicate public read
  -> auth-ready client -> Next rewrite -> Express /api/progress/topics/private
     -> protect -> durable progress cache -> userTopicProgress on miss
     -> private progress only, no shared catalog lookup or totals transfer

Missing server seed / guest / blocked auth restoration
  -> explicitly public /api/questions/topic-counts read, auth policy=none
  -> private progress waits for an owner and auth readiness
```

The combined `/api/progress/topics` endpoint remains for compatibility. The new protected endpoint validates the supported subject and returns `Cache-Control: private, no-store`. Existing progress documents are owner/topic scoped; the response retains that owner topic map, and the subject hub displays only its catalog topics. No progress schema migration is introduced.

Private progress uses owner/subject SWR memory keys and never enters subject-only storage. Public `v4` storage whitelists totals/revision/timestamp; reading old `v3` migrates only public fields and deletes the combined entry. Switching accounts or logging out immediately drops displayed private progress. These changes apply to all four subject hubs using the shared hook. Public freshness still depends on the existing Next/source-cache policy; the seed does not prove a production end-to-end staleness bound.

Sources: [private endpoint](backend/routes/progress.routes.js), [catalog seed](frontend/components/subject-hub/CatalogSeed.tsx), [split hook](frontend/hooks/useTopicQuestionTotals.ts), [durable cache](backend/infrastructure/durableProgressCache.js).

### Dashboard expiry reconciliation on cache misses: F12

```text
GET training dashboard -> auth -> Mongo durable generation checks
  -> warm revisioned cache: return dashboard, skip expired-session scan
  -> miss / source revision changed / five-second freshness expiry / active deadline
     -> Mongo expiredActiveSessions
     -> sequential finish transitions and atomic learning commits
     -> dashboard source reads -> cache with earliest active deadline as upper bound
```

Reconciliation moves inside the strict cache builder. Redis loss still falls back to the bounded local cache and Mongo source; a subsequent cache miss performs recovery without an expiry worker. The five-second backend cache never outlives the earliest visible active deadline. The frontend's existing 15-second dashboard reuse also stops at that deadline. Expiry reconciliation can advance the durable revision, causing an additional guarded rebuild; that preserves source consistency.

This is bounded request-driven recovery, not a new worker or automatic live refresh on an idle page. During a rolling deployment, an older process can publish the previous five-second cache format; a shared entry from that version can survive until its existing TTL. Mongo authorization/revision validation and transaction sequencing remain intact.

Sources: [dashboard application](backend/services/training/application/getTrainingDashboard.js), [deadline policy](backend/services/training/dashboardCache.js), [optional cache deadline](backend/infrastructure/durableProgressCache.js), [frontend reuse](frontend/app/(app)/play/hooks/trainingQueries.ts).

## Impact and verification boundaries

Avoidable load reduction is largest during failed auth recovery, repeated dashboard reads, and translated quizzes where solutions or future questions are unused. Mathematics removes duplicate shared totals transfer/lookup on the private request. Mock query stability prevents avoidable effect reloads and protects unsaved local answers during token rotation. Browser abort does not prove that Express or Mongo stopped work after dispatch. No production latency or load numbers are claimed.

Estimated impact of this batch, ordered by avoidable server work. H/M/L are qualitative and conditional; browser timings and production frequencies have not been measured.

| Change | User-visible latency benefit | Server-load benefit | Condition |
|---|---|---|---|
| Single auth retry owner | H | H | Persistent retryable profile failures |
| Demand-driven translation | L; first solution may wait longer | M–H | Missing Hindi/Bengali translations |
| Expiry scan on dashboard miss | L–M | M | Repeated warm dashboard reads |
| Stable mock query dependencies | M; preserves local answer state | M | Token refresh while a mock screen is mounted |
| Private progress response | L–M | M | Subject visits with server catalog seed |
| Cancel obsolete reads | L–M | L–M | Rapid navigation/account changes; backend work may already have started |
| Guarded intent prefetch | L | L | Repeated intent events; Next may already deduplicate traffic |

## Validation

- Full frontend suite: **106 files / 502 tests passed** after the final account/navigation/save-revision refinements.
- Full backend suite: **119 files / 722 tests passed; 4 files / 16 tests skipped**. The new backend integration file passed **3 tests** against disposable local MongoDB.
- Focused frontend checks passed **8 files / 44 tests** before the additional late-autosave regression was added and included in the full suite.
- Full frontend lint, TypeScript checks, and the production Next build passed. Backend full lint, build/typecheck, and runtime-boundary checks passed.
- Browser regressions: **16 desktop/mobile tests passed** using Microsoft Edge and the production Next build (`npx playwright test e2e/remaining-performance.spec.ts`). They cover the three new Batch D flows plus existing public/auth overlap, deep resume, stable answer replay, and chat reconnect cases.
- New browser evidence confirms separate private Mathematics traffic, no combined progress request, and at most one browser catalog read; SSR-seed reuse without an immediate public GET is separately covered by the hook test. A controlled mock-history 401 produces exactly two history sends and one recovery refresh, with no third effect read after token rotation. Translation responses are stubbed; the browser observes request timing and batches, rather than live provider behavior.
- After adding an explicit assertion that submitting alone does not translate the solution, the solution-opening cases passed again on both desktop and mobile (**2 focused browser tests**). The changed browser file also passed zero-warning lint.
- `git diff --check` passed. The React checklist review covered stable resource dependencies, ownership/cleanup, request sharing, account isolation, and preserved mutation/transaction ordering.

An initial concurrent validation run exhausted local memory; interrupted runs are not counted as passes. Completed full suites were rerun sequentially.

Backend integration checks use disposable local MongoDB; the route isolation test substitutes middleware identity, while browser fixture requests pass the real protected route. The cache tests exercise actual deadline and TTL expiry without an expiry worker. Browser backend traffic is forwarded to loopback fixtures; these results do not measure production proxy latency, Atlas plans, Redis failover, multi-instance expiry behavior, or live AI-provider quotas.

No live database writes, application commits, pushes, or deployments were performed.
