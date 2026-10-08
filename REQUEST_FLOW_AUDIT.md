# Request-flow audit

Reviewed 2026-10-08, checkout `8a65e94d`. This is a source trace with focused local regression checks, not an authenticated browser waterfall or production latency measurement. Rankings estimate impact from blocking dependencies, request frequency, payload size, and database operations. Cache warmth, Redis availability, feature flags, history migration, and navigation type change the actual counts.

Batch A, Batch B, Batch C, and Batch D have since been implemented locally; see [Batch A implementation and updated flows](REQUEST_FLOW_BATCH_A.md), [Batch B implementation and updated flows](REQUEST_FLOW_BATCH_B.md), [Batch C implementation and updated flows](REQUEST_FLOW_BATCH_C.md), and [Batch D implementation and updated flows](REQUEST_FLOW_BATCH_D.md). Findings below retain the pre-change audit baseline.

## Transport and counting rules

`P` below means `browser -> Next.js /backend-api rewrite -> Express`. This is the default when `NEXT_PUBLIC_API_URL` is unset. A configured absolute API base can bypass the rewrite. Next's page proxy only checks the presence of `access_session`; it performs no Mongo/Redis session lookup and excludes API traffic. Server catalog fetching uses `API_URL` directly, bypassing the rewrite.

In production, Express normally runs a global Redis rate-limit increment before route handlers. `/auth` additionally has the auth limiter; training additionally has the training limiter. `TRAINING_LOCAL_INGRESS=true` bypasses the distributed global limiter for training. Local development skips these limits. The current Redis limiter falls back to bounded local counters, not Mongo queries.

Protected requests run JWT verification and `assertSession`. Its local cache does **not** avoid Mongo validation: a normal local cache hit reads `authSessions` and `users` concurrently first. A local miss reads that pair twice, with Redis between the pairs. Concurrent requests for the same session on one process share in-flight authorization work. Therefore do not multiply these costs mechanically across simultaneous requests.

Public question counts, metadata, and session pages have no `protect` middleware. Their frontend hooks wait for auth bootstrap under `ApplicationProviders`, even though the backend reads are public.

Sources: [API base](frontend/lib/api-base.ts:1), [rewrite](frontend/next.config.ts:84), [page proxy](frontend/proxy.ts:16), [Express mounts](backend/app.js:140), [rate limits](backend/middleware/rateLimiter.js:153), [limiter fallback](backend/middleware/redisRateLimitStore.js:45), [session validation](backend/auth/sessions.js:140), [SWR auth gate](frontend/app/providers.tsx:19).

## All requested actions

Counts are logical API requests without retries, browser documents/RSC, static assets, or optional background translation. Warm cache reuse can suppress SWR reads.

| Action | Frontend -> Next -> Express -> Mongo/Redis | Normal request shape | Relevant findings |
|---|---|---|---|
| Login, email/password | Login form -> P `/auth/login` -> Passport user lookup/bcrypt -> active-user recheck/session insert; then AuthContext -> P `/users/me` -> auth validation/profile/history | Two sequential requests; a cold visit also attempts cookie restoration | F1, F10, F11 |
| Open dashboard | `/dashboard` -> `ProtectedRoute` -> AuthContext data | Zero new dashboard API calls on warm navigation; cold reload restores cookie then loads `/users/me` | F1, F10 |
| Open mathematics | Next server -> direct `/api/questions/topic-counts?subject=mathematics`; client -> P `/api/progress/topics?subject=mathematics`; desktop also -> P `/api/questions/counts` for selected topic | One server catalog read when Next cache needs it; one client progress read; optional desktop counts read | F4, F5 |
| Open topic | Topic shell -> `TopicPracticeModes` -> P `/api/questions/counts?topic=...&subject=mathematics` -> tiered count cache/questions aggregation | One public counts query on cache miss | F5, F14, F17 |
| Start quiz | Quiz route mounts -> P `/api/questions/meta` and `/api/questions/session?limit=100&includeTotal=false`; Start button changes local phase | Two parallel public reads before Start; filtered/resumed cases differ | F3, F9, F13, F17 |
| Submit answer | Answer lifecycle -> P PATCH `/users/me/progress` plus POST `/api/questions/:id/answer`; sync effect -> PATCH `/users/me/recent-quizzes` after 600 ms | Two immediate parallel writes plus a coalesced delayed save | F1, F2 |
| Next question | Local navigation through loaded page; next-page/window read when needed; delayed recent-quiz save | Usually zero question reads; one cursor/window read at boundaries | F2, F9, F13 |
| Open solution | Local solution panel consumes solution already in session DTO; solution image can load from its asset host | Zero solution API calls | F13 for earlier translation of unused solutions |
| Open AI tutor | Quiz tutor panel opens locally; sending Gemini uses P `/auth/firebase/token` -> Firebase Auth exchange -> Firebase AI; other model uses P `/api/ai/tutor-chat` | Opening panel: zero API calls. Sending: model-dependent | F6, F11; separate `/ai-chat` history in F7 |
| Start training | `/play` -> capabilities/dashboard; setup repeats both; POST `/api/training/sessions` -> Mongo selection/session insert; new route GETs that session | Six requests from hub through first question: 2 + 2 + 1 + 1 | F1, F8, F9, F12 |
| Finish training | POST `/api/training/sessions/:id/actions?response=delta`, `type=finish`, stable idempotency key -> transaction/learner state -> terminal snapshot | One action request; results render from its response | F12 |
| Load progress | P `/api/progress/topics` -> optional auth -> shared topic snapshot -> durable progress cache -> `userTopicProgress` on miss | One request; warm cache still checks Mongo generations | F1, F4 |
| Open mock test | `/mock-test` is local catalog; exam page -> P slots and history; instructions optionally reads dynamic slot; Start -> POST start then GET attempt on next screen | Catalog root: zero API calls; exam: two reads; start: two sequential requests | F10, F15, F16 |

