# Frontend mobile performance audit

**Implementation update:** This document preserves the pre-fix audit snapshot. The four selected first-phase improvements are implemented and verified in [FRONTEND_MOBILE_PERFORMANCE_PHASE1.md](FRONTEND_MOBILE_PERFORMANCE_PHASE1.md), with [new measurement evidence](FRONTEND_MOBILE_PERFORMANCE_PHASE1_EVIDENCE.json). Findings 1, 2, 3, 5 and 6 are addressed there; findings 4 and 7–18 remain outside that phase.

Audited on 2026-10-05 against local commit `46fec69b`. Target conditions: mid-range Android, slow 4G, 360–390px viewport, and long quiz sessions. Application source was not changed.

The strongest demonstrated interaction problem is AI chat: typing reprocesses already rendered mathematical replies. The largest avoidable downloads are the initial Zod contract graph and the quiz tutor graph loaded immediately after submitting an answer, before opening the tutor. Mathematics also hydrates a hidden desktop interface and includes quiz entry code on topic-only routes.

## Evidence and limits

- A fresh production build completed successfully: Next.js 16.3.6, 802 generated pages, including TypeScript validation.
- The configured entry-JavaScript budget check completed successfully. Its narrower measurement scope is explained below.
- Next's experimental bundle analyzer completed. Its module graph includes asynchronous dependencies; a module appearing there does not establish that it downloads initially. Initial-download claims below use actual browser requests to the production build's assets.
- Ten successful isolated browser scenarios replayed current production HTML/JS/CSS through Playwright interception, with a disposable loopback API fixture. Most used 390×844; the later-question resume used 360×844. Chromium CPU throttling was 4×. Each scenario used a fresh browser context.
- External services were blocked in these probes. AI reply content and the mathematical first-question variant were synthetic; no paid AI request was made. Answer/progress writes in the UI probes were intercepted. The fixture supplied authentication and cursor pagination.
- Automatic approval review rejected starting the local production frontend server with `blocked by policy`, without a more specific reason. Asset replay does not verify middleware, a deployed CDN, server response times, or a real slow-4G connection.
- The disposable API/storage/Mongo processes are stopped. Automatic approval review also rejected deleting their verified temporary Mongo directory with `blocked by policy`; `D:\mongo-mem-PPyw8a` remains. No alternative deletion was attempted.
- The CPU observations are controlled long-task/Event Timing observations, not field INP or Lighthouse TBT scores. No real-device LCP, field CLS, battery measurement, garbage-collection-controlled memory retention test, or hour-long soak was performed. Source-backed impacts on those metrics are explicitly distinguished from measured interaction work.
- All successful browser scenarios reported zero uncaught page errors. This does not prove hydration correctness for every route, especially dynamic mock-test routes, which received source/bundle inspection rather than this browser replay.

`FRONTEND_MOBILE_PERFORMANCE_EVIDENCE.json` preserves compact measurements and request traces. The temporary probe is `frontend/.next/diagnostics/mobile-probe.cjs`; the full temporary observations are `frontend/.next/diagnostics/mobile-probe-results.json`. The `.next` files disappear when the build output is replaced.

## Observed JavaScript downloads

These are sums of unique JavaScript files requested in each fresh-context probe, including framework bootstrap. Gzip was computed locally per file; it is a comparable payload measure, not observed production wire compression. Figures exclude HTML, CSS, fonts, images, and API responses. “Initial” means before the tested typing/submission; saved-chat rows include opening that saved history and loading its deferred renderer.

| Route/state | Raw KiB | Gzip KiB |
| --- | ---: | ---: |
| `/play` | 615.0 | 194.9 |
| `/play?exam=cat` | 615.0 | 194.9 |
| `/mathematics` | 685.0 | 213.7 |
| `/mathematics/advance/algebra` — topic page | 776.7 | 244.1 |
| `/mathematics/advance/algebra/quiz?resume=1` — plain-text question | 776.7 | 244.1 |
| Same quiz, synthetic mathematical question | 1,038.3 | 321.1 |
| `/ai-chat` — empty chat | 1,083.1 | 313.9 |
| `/ai-chat` — saved mathematical replies opened | 1,504.7 | 438.5 |

Submitting the first quiz answer downloaded **another 576.5 KiB raw / 175.8 KiB gzip**, without opening the tutor. This happened for both plain-text and mathematical questions.

The existing `npm run check:performance` script measures `entryJSFiles` only (`frontend/scripts/check-performance-budget.mjs:20`). It excludes bootstrap scripts outside that field and interaction-triggered downloads. Its entry figure for AI chat is approximately 182.3 KiB gzip; the observed empty-chat total is 313.9 KiB. Passing that budget does not establish a comparable full-page payload limit.

## Findings

P1 means a substantial observed interaction or startup cost that deserves early attention. P2 means a concrete avoidable code path whose device-level impact was not separately quantified. P3 means a smaller confirmed unnecessary dependency. Metric labels below describe affected mechanisms; they are not claims that field thresholds failed.

### 1. P1 — AI typing re-renders and re-typesets the full conversation

**Responsible code:** `frontend/app/(app)/ai-chat/page.tsx:52` owns the input alongside messages; `:504` calls `setInput` on every keystroke; `:388` maps all messages; `:411` renders `VisualResponse`. `frontend/components/ai/VisualResponse.tsx:444` is an un-memoized component. It calls `extractVisuals` at `:445`, then `normalizeMarkdown`, `ReactMarkdown`, `remark-math`, and `rehype-katex` at `:451–465`. Markdown table cells also invoke the pipeline at `:312–319`.

**Observed:** after saved history and math fonts finished loading, typing `explain the next step` with a 30ms requested delay per character produced:

| Existing bot replies | Math expressions | DOM elements | Median observed long task | Maximum long task | Maximum observed event duration |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 130 | none | none | 56ms |
| 10 | 80 | 6,590 | 495ms | 649ms | 752ms |
| 30 | 240 | 19,530 | 1,423ms | 1,923ms | 2,128ms |

The test conversations contained one user message and eight formula expressions per bot reply. Typing wall time, including the per-key waits and final 500ms wait, rose from 1.85s to 12.63s and 34.27s. The 30-reply conversation is within the backend's 80-message saved-chat limit.

The embedded quiz tutor has the same structural problem: `frontend/components/QuizChatbot/index.tsx:227` owns input, `:445` updates it, and `:675–698` maps messages into un-memoized `TutorMarkdown`. That path was inspected but not separately timed.

**Impact:** INP, main-thread blocking, CPU/battery work, and scroll responsiveness while typing. The growing retained DOM increases memory pressure; the audit does not establish a memory leak.

**Specific correction justified by this code:** isolate composer state and memoize immutable message/rendered-response boundaries so old replies do not parse or typeset on input changes. The measured DOM growth also justifies rendering a bounded visible history for long chats while preserving navigation to older replies. Verify both changes against these same histories; adding memoization to unrelated components is not supported by this evidence.

### 2. P1 — Runtime Zod contracts add a large initial AI-chat chunk

**Responsible imports:** `frontend/app/(app)/ai-chat/page.tsx:11` imports runtime tutor schemas from `@meow/contracts/tutor`; `frontend/lib/tutor-jobs.ts:2` imports more schemas, and is eagerly reached by the history hook. `contracts/tutor.js:1` imports `z` from `zod`.

**Observed:** the empty-chat page downloads `static/chunks/08yc2zv5r30f9.js`: **391,594 bytes raw / 91,127 bytes gzip** (382.4 / 89.0 KiB). Module analysis attributes the large graph to Zod v4 core/classic schemas, compilation, JSON Schema conversion, and locale modules. Locale source entries alone total approximately 163.8 KiB raw. This cost occurs before sending a message or polling a job.

`VisualResponse` is already dynamic at `page.tsx:38`. Markdown/KaTeX did **not** download for the empty-chat scenario; blaming those imports for its initial payload would be incorrect.

**Impact:** startup download/parse work, LCP readiness and TBT risk on slow devices.

**Specific correction:** defer runtime contract/poller dependencies to the operations that use them, or provide a narrower browser validator entry whose emitted bundle is verified. Preserve request and response validation. Merely changing the page import is insufficient if the history hook still statically imports the same schema graph.

### 3. P1 — Submitting a quiz mounts the closed AI tutor and downloads its dependencies

**Responsible code:** `frontend/features/quiz/components/views/MobileQuizChrome.tsx:15` declares dynamic `QuizChatbot`, but `:131–134` mounts it as soon as `isCurrentSubmitted` becomes true. The child's `isOpen` starts false at `frontend/components/QuizChatbot/index.tsx:211`. That module statically imports `TutorMarkdown` at `:5` and tutor gateway code at `:22`.