Google login additionally follows OAuth redirects and then the cookie-restoration path. The callback consumes AuthContext; it has no separate profile fetch.

## Ranking

H = high, M = medium, L = low. Latency refers to avoidable delay; load refers to avoidable server work. These are qualitative estimates, not measured milliseconds.

| ID | Problem | Latency | Server load | Frequency / condition |
|---|---|---|---|---|
| F1 | Mongo authorization checks before the session cache | H across flows | H, broadest scope | Every distinct protected authorization burst |
| F2 | Three persistence paths per quiz answer; expensive history save | L immediately, M on contention | H | Every answered question; navigation also saves |
| F3 | Cached metadata still upserts/reads concept-group Mongo records | M | H | Every metadata request; every 10 s while processing |
| F8 | Training hub/setup repeat capabilities and dashboard | H | H | Every normal hub -> setup journey |
| F9 | Independent backend reads are sequential | H | M | Mission create, filtered quiz page, cold dashboard/progress |
| F15 | Mock start re-reads slot and re-transfers full paper | H | M-H | Each new mock start |
| F5 | Mathematics snapshot rebuild blocks server rendering | H when cold | H when cold | Missing/stale persisted snapshot and cold count caches |
| F6 | Firebase custom sign-in repeats before every Gemini message | H | M | Every Gemini message |
| F7 | AI history summaries/details hydrate all conversations/messages | M-H | H for chat users | `/ai-chat` opening, selected-chat loading, appending |
| F4 | SSR catalog/CSR totals overlap; progress requests serialize shared/private data | M | M | Subject visits and progress revalidation |
| F10 | Effects refetch on token rotation; cleanup leaves requests running | M | M-H | Mock screens, rapid exam changes, dev effect replay |
| F11 | Nested auth retries and AI fallback attempts | H on failures | H during failures | Network/5xx/401; not normal successful requests |
| F12 | Training create response discarded; warm dashboard still queries expiry | M | M | Each training start/dashboard visit |
| F13 | Translate current solution plus up to three future questions | L foreground, M on quota contention | M-H | Hindi/Bengali, missing stored translations |
| F16 | Mock slot catalog reads full fixed papers and seeds during GET | M-H, cold | M-H | Catalog reads; empty catalog is worst case |
| F14 | Speculative RSC prefetch and duplicate event triggers | L, can help navigation | L-M | Hover/focus/touch; production route prefetch |
| F17 | Public topic/quiz metadata waits for private auth restoration | M-H when cold | L | Cold topic/quiz navigation |

Suggested latency order: F8/F9/F12 training startup, F15 mock startup, F5 cold mathematics, F6 Gemini authentication, then F4/F10. Suggested steady-load order: F1, F2, F3, F7, F8. F11 becomes urgent during outages.

## F1 â€” Repeated Mongo authorization despite session caching

```text
Any protected action -> P endpoint
  -> JWT verify
  -> same-session in-flight deduplication, per Express process
  -> Mongo authSessions.findOne || users.findOne
  -> local sessionCache check
     HIT  -> endpoint's own reads/writes
     MISS -> Redis GET revisioned auth payload
          -> Mongo authSessions.findOne || users.findOne again
          -> local/Redis cache population -> endpoint work
```