**Observed:** first submission fetches four additional JS files totaling **590,305 raw / 180,047 gzip bytes**, although the tutor stays closed:

- `047cah3r4rg-x.js`: 30,073 raw / 9,945 gzip bytes.
- `3b-25f174ph7i.js`: 419,823 raw / 123,853 gzip bytes; contains the Markdown/math pipeline.
- `1uhj420ihr55i.js`: 17,280 raw / 5,913 gzip bytes.
- `1b1g4xh5wfx-s.js`: 123,129 raw / 40,336 gzip bytes.

**Impact:** download and parse work overlaps answer submission/next-question activity, creating INP/TBT and bandwidth/battery risk. Cached subsequent submissions do not repeat the first download.

**Specific correction:** keep the lightweight tutor trigger available after submission, and mount the dynamic tutor only when the user opens it. The dynamic boundary already exists; the premature mount is the problem.

### 4. P2 — Math quizzes can download two separate KaTeX implementations

**Responsible imports:** `frontend/components/MathRendererContent.tsx:4` imports direct KaTeX 0.18.9. `frontend/components/QuizChatbot/TutorMarkdown.tsx:2` and `frontend/components/ai/VisualResponse.tsx:5` import `rehype-katex`, whose installed dependency resolves to a separate KaTeX 0.16.47.

**Observed:** the direct typesetter module is approximately 264.4KB raw / 76.8KB compressed in module analysis; the nested one is 260.7KB / 76.2KB. A mathematical first question added 77.0 KiB gzip over the plain-text quiz probe. Submission then downloaded the tutor graph, including the other implementation. The two import paths and installed versions are confirmed in the dependency tree/build analysis.

**Impact:** additional transfer, parse work and retained code after using math plus the tutor. This is duplication across features, not an argument to remove math support.

**Specific correction:** unify compatible rendering/dependency paths and verify supported syntax, styling, and security options. A forced override between these different versions is not established as compatible by this audit.

### 5. P2 — Mathematics topic-only routes include quiz entry code

**Responsible imports:** `frontend/app/(app)/mathematics/_shared/route-page.tsx:4–5` statically imports both `MathematicsQuizEngine` and `MathematicsTopicPage`, then selects the view at `:23`. Topic and quiz route wrappers call that same function. `frontend/features/quiz/components/QuizEngine.tsx:52` statically imports `MobileQuizView` into the quiz graph.

**Observed:** `/mathematics/advance/algebra` and its plain-text quiz route have the same initial entry-script set and both request **776.7 KiB raw / 244.1 KiB gzip**. The topic page does not render a quiz. Analyzer tracing confirms the shared quiz client reference.

**Impact:** unnecessary JS download/parse on a navigation page, affecting initial readiness/LCP/TBT risk.

**Specific correction:** give topic and quiz views separate server entry modules so the topic route does not import the quiz client graph. The full removable-byte count must be established by a rebuild; the entire 244.1 KiB is not removable.

### 6. P2 — Mathematics hydrates a hidden desktop tree and fetches its counts on mobile

**Responsible code:** `frontend/components/subject-hub/SubjectHub.tsx:4–5` imports both views, then renders both at `:15` and `:20`. `frontend/components/SubjectHub.module.css:181–183` hides the desktop container using CSS. `frontend/components/subject-hub/useSubjectHubView.tsx:149–152` always calls `useQuestionCounts`; `frontend/hooks/useQuestionCounts.ts:53–61` fetches its URL.

**Observed at 390px:** `/mathematics` has 634 DOM elements, including **330 descendants inside the desktop container with computed `display: none`**. It requests `GET /api/questions/counts?topic=percentages&subject=mathematics`. The current compact OLED mobile topic rows do not use that desktop practice-mode count. Legitimate mobile progress/topic requests were separate.

**Impact:** unnecessary initial JS/hydration, React work, request traffic and memory. CSS hiding avoids painting the desktop tree but does not avoid creating or hydrating it.

**Specific correction:** select and load the appropriate responsive subtree while preserving SSR/hydration consistency, and enable desktop-only counts only when their consumer is active. Virtualizing the small mobile topic list is not justified here.

### 7. P2 — Authentication bootstrap downloads full AI histories, then AI chat fetches them again