The local hit costs two Mongo reads; a stable miss costs four, excluding endpoint work and rate limits. The generation retry loop can repeat when account/session state changes. `/users/me` also reads the profile separately; capabilities returns static configuration after paying protected-route validation.

This is an explicit revocation/privilege correctness contract, not an accidental missing cache check. The six local race tests confirm why the guards exist. First eliminate redundant frontend calls. A cheaper auth design must preserve cross-instance logout, suspension, and role changes; simply moving the cache check ahead of Mongo weakens the existing contract.

Evidence: [authorization state](backend/auth/sessions.js:54), [readAuthorization](backend/auth/sessions.js:146), [protect](backend/middleware/protect.js:4), [profile read](backend/controllers/userController.js:61).

## F2 â€” Quiz answers fan out into multiple persistence paths

```text
Submit -> immediate local grading/UI
       -> P PATCH /users/me/progress ----------------> Mongo users counter update
       -> P POST /api/questions/:id/answer ----------> resolve question
            -> transaction: question-progress read/write
            -> conditional topic-progress + durable revision write -> Redis publish
       -> 600 ms sync debounce
            -> P PATCH /users/me/recent-quizzes -----> history owner read
                 -> embedded read/CAS write, OR migrated history transaction

Select option / Next / start -> same delayed recent-quiz save
```

These endpoints are different, but represent one answer action with overlapping persistence responsibilities. The first two run concurrently and UI grading does not await them. The history saver already coalesces equal snapshots, so pagehide/visibility/unmount callbacks do not automatically mean three identical HTTP saves.

The migrated history path still reads the user's bounded history and writes the changed entry, deletes excluded entries, and updates a user revision. Client deltas reduce transport size, not all database work. Embedded history performs an owner lookup, history read, and CAS write; conflicts can repeat up to eight times.

The quiz POST sends `submissionId` in the body but no `Idempotency-Key`; `processUserAnswer` accepts but does not use that ID. The two writes therefore do not have one atomic/idempotent outcome. A single answer command could update the existing concept counters, question/topic progress, and needed resume delta while preserving their distinct meanings. Then save navigation position separately at a coarser interval.

Evidence: [answer writes](frontend/features/quiz/hooks/useQuizAnswerLifecycle.ts:31), [600 ms save](frontend/features/quiz/hooks/useQuizSync.ts:61), [coalescing](frontend/lib/coalesced-save.ts:2), [history mutation](backend/repositories/userRepository.js:29), [separated history](backend/repositories/userHistoryRepository.js:30), [unused submission ID](backend/services/questionService.js:13), [optional idempotency](backend/middleware/idempotency.js:13).

## F3 â€” Metadata cache hits still touch Mongo twice for grouping

```text
Quiz mount -> P GET /api/questions/meta
  -> L1 / Redis / persisted metadata cache
  -> ensureConceptGroups, even when metadata is cached
     -> Mongo conceptGroupMetadata.updateOne($setOnInsert, upsert)
     -> Mongo conceptGroupMetadata.findOne
  -> response
  -> if groupingStatus=processing: repeat GET every 10 s
```

The upsert runs even for already completed grouping records. Polling repeats the metadata endpoint and its grouping work, rather than fetching only status. Cache completed grouping by fingerprint, and use a narrower status endpoint while pending. Preserve queued-job deduplication; a repeated upsert here does not imply repeated AI generation.

Evidence: [metadata composition](backend/services/questions/questionMetadataService.js:106), [grouping](backend/services/questions/conceptGroupService.js:43), [upsert/read](backend/repositories/conceptGroupRepository.js:4), [polling](frontend/hooks/useQuestionsMeta.ts:51).

## F4 â€” Mathematics fetches shared totals on both server and client

```text
Open /mathematics
  -> Next server awaits direct GET /api/questions/topic-counts?subject=mathematics
     -> shared snapshot L1 / Redis / persisted Mongo -> totals
  -> CatalogSeed supplies totals as SWR fallback
  -> client revalidateOnMount=true
     -> P GET /api/progress/topics?subject=mathematics
        -> optionalAuth/F1
        -> await same shared snapshot
        -> await durable progress cache:
           Mongo counter -> L1/Redis -> Mongo counter
           on miss: userTopicProgress.find(...).toArray()
        -> returns totals again + private progress
  -> focus/reconnect can repeat progress request
```

The endpoints differ, and shared caches generally prevent rebuilding totals twice. This is duplicated payload/lookup work, not proof of duplicate aggregation. The client request is needed because server fallback intentionally excludes private progress. A private-progress-only response can reuse the public catalog revision, and snapshot/progress reads can run concurrently. Even a fully warm progress cache performs two Mongo generation reads plus optional auth validation. Those generation checks enforce a source-consistency contract; do not remove them casually.

`useTopicQuestionTotals` also puts the combined snapshot, including userProgress, in a module Map and localStorage keyed only by subject. Account-scoped SWR resets do not clear that fallback; it can show an earlier account's progress until revalidation. It is not a safe reason to suppress the private request.

Evidence: [server page](frontend/app/(app)/mathematics/page.tsx:5), [public fetch](frontend/lib/server/publicCatalog.ts:8), [seed](frontend/components/subject-hub/CatalogSeed.tsx:7), [client revalidation/storage](frontend/hooks/useTopicQuestionTotals.ts:43), [sequential route](backend/routes/progress.routes.js:9), [generation reads](backend/infrastructure/durableProgressCache.js:14).

## F5 â€” Cold mathematics counts block initial rendering

```text
Next /mathematics render -> await public topic snapshot
  -> no valid L1/Redis snapshot
  -> Mongo persisted snapshot lookup is missing/stale
  -> Redis batch-prime individual topic count caches
  -> 23 mathematics topics, in six sequential batches of <=4
     -> one questions aggregation per cold topic
     -> legacy direct lookup returning zero can trigger another aggregation
  -> Mongo save snapshot -> Redis cache -> HTML/RSC
```

With all count caches cold this means 23 aggregations, potentially up to 46 on legacy zero-result fallbacks, excluding snapshot/revision/cache operations. These are different topic queries, not identical requests. Warm persisted snapshots avoid this rebuild. The Next fetch has a three-second timeout and falls back to no seed; that limits rendering wait but does not establish cancellation of Express's ongoing database work.

Precompute snapshots after question-bank changes, or serve a validated stale public snapshot while rebuilding. Keep bounded concurrency instead of issuing 23 unrestricted database operations. Desktop mathematics separately loads mode counts for its selected topic; mobile explicitly disables that query. If the selected topic's counts were already primed, this is another request/cache lookup, not another required aggregation.

Evidence: [snapshot builder](backend/services/questions/topicCountSnapshot.js:62), [count aggregation/fallback](backend/services/questions/questionMetadataService.js:40), [desktop gate](frontend/components/subject-hub/useSubjectHubView.tsx:148), [render wait](frontend/lib/server/publicCatalog.ts:8).

## F6 â€” Every Gemini message repeats custom authentication

```text
Open quiz AI panel -> local UI only
Send message -> ensureFirebaseTutorAuth
  -> P POST /auth/firebase/token -> F1 + auth/global Redis limiters -> mint token
  -> Firebase signInWithCustomToken, including returning Firebase users
  -> obtain Firebase ID token; SDK may already cache it
  -> Firebase AI generateContent -> reply
Next message -> repeat custom-token POST and sign-in
```

In-flight auth is shared, but completed auth is not reused for later messages. Two authentication stages serialize before generation. App Check/SDK initialization can add first-use cost. Reusing Firebase credentials requires a deliberate, bounded Meow session-validation strategy; the current code explicitly validates each message.

For the other tutor model, the browser uses P `/api/ai/tutor-chat`: F1 -> Redis generation limit -> Mongo AI lease -> daily usage reservation -> provider; lease release follows response completion. Opening the quiz panel itself does not start inference or load chat history.

Evidence: [per-message sign-in](frontend/lib/firebase/auth.ts:43), [generation order](frontend/components/QuizChatbot/gemini.ts:50), [token route](backend/routes/firebaseAuth.routes.js:7), [model routing](frontend/features/tutor/api/tutorGateway.ts:9), [send handler](frontend/components/QuizChatbot/index.tsx:329), [AI admission](backend/middleware/aiAdmission.js:4).

## F7 â€” Standalone AI-chat summaries/details overfetch histories

```text
Open /ai-chat -> P GET /users/me/ai-chats -> F1
  -> users.findOne(history fields)
  -> migrated: aiConversations list, up to 30
  -> aiMessages for ALL listed conversations, up to 2,400
  -> discard messages; return summaries
Select one conversation -> P GET /users/me/ai-chats/:id -> same broad history read
  -> discard all other conversations; return one
Append messages -> P POST .../:id/messages
  -> read histories/messages for all conversations
  -> replace changed conversation metadata
  -> delete/reinsert its retained messages, despite client sending a delta
```