**Responsible request/state:** `frontend/context/AuthContext.tsx:105–109` requests `GET /users/me` and stores the entire returned object. Initial restoration waits for it at `:224–231`. `frontend/app/providers.tsx:17–20` holds SWR queries until auth restoration completes. `backend/controllers/userController.js:62–64` excludes only sensitive/internal identifiers and returns the remaining user object, including `aiChats` and resume data.

`frontend/app/(app)/ai-chat/useAiChatHistory.ts:24–27` then issues `GET /users/me/ai-chats` and retains the full histories again. `backend/controllers/userController.js:228–239` returns up to 30 complete sessions.

**Verified with a disposable fixture user:** profile JSON was 18,845 bytes, the separate history response was 18,577 bytes, and the `aiChats` values in both responses were identical. This is duplicate content through different requests, not an SWR deduplication failure.

**Impact:** slow-4G startup traffic and JSON parsing before route data can proceed; full histories retained in root auth state even on `/play` or mathematics. Extra context retention is confirmed; a frequent provider rerender loop is not.

**Specific correction:** return a lean authenticated profile, load chat summaries for the history list, and fetch messages when opening a session. Keep authenticated-query gating; the unnecessary payload on that gate is the demonstrated problem. Fetch large resume details only when needed while preserving session recovery.

### 8. P2 — Every AI turn uploads a whole session and receives all saved sessions

**Responsible requests:** `frontend/app/(app)/ai-chat/page.tsx:138` saves after the user message and `:179` saves again after the reply. `frontend/app/(app)/ai-chat/useAiChatHistory.ts:91–97` sends all `session.messages` using `PUT /users/me/ai-chats/{chatId}`. It ignores the successful response body. `backend/controllers/userController.js:288` nevertheless returns both the updated chat and the complete `aiChats` array.

The frontend replaces a session with the complete message array at `useAiChatHistory.ts:103–119`. It limits session count to 30 but does not limit active-chat message count. The provider request sends only the most recent 16 messages (`page.tsx:142`), while persistence sends the full active conversation. The backend retains up to 80 messages per saved session, each capped at 12,000 characters (`userController.js:252–258`); backend persistence is bounded, but the active tab's history/DOM can continue growing.

**Impact:** increasing JSON serialization/upload work per turn, repeated downloading/parsing of unused histories, memory/scroll pressure during long conversations. These are source-confirmed payload shapes; production sizes were not measured.

**Specific correction:** persist appended messages with a minimal acknowledgement, fetch a session index rather than every message of every session, and load older active messages on demand. Preserve durable recovery and ordering; dropping persistence is not an appropriate performance fix.

### 9. P2 — Resuming a later quiz question requires a serial fetch of every preceding page

**Responsible code/request:** `frontend/features/quiz/hooks/useQuizFilters.ts:72–85` starts `useQuizSession` with `limit: 100`. `frontend/hooks/useQuizSession.ts:51–62` needs the previous page's cursor. `frontend/features/quiz/hooks/useQuizSessionLifecycle.ts:50–51` cannot restore until `savedIndex < questions.length`; `:69–72` keeps fetching until that becomes true.

**Observed at 360px:** resuming index 240 required three serial requests to `GET /api/questions/session?subject=mathematics&topic=algebra&mode=concept&limit=100&includeTotal=false`, with cursors on requests two and three, before displaying question 241. The requests returned 100, 100, then 50 fixture questions. This is an actual dependency waterfall, not duplicate fetching.

`useQuizSession.ts:89–91` also flattens all loaded pages while SWR retains the source pages. As a session progresses, loaded question data grows even though the screen shows one question.

**Impact:** round-trip latency and payload parsing on resume; memory growth across long sessions. A detached-object leak was not established.

**Specific correction:** persist a stable question anchor/cursor and provide a resume-window API, preserving filter/order semantics and backwards navigation. Bound retained question windows where feasible. Arbitrarily reducing page size would increase this particular resume waterfall.

### 10. P2 — Quiz session payloads include internal fields that the frontend discards

**Responsible request/consumer:** the same `/api/questions/session` request above. `frontend/features/quiz/model/utils.tsx:195–286` converts responses into quiz records. The backend query at `backend/services/questions/questionSessionService.js:103–107` has no projection; `:125–127` removes only `_id`.