Legacy storage reads the embedded history instead. Migrated storage has a `summaries` option but `getUser` does not use it for the list route. Query stored summary metadata directly for the list, scope detail reads to one conversation, and append only the new message rows with the existing sequence contract. This finding is for the full `/ai-chat` page, not the quiz tutor panel.

Evidence: [frontend history](frontend/app/(app)/ai-chat/useAiChatHistory.ts:77), [summary/detail controllers](backend/controllers/userController.js:213), [getUser](backend/repositories/userRepository.js:9), [all-message read](backend/repositories/userHistoryRepository.js:8), [message replacement](backend/repositories/userHistoryRepository.js:18).

## F8 â€” Training setup refetches the hub's endpoints

```text
Open /play
  -> P GET /api/training/capabilities -----------------------+
  -> P GET /api/training/dashboard?exam=E ------------------+| concurrent
Navigate /play/setup/M?exam=E                               ||
  -> new hook instances, component-local state             ||
  -> SAME capabilities GET --------------------------------+|
  -> SAME dashboard GET ------------------------------------+
  -> Begin training remains disabled until BOTH settle
```

There is no shared frontend cache for these hooks. Backend dashboard TTL is only five seconds and still queries expired sessions before cache lookup; each repeat pays auth/rate limits. Capabilities contains static policy/exam configuration. Reuse owner/exam-keyed SWR dashboard data, cache capabilities once per appropriate scope, and load a smaller setup catalog instead of the full learner dashboard where possible.

Evidence: [hub hook mounts](frontend/app/(app)/play/PlayClient.tsx:118), [setup hooks](frontend/app/(app)/play/setup/[mode]/page.tsx:110), [disabled form](frontend/app/(app)/play/setup/[mode]/page.tsx:198), [capabilities hook](frontend/app/(app)/play/hooks/useTrainingCapabilities.ts:20), [dashboard hook](frontend/app/(app)/play/hooks/useTrainingDashboard.ts:22), [five-second cache](backend/services/training/dashboardCache.js:4).

## F9 â€” Independent reads are unnecessarily sequential

```text
Mission create:
  (history || learner state) -> question pool -> due questions -> exposure -> selection
  opportunity: (question pool || due questions), then exposure

Training dashboard cache miss:
  expired-session reconciliation -> (active || catalog || mocks || reviews || skills || meta)
  -> completed history
  opportunity: completed history alongside dashboard reads when projection is known

Progress:
  auth -> shared snapshot -> private progress
  opportunity: shared snapshot || private progress after auth

Filtered quiz session:
  question page -> countDocuments(total)
  opportunity: page || total, within query concurrency budget

Dynamic mock paper:
  section 1 query -> section 2 query -> ...
  opportunity: bounded parallel section reads
```

Mission pool and due-question inputs are already available from intelligence/config. Exposure needs their combined IDs and must wait. Dashboard compact-history selection depends on stateMeta; resolve that dependency once rather than guessing or duplicating its lookup. Initial unfiltered quiz pages already set `includeTotal=false`, and cursor pages never repeat totals.

Do **not** parallelize operations on a single Mongo transaction session. Finish-training learner reads/writes are deliberately sequential for that reason. HTTP requests cannot be parallelized when a later request needs the prior response's session/attempt ID.

Evidence: [mission create](backend/services/training/application/createTrainingSession.js:69), [dashboard order](backend/services/training/application/getTrainingDashboard.js:25), [dashboard parallel group](backend/repositories/trainingRepository.js:137), [progress](backend/routes/progress.routes.js:13), [filtered count](backend/services/questions/questionSessionService.js:115), [dynamic paper](backend/services/mock/mockPaperService.js:228).

## F10 â€” Effects refetch on token rotation and leave stale calls running

```text
Mock exam history effect [examSlug, token] -> GET history
Access-token refresh -> token string changes -> SAME history GET again

Mock attempt effect -> loadData [token, getSaver, ...] -> GET attempt / POST keyed start
Token refresh -> loadData identity changes -> reload unchanged attempt

Rapid training exam change A -> B
  -> GET dashboard A starts
  -> cleanup sets live=false; no AbortController
  -> GET dashboard B starts; A still runs on Express/Mongo

Development StrictMode replay:
  effect -> request -> cleanup only sets boolean -> effect -> another request
```