**Verified fixture example:** 100 plain-text questions produced 78,138 bytes of JSON. Removing just the unused normalized/training fields reduced that to 32,548 bytes. Fields present were `topicKey`, `subjectKey`, `quizKey`, `modeKey`, `keyVersion`, `trainingMetadataVersion`, `trainingExamSlugs`, `trainingSubjectSlug`, `trainingTopicSlug`, `trainingEligible`, and `trainingCandidate`.

The repetitive fixture compressed to only 1,869 gzip bytes before removal, so the 45,590-byte raw reduction must **not** be presented as a measured wire saving. Actual question text/image payloads vary.

**Impact:** avoidable JSON parsing and SWR retention, plus transfer overhead dependent on compression and actual data.

**Specific correction:** use a session-response DTO/projection containing fields required by quiz rendering, answer logic, accessibility, diagrams, and navigation. Keep the metadata required by separate training/admin consumers in their own response contracts.

### 11. P2 — Quiz selections/navigation repeatedly serialize the accumulated resume state

**Responsible code/requests:** `frontend/features/quiz/hooks/useQuizSync.ts:50–91` debounces for 600ms, then sends the complete `selectedAnswers`, submitted indexes and `results` through `saveRecentQuiz` to `PATCH /users/me/recent-quizzes`. `:128–160` synchronously serializes growing answers/submitted indexes to localStorage after state changes once any question is submitted.

`frontend/features/quiz/hooks/useQuizAnswerLifecycle.ts:28–34` also performs the separate progress and answer writes; `frontend/lib/userApi.ts:38`, `:57`, and `:150` identify the exact endpoints. The browser probe observed `PATCH /users/me/progress`, `POST /api/questions/{id}/answer`, and the subsequent resume-state PATCH. These are distinct writes with different purposes; the audit does not classify all three as redundant.

**Demonstrated mechanism:** selection, submission and navigation can each schedule a full resume snapshot when separated by more than 600ms. Snapshots grow with session length. Repeatedly uploading a linearly growing result array gives quadratic cumulative result traffic across a completed long session. localStorage writes are synchronous, but this audit did not prove that a 250-question localStorage write itself exceeds 50ms.

**Impact:** answer/navigation CPU work and slow-4G/battery traffic that grows through a long session.

**Specific correction:** send changed resume records or coalesced checkpoints and defer/coalesce local persistence, retaining crash recovery and server idempotency. Measure selection/submission latency separately before claiming an INP threshold improvement.

### 12. P2 — Mock-test countdown re-renders the whole engine and the closed palette every second

**Responsible code:** `frontend/app/(app)/mock-test/_shared/MockTestEngine.tsx:49` owns `globalTimeLeft`; `:194–200` updates it every second. That same component recalculates question totals/status counts at `:314–323`, maps sections at `:392`, and normalizes/maps options at `:415–416`.

The mobile palette is rendered whenever `!isDesktop` at `:456–478`, even when `showPalette` is false. It maps every question in the current section at `:466`. `MockTestEngine.module.css` moves the sheet offscreen with `translateY(100%)`; it does not unmount the tree.

**Impact:** approximately 3,600 whole-engine render passes during an hour of active countdown, including a hidden palette. This is concrete avoidable CPU/battery work and a potential source of interaction contention. Per-render device cost was not measured. Existing memoized `MathRenderer` means unchanged question math does not necessarily typeset every second.

**Specific correction:** isolate the clock's display state while preserving deadline/expiry handling, memoize stable question/palette boundaries, and mount the palette on demand. Virtualization is justified only if supported section sizes actually make the remaining visible palette expensive. The regular quiz and `/play` already provide examples of isolated timers.

### 13. P2 — Mock autosave sends unchanged full snapshots and can queue stale snapshots

**Responsible code/request:** `frontend/app/(app)/mock-test/_shared/MockTestEngine.tsx:129–143` calls `saveProgress` every 20 seconds regardless of whether answers/status/navigation changed. `:104–120` serializes saves through a promise chain without coalescing pending snapshots. `frontend/app/(app)/mock-test/_shared/api.ts:199–203` sends `PATCH /api/mocktest/attempt/{attemptId}/autosave` containing all answers/statuses and navigation indexes.

**Demonstrated mechanism:** an uninterrupted hour schedules approximately 180 autosaves even when the user makes no changes. If requests take longer than the interval, the chain can accumulate older full snapshots and transmit them after newer state exists. This is a conditional backlog, not a measured production backlog. Revision/conflict handling is present and should remain.

**Impact:** avoidable radio/JSON work, battery consumption and additional memory/traffic under slow requests.

**Specific correction:** save only dirty revisions, replace pending unsent snapshots with the latest state, and retain ordered revision checking and an awaited final save before submission.

### 14. P2 — Question images have no reserved dimensions; mock images bypass responsive optimization

**Responsible rendering:** `frontend/components/RichContent.tsx:98–111` uses a native `<img>` with `width: 100%`, `height: auto`, no intrinsic `width`/`height` or aspect ratio, and `loading="lazy"`. The normal mobile question and option paths use it at `frontend/features/quiz/components/views/MobileQuizView.tsx:206` and `:238`; solution rendering also uses it.

`frontend/app/(app)/mock-test/_shared/MockTestEngine.tsx:404–410` uses `next/image` with `unoptimized`, as do review images at `ReviewEngine.tsx:248–253` and `:289–294`. Fixed dimensions reserve layout in those mock paths, but the original source is delivered without generated responsive variants.

**Impact:** the `RichContent` path can shift layout when images decode because image height is unknown. A visible image that is the question's dominant content is also a potential LCP element, yet receives lazy loading. Large original images can increase transfer/decode memory on 360–390px screens. Production image dimensions/bytes and actual image-induced CLS were not measured.

**Specific correction:** retain genuine source dimensions/aspect ratios, serve appropriate mobile variants, and prioritize the active question's critical image when it is above the fold. Do not eagerly load every question/option/solution image.

### 15. P2 — Mathematics notes immediately prefetch all tabs without in-flight deduplication

**Responsible requests:** the active shared implementation is `frontend/app/(app)/mathematics/_shared/formula-notes-page.tsx`, not the older standalone `FormulaNotesClient.tsx`. `:269–272` fetches the active category; `:275–291` simultaneously fetches the other three categories. URLs are `GET /api/pdfs?topic={topic}&category={notes|formula|extra|dpp}`.

Both branches check completed cache entries; neither records a pending request for a category or aborts obsolete prefetches. Changing tabs while a prefetch is still pending can issue another request for that same category. This effect runs again on active-tab changes. The category responses are PDF metadata; the code does not establish that all PDF file bytes are downloaded.

**Impact:** speculative request contention on slow 4G and conditional duplicate requests, plus unnecessary parsing/cache writes.

**Specific correction:** share in-flight requests between foreground and prefetch paths, cancel obsolete work where safe, and schedule inactive-tab metadata on intent/idle rather than immediate fan-out. These requests were source-inspected, not timed against production storage.

### 16. P2 — Any offline/online cycle reloads the application

**Responsible code:** `frontend/components/AppRecovery.tsx:53–66` marks every offline event, then schedules `window.location.reload()` 700ms after reconnect when that flag is set, even if no chunk-load error occurred. `:43–46` performs the reload with a 15-second throttle. `frontend/app/(app)/layout.tsx:11` mounts it across study routes.

**Impact:** intermittent mobile connectivity can repeatedly tear down page state, replay authentication/route data requests and hydration, and interrupt long quiz sessions. Browser caching may reuse scripts; the audit does not claim every reload redownloads every chunk.

**Specific correction:** reserve a document reload for demonstrated unrecoverable chunk/runtime failures. Normal reconnects can revalidate stale data and continue the mounted session.

### 17. P2 — Attachment jobs poll every 1.5 seconds without backoff or a visibility policy

**Responsible request:** `frontend/lib/tutor-jobs.ts:9–26` loops for up to ten minutes, making `GET /api/ai/tutor-jobs/{jobId}` and waiting only 1,500ms between responses. It is used by `frontend/app/(app)/ai-chat/page.tsx:159` and restored jobs in `useAiChatHistory.ts:44`.

**Demonstrated mechanism:** a job pending for the full deadline permits approximately 400 requests, excluding request latency. There is no increasing delay, server retry interval, or explicit hidden-tab suspension. Browser timer throttling may reduce hidden-tab frequency. Abort-on-unmount support is already present.

**Impact:** repeated radio/network/validation work and battery use during long attachment processing, including a mounted background tab.

**Specific correction:** use bounded backoff/server retry hints and a visibility-aware resume policy while preserving eventual job completion and existing abort behavior. A socket infrastructure change is not required by the evidence.

### 18. P3 — An unused Iconify script loads globally

**Responsible import/request:** `frontend/app/layout.tsx:78–83` installs an `afterInteractive` script from `https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js` on every route.