Training dashboard/capabilities depend on a stable readiness boolean, so a token-string change alone does not refetch them. Mock history and attempt loading do depend on the token string. A 401-triggered token rotation can therefore combine transport replay with effect refetch. The exact interleaving needs a browser trace; no universal duplicate count is claimed.

Use authenticated owner/resource query keys, shared request deduplication, and cancellation for superseded reads. Cancellation after dispatch does not guarantee server work stops; earlier gating/deduplication is preferable. Development StrictMode is not proof of production duplication. `PlayLayout` waits for restoration on setup/session pages, so those pages do not inherently fetch once before auth and again after auth.

Evidence: [mock history token dependency](frontend/app/(app)/mock-test/_shared/ExamLandingPage.tsx:120), [attempt loader dependencies](frontend/app/(app)/mock-test/_shared/MockTestEngine.tsx:91), [uncancelled training effects](frontend/app/(app)/play/hooks/useTrainingDashboard.ts:22), [Play auth gate](frontend/app/(app)/play/layout.tsx:24), [token event](frontend/lib/axios.ts:25).

## F11 â€” Retry amplification exists at auth/provider boundaries

```text
Cold bootstrap -> GET /users/me
  -> transport: initial + 2 retries for network/selected HTTP errors
  -> still failed -> AuthContext waits 1.5 / 3 / 4.5 s and re-runs bootstrap
  -> up to 4 outer rounds x 3 transport sends = 12 /users/me sends

GET /users/me -> 401 -> axios refresh -> replay
  -> terminal 401 -> AuthContext's own refresh + another fetchUser

Gemini generation temporary failure
  -> primary attempt -> ~1 s delay -> same primary attempt
  -> ~2 s delay -> fallback model attempt
```

The 12-send bound is for persistent retryable profile failures, excluding auth-refresh traffic, effect replay, and token-expiry interleavings. Auth refresh itself has a single in-flight promise; concurrent 401s do not each create their own simultaneous refresh request. Default safe-read retry count is two. Mutation retries require a valid idempotency header; quiz progress/history writes and normal tutor POSTs are not automatically network-retried.

SWR automatic error retries are disabled globally. `useTopicQuestionTotals.errorRetryCount=2` does not by itself re-enable `shouldRetryOnError`. Axios is the browser transport here, not an Axios retry loop wrapped in another fetch retry loop. Gemini's explicitly coded fallback is separate. Consolidate auth recovery budgets and keep controlled provider fallbacks with observable attempt counts.

Evidence: [bootstrap outer retries](frontend/context/AuthContext.tsx:216), [transport retries/refresh](frontend/lib/axios.ts:90), [default retry policy](frontend/shared/api/policy.ts:12), [single refresh](frontend/lib/axios.ts:45), [SWR policy](frontend/app/providers.tsx:38), [Gemini attempts](frontend/components/QuizChatbot/gemini.ts:82).

## F12 â€” Training create re-transfers the session; finish has necessary transaction work

```text
Begin training -> P POST /api/training/sessions
  -> auth/rate limits -> selection/hydration
  -> Mongo transaction: session insert + dashboard revision -> Redis publish
  -> returns FULL publicSession
  -> frontend keeps only data.id -> router.push
  -> P GET /api/training/sessions/:id
     -> auth/rate limits -> findOwnedSession -> FULL publicSession again

Finish -> P POST /sessions/:id/actions?response=delta, key=K
  -> auth/rate limits -> idempotency insert
  -> owned-session read -> transition/score
  -> Mongo transaction: session update + revision + learner-state reads/bulk writes/meta
  -> Redis publish -> idempotency response persistence -> terminal snapshot -> results UI

Later dashboard -> expiredActiveSessions Mongo read BEFORE even a warm cache lookup
```

Hydrate the new route from an owner/session-scoped create response, or return only an ID from create if a subsequent read is deliberately required. The finish flow normally has **one** HTTP request; no extra results fetch or automatic AI diagnosis occurs. Its terminal snapshot deliberately reveals solutions once. Idempotency replay prevents re-running completion work but still pays request validation/record lookup. Extra metadata count happens only when learner-state meta is missing.

Expired-session reconciliation on every dashboard call protects timeout correctness but can make a cached dashboard unexpectedly expensive. Review whether a durable expiry worker plus a bounded freshness contract can move it off the request path. Keep scoring/learning commit atomic; transaction operations are not concurrency candidates.