**Verified:** searching current frontend TS/TSX/CSS found no rendered `<iconify-icon>` usage; only the loader and its type declaration remain. Active component icons use named Lucide SVG imports. The external request's bytes were not measured because external hosts were blocked in the isolated probes.

**Impact:** unnecessary third-party transfer, script evaluation and startup CPU work. `afterInteractive` reduces priority but does not eliminate the request.

**Specific correction:** remove the global loader or mount it only with a real consumer.

## Inspected areas without a demonstrated optimization need

- **Root providers:** current application providers are auth, scoped SWR, styled-jsx, and the question-invalidation bridge. `NotificationCenterProvider` and `StudyTelemetryProvider` are defined but not mounted in current application code. Their polling cannot be blamed for these routes. The concrete global issue is the auth payload in finding 7.
- **`"use client"`:** interactive quiz/chat state requires client execution. No blanket directive-removal recommendation is supported. Findings 5 and 6 identify specific import/render boundaries that include unused mobile work.
- **Hydration:** no current hydration exception was observed in successful asset-replay scenarios. The former AI hydration failure is not listed as a current finding.
- **Regular quiz timer:** `frontend/features/quiz/components/QuizTimer.tsx` keeps the ticking state inside timer components; `useQuizTimer` exposes control through a ref. The quiz parent does not receive a countdown state update every second.
- **Mobile quiz lists/palette:** `frontend/features/quiz/components/views/MobileQuestionNavigator.tsx:33–37` already virtualizes rails/grids beyond 100 questions and `:77` mounts the palette only when open. The desktop `QuestionPalette` is not evidence of an unvirtualized regular mobile quiz.
- **Answer selection:** the current question/options need to reflect the selected answer. No evidence justifies blanket memoization of every option. Findings 3 and 11 identify additional submission/persistence work; standalone selection latency was not profiled.
- **Math rendering:** `frontend/components/MathRenderer.tsx:16–26` is memoized, leaves ordinary text on a cheap path, and lazily loads the typesetter. Its and related caches have explicit bounds; no unbounded cache leak was established.
- **Framer Motion:** the regular mobile solution sheet reaches `SolutionViews` dynamically when `solutionLoaded` is true (`MobileQuizView.tsx:14–15`, `:297`). Desktop quiz code is also dynamic. The presence of Framer Motion in the analyzer's full asynchronous graph is not evidence that mobile startup downloads it. No measured animation jank supports a blanket removal.
- **Fonts:** root layout uses a local Geist font with `preload: false`, allowing the system stack on most surfaces. No active Google-font download was identified. KaTeX fonts loaded when math was rendered, which is expected.
- **Icons:** named Lucide imports are not evidence that the whole icon catalog ships. Finding 18 identifies a specific unused loader instead.
- **`/play`:** capability and dashboard requests run in parallel after verified auth. `/play?exam=cat` requested the CAT dashboard directly; no redundant default SSC dashboard request appeared. Training clock/pace ticks live in leaf components (`TrainingSessionHeader.tsx:25–26`, `TrainingPace.tsx:12–13`), with deadline handling in `useTrainingClock`. Current answer transport uses deltas; this audit found no reason to replace it.
- **Cursor requests and translation:** regular quiz `fetchMore` has an explicit pending guard and SWR deduplication. Nearby-question translation prefetch is bounded. The actual resume waterfall is finding 9; duplicate cursor requests were not observed.

## Order of work justified by this audit

1. Stop unchanged AI replies from reprocessing on input changes; repeat the 0/10/30-reply typing probes.
2. Defer the closed quiz tutor and initial Zod/poller graph; verify actual requested chunks before/after the corresponding interaction.
3. Remove the quiz graph from topic-only routes and gate the hidden desktop tree/counts; compare production payloads, hidden DOM, and API traces.
4. Reduce auth/chat/session payloads and resume traversal; preserve authentication, stable question ordering and recovery semantics.
5. Isolate mock clocks and coalesce dirty persistence; test deadline expiry, revision conflicts, final submission and recovery.
6. Address image sizing/variants, PDF request deduplication, ordinary reconnect handling, polling, and the unused Iconify loader.

These recommendations each correspond to a demonstrated current code path. A production mobile trace with actual network shaping and a long-session soak remains necessary to quantify field LCP/INP/CLS, startup TBT, scroll frame times, retained memory and battery changes.