Evidence: [discarded create response](frontend/app/(app)/play/setup/[mode]/page.tsx:169), [session GET](frontend/components/training/session/hooks/useTrainingSession.ts:53), [create response](backend/controllers/trainingController.js:67), [completion transaction](backend/repositories/trainingRepository.js:261), [finish request](frontend/components/training/session/hooks/useTrainingActions.ts:51), [expiry before cache](backend/services/training/application/getTrainingDashboard.js:25).

## F13 â€” Translation prefetch includes solutions and unused future questions

```text
Quiz mount/Next with Hindi/Bengali and missing stored translations
  -> translate current question + options + solution
     -> browser /api/translate -> Next route handler -> direct Express /api/ai/translate
     -> auth + Redis limits + Mongo AI lease -> translator provider
  -> sequentially translate up to 3 upcoming question/options/solution batches
  -> student may never visit them or open any solution
```

The lookahead is purposeful for faster Next, but can produce four translation batches for one position when texts are uncached. English/native translations avoid it; shared per-text pending promises/cache deduplicate identical translation work. Effect cleanup stops further lookahead but does not abort an already-started translation.

Defer solution translation until needed; batch/pause or reduce future-question lookahead under quotas. The Next translation/TTS/diagram handlers only forward transport. Moving clients to the existing `/backend-api/api/ai/...` rewrite removes the explicit route-handler invocation, while retaining one same-origin proxy hop. It does not eliminate all networking. Direct cross-origin calls are a separate cookie/CORS/deployment decision.

Ordinary Next does not fetch a question. Session pages fetch 100 rows, prefetch the next cursor around five remaining rows, and preload the next image. Two effects trigger `fetchMore`, but its synchronous ref guard/SWR cache deduplicate concurrent calls. Resume anchor/window fetches are purposeful; jumping into an unloaded window incurs a real read.

Evidence: [translation current/lookahead](frontend/hooks/useTranslatedQuestion.ts:89), [pending text cache](frontend/hooks/useTranslation.ts:31), [Next handler](frontend/app/api/translate/route.ts:4), [forwarder](frontend/lib/server/backend-proxy.ts:4), [dual pagination effects](frontend/features/quiz/hooks/useQuizController.tsx:87), [other trigger](frontend/features/quiz/hooks/useQuizSessionLifecycle.ts:65), [guard](frontend/hooks/useQuizSession.ts:101).

## F14 â€” Prefetch causes RSC traffic, not client-effect API calls

```text
Mathematics mobile topic pointer-enter / focus / touch-start
  -> router.prefetch(topic href), despite Link prefetch=false
  -> speculative Next RSC/route request
  -> no mounted TopicPracticeModes effect, so no counts API just from prefetch

Visible default/true Link to a server-fetching subject route, in production
  -> Next route prefetch, subject to router/static/loading cache behavior
  -> if server page/catalog executes and Next data cache misses:
     direct Express public catalog request -> cache/Mongo
```

Multiple event handlers can invoke prefetch for the same target; Next's router can reuse/deduplicate it, so this is not proof of three network requests. Mathematics mode links and BottomNav disable automatic prefetch. Mock root explicitly uses `prefetch=true` for exam routes; those prefetched routes contain client catalog components, whose effects wait for mounting. Prefetch does not create mock attempts or start training.

Keep intent prefetch with one guarded target, and selectively disable speculative server catalog execution if production traces show meaningful unused traffic. Hover/focus speculation can also improve latency; its load ranking is lower than actual API duplication.

Evidence: [mobile card](frontend/components/subject-hub/MobileTopicCard.tsx:109), [mobile row](frontend/components/subject-hub/MobileTopicRow.tsx:27), [math mode policy](frontend/features/quiz/components/TopicPracticeModes.client.tsx:88), [mock root](frontend/app/(app)/mock-test/page.tsx:368), [installed Next prefetch docs](node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md:294).

## F15 â€” Mock start duplicates slot reads and paper transfer

```text
Instructions Start -> P POST /api/mocktest/E/T/start
  -> auth -> fetchSlotById -> Mongo mockSlots.findOne, full slot
  -> buildPaper -> SAME fetchSlotById -> SAME Mongo full-slot read
  -> fixed paper processing OR sequential dynamic section queries
  -> insert mockAttempts -> return full paper/attempt
  -> frontend uses only attemptId -> navigate ?resume=id
  -> P GET /api/mocktest/attempt/id
     -> auth -> mockAttempts.findOne -> return same paper/attempt again
```

Pass the already loaded slot to the paper builder and seed the attempt screen from the start response. For fixed papers, both slot reads include the entire fixed-question array. The instructions start call does not supply the stable start key used by direct `MockTestEngine` startup; a manual retry after an uncertain response can create a second practice attempt. Use the same stable start protocol at both entry points.

This is not two automatic POSTs on the normal instructions path: it is POST then GET. Direct attempt entry without `resume` uses a sessionStorage key and backend start deduplication.

Evidence: [instructions start](frontend/app/(app)/mock-test/_shared/TestInstructions.tsx:51), [attempt loader](frontend/app/(app)/mock-test/_shared/MockTestEngine.tsx:91), [slot read](backend/controllers/mockTestController.js:170), [second read](backend/services/mock/mockPaperService.js:169), [slot projection](backend/services/mock/mockSlotService.js:224).

## F16 â€” Mock catalog loads full papers and can seed on read

```text
Open exam catalog -> P GET /api/mocktest/E/slots
  -> Mongo mockSlots.find(...).sort(...).toArray(), no narrow projection
  -> fixedQuestions arrays loaded from Mongo
  -> summarizeSlot removes arrays before returning JSON
  -> if catalog empty:
     sequential upsert for each static slot -> second catalog query -> summaries
```

The response is compact but the database read is not. Store small catalog metadata, including `hasFixedPaper`/questionCount, separately or use an appropriate projection/aggregation. Move default seeding to an explicit initialization/migration operation. Repeat catalog requests otherwise repeat full-paper reads; there is no shared slot cache in this path.

Evidence: [catalog fetch/seeding](backend/services/mock/mockSlotService.js:8), [summary after read](backend/services/mock/mockModel.js:38), [client fetch](frontend/app/(app)/mock-test/_shared/ExamLandingPage.tsx:81).

## F17 â€” Public question reads wait for private auth restoration

```text
Cold topic/quiz route
  -> session restore POST /auth/refresh
  -> GET /users/me including profile/history
  -> AuthContext loading=false
  -> SWR gate permits public /questions/counts or /questions/meta
  -> quiz session enabled flag also permits /questions/session
  -> question data ready
```

Counts and metadata do not depend on user identity and their Express routes are public. They could overlap restoration using an explicitly public query/cache policy. Set transport auth to `none` for that policy so speculative public requests do not cause another 401 restoration path. Preserve account separation for private queries and resume/filter initialization: a resumed session page needs saved filters/anchor before its first question-window request. Removing all gates without that distinction could create the very duplicate session reads this audit seeks to avoid.

Evidence: [SWR loading gate](frontend/app/providers.tsx:19), [session enable condition](frontend/features/quiz/hooks/useQuizFilters.ts:109), [public routes](backend/routes/questionRoutes.js:48), [profile bootstrap](frontend/context/AuthContext.tsx:220).

## Verified non-problems and validation

- Warm `/dashboard` has no page-specific fetch. `/dashboard/overview` renders the same dashboard component, not an additional endpoint request.
- Mathematics SSR and CSR call different endpoints. Catalog seeding avoids a blank initial total; the personal read is intentional.
- Metadata and initial quiz session requests start independently. The Start button does not repeat those same reads by itself.
- Normal solution opening has no backend solution fetch. Solutions arrive in session DTOs; images remain asset traffic.
- Quiz answer/progress requests already run concurrently. Cursor reads already avoid recounting totals and have in-flight guards.
- Training capabilities and dashboard already run concurrently per mount. Finish normally returns results in one response, and AI diagnosis is explicitly requested.
- Session restoration starts during instrumentation and shares the in-flight refresh promise with AuthContext. Do not assume two refresh calls merely because both have restoration entry points.
- Native fetch adapter and Axios are alternative transports. There is no general stacked fetch+Axios retry multiplication.
- The inspected app provider/layout chain does not mount `AppWarmup`, `StudyTelemetryProvider`, `PushRegistrationBridge`, or `NotificationCenterProvider`; their dormant hooks are not counted as traffic in these flows.

Commands completed locally:

```text
frontend: npm run test:run -- hooks/useQuizSession.test.tsx shared/api/request.test.ts
          shared/api/policy.test.ts context/__tests__/AuthContext.test.tsx
          4 files / 20 tests passed
backend:  npm test -- auth/__tests__/sessions.race.test.js
          1 file / 6 tests passed
```

These existing mocked tests validate pagination deduplication, transport retry behavior, basic AuthContext behavior, and auth race protections. They do not measure browser timing or prove the estimated ranking. No live database writes, deployments, application changes, or commits were performed. Production browser waterfalls with correlation IDs are needed to attach timings and frequencies, particularly for token-refresh effects, cache-miss fanout, and speculative prefetch.
