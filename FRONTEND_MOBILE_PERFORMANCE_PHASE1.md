# Frontend mobile performance: completed first phase

Completed locally on 2026-10-05 against base commit `46fec69b`. Scope follows the pasted request's four selected improvements: chat rendering, lazy quiz AI, deferred tutor schemas, and mathematics route/responsive separation. This resolves original audit findings **1, 2, 3, 5 and 6**. The other thirteen findings remain outside this phase.

The original [audit](FRONTEND_MOBILE_PERFORMANCE_AUDIT.md) and [baseline evidence](FRONTEND_MOBILE_PERFORMANCE_EVIDENCE.json) record the pre-fix state. [Phase-one evidence](FRONTEND_MOBILE_PERFORMANCE_PHASE1_EVIDENCE.json) preserves the new requested chunk sets, API traces, DOM observations, typing measurements, and validation results.

## Measured results

JavaScript figures sum unique requested production JavaScript files, including framework bootstrap, with gzip computed locally per file. These are comparable payload figures, not measured network transfer sizes. Saved-chat figures include opening the history and downloading the deferred renderer.

| Route or interaction | Before | After |
| --- | ---: | ---: |
| `/ai-chat`, empty, requested JavaScript gzip | 313.9 KiB | **225.1 KiB** |
| `/ai-chat`, saved mathematical replies opened, requested JavaScript gzip | 438.5 KiB | **349.8 KiB** |
| `/mathematics/advance/algebra`, requested JavaScript gzip | 244.1 KiB | **195.0 KiB** |
| `/mathematics/advance/algebra/quiz?resume=1`, plain question, requested JavaScript gzip | 244.1 KiB | 241.5 KiB |
| Same quiz, mathematical question, requested JavaScript gzip | 321.1 KiB | 318.5 KiB |
| First answer submission, additional JavaScript before opening either panel | 175.8 KiB | **0 KiB** |
| `/mathematics`, mobile DOM elements | 634 | **302** |
| `/mathematics`, desktop descendants mounted on mobile | 330, hidden | **0** |
| `/play` and `/play?exam=cat`, requested JavaScript gzip | 194.9 KiB | 194.9 KiB |

Typing used `explain the next step`, with 30 ms between keys and a final 500 ms wait. The history and fonts settled before the observation window. Each bot reply contained eight synthetic expressions.

| Saved bot replies / viewport | Long tasks before → after | Median observed long task before → after | Maximum observed long task before → after | Typing wall time before → after |
| --- | ---: | ---: | ---: | ---: |
| 10 / 390px | 22 → **2** | 495 → 71 ms | 649 → **84 ms** | 12,625 → **1,665 ms** |
| 30 / 390px | 23 → **1** | 1,423 → 72 ms | 1,923 → **72 ms** | 34,273 → **1,646 ms** |
| 30 / 360px | No baseline → **0** | — | — | No baseline → 1,645 ms |

For 30 saved replies, the mounted DOM fell from **19,530 elements / 240 expressions** to **6,594 elements / 80 expressions**. Earlier replies and the latest replies remained accessible through the history controls. This bounds mounted rendering; full conversation data is still retained and persisted.

## Exact changes and responsible code

### 1. Chat typing and long histories

- `frontend/app/(app)/ai-chat/ChatComposer.tsx:27` owns the draft state. Its `changeInput` callback at line 30 notifies the page only when draft presence changes. `AiChatPageContent` at `frontend/app/(app)/ai-chat/page.tsx:48` retains that small boolean for the Clear button, instead of subscribing to every character.
- `frontend/components/QuizChatbot/TutorComposer.tsx:26` owns the embedded draft and textarea resizing. `QuizChatbot` snapshots the draft on closing at `frontend/components/QuizChatbot/index.tsx:255`, preserving it across reopening without per-key parent updates.
- `frontend/components/ai/VisualResponse.tsx:445` and `frontend/components/QuizChatbot/TutorMarkdown.tsx:10` memoize the expensive Markdown/math renderer. Their existing `react-markdown`, math plugins, KaTeX behavior, and content validation remain active.
- `frontend/components/chat/MessageWindow.tsx:6` sets a 20-message mounted window. `messages.slice(start, end)` at line 33 preserves original message indexes for copy/retry behavior. The full page uses it at `frontend/app/(app)/ai-chat/page.tsx:381`; the embedded tutor uses it at `frontend/components/QuizChatbot/index.tsx:605`.

Regression tests verify that existing replies do not parse again during typing, that drafts send and clear correctly, that Shift+Enter does not send, that the embedded tutor preserves its draft/conversation on closing, and that earlier/newer/latest windows preserve original indexes.

There is still ordinary composer work and a parent update when draft presence first changes. The new measurements therefore show small remaining long tasks, rather than claiming every interaction has zero work.

### 2. Quiz panels import on opening

- `frontend/features/quiz/components/views/MobileQuizChrome.tsx:100` owns `tutorLoaded` and `tutorOpen`. Its `dynamic(() => import('@/components/QuizChatbot'))` at line 15 is rendered only after Ask AI is tapped, through the guard at line 127. Submission alone does not render it.
- `frontend/components/QuizChatbot/index.tsx:210` supports controlled opening while preserving the existing uncontrolled trigger for other callers. Once loaded, the mobile footer retains the tutor for that question so reopening preserves the conversation.
- Runtime tracing also found the closed solution sheet loading on submission: `frontend/features/quiz/components/views/MobileQuizView.tsx:113` previously set `solutionLoaded` when an answer was submitted. That sheet imports `motion`, `AnimatePresence`, and `useReducedMotion` from `framer-motion` in `frontend/features/quiz/components/ui/SolutionViews.tsx:3`. The guard now loads the sheet on `isSolutionOpen`, then retains it for its exit animation.

The 175.8 KiB baseline submission download included the optional solution dependency as well as the tutor dependency. Deferring only the tutor left a measured **45.2 KiB** closed-sheet download; the solution guard addresses that demonstrated path too.

Final plain and mathematical quiz probes both observed **zero additional JavaScript on submission**. First opening the tutor downloaded 131.9 KiB gzip across:

```text
static/chunks/1i211pymfmdd_.js
static/chunks/3b-25f174ph7i.js
static/chunks/2g3gbq-quuj-u.js
```

Opening the solution afterwards downloaded 45.2 KiB gzip across:

```text
static/chunks/1uhj420ihr55i.js
static/chunks/1b1g4xh5wfx-s.js
```

Both panels opened, dismissed, and reopened successfully. Reopening downloaded zero additional JavaScript. Optional panels now incur their first import delay when selected.

### 3. Defer full tutor schemas without removing validation

- `frontend/app/(app)/ai-chat/page.tsx:139` loads `@meow/contracts/tutor` inside the send operation and still parses the request, reply, and attachment-job response with the existing schemas.
- `frontend/app/(app)/ai-chat/page.tsx:157` loads `@/lib/tutor-jobs` only when an attachment response contains a job ID.
- `frontend/app/(app)/ai-chat/useAiChatHistory.ts:44` loads that poller only when recovering a stored pending attachment job, checking cancellation after the import. The existing abort and terminal-error handling remain in place.
- `frontend/lib/tutor-job-error.ts:2` provides the lightweight shared `TutorJobError` class. `frontend/lib/tutor-jobs.ts:4` re-exports that same class, avoiding an eager polling/schema import solely for error identity.

The full schema chunk still exists as `static/chunks/08yc2zv5r30f9.js`: **391,594 raw bytes / 91,127 gzip bytes**. None of the four initial AI-chat scenarios requested it, including opening saved mathematical history. The first operation needing validation loads it. A regression test exercises the real deferred schemas and rejects a `success: false` tutor reply.

This is a startup download reduction, not removal of Zod or a reduction in the full schema's size. Attachment polling frequency remains an outstanding audit finding.

### 4. Mathematics route and responsive boundaries

- `frontend/app/(app)/mathematics/_shared/route-page.tsx:10` now resolves route data only. It imports neither page implementation.
- `frontend/app/(app)/mathematics/_shared/topic-route-page.tsx:1` imports `MathematicsTopicPage`; `frontend/app/(app)/mathematics/_shared/quiz-route-page.tsx:1` imports `QuizRouteShell` and `MathematicsQuizEngine`. The six top-level/arithmetic/advance topic and quiz route wrappers use their respective renderer. Existing aliases, static parameters, and not-found handling remain covered by route tests.
- The final topic client-reference manifest has **no quiz engine reference** and a 52,245-byte gzip `entryJSFiles` set. The quiz entry set is 99,863 bytes gzip. Those entry figures have narrower scope than the full requested totals in the table.
- A first runtime check showed that splitting imports alone did not stop the topic page's practice links from prefetching quiz chunks. The exact trigger was `<Link href={mode.href}>` in `frontend/features/quiz/components/TopicPracticeModes.client.tsx:83`, with requests such as `/mathematics/advance/algebra/quiz?mode=concept&_rsc=…` followed by quiz-entry chunks. At line 88, mathematics links now use `prefetch={false}`; selecting a mode still uses normal Next navigation. Other subjects retain their existing prefetch setting.
- `frontend/components/subject-hub/SubjectHub.tsx:13` uses the existing hydration-safe media-query hook and mounts one responsive tree. The desktop implementation is dynamically imported at line 8 and only rendered at desktop widths, through line 18. This shared component also serves the other subject hubs.
- `frontend/components/subject-hub/useSubjectHubView.tsx:152` enables the desktop mode-count hook only for the desktop view. Mobile `/mathematics` no longer requested `/backend-api/api/questions/counts?topic=percentages&subject=mathematics`; its required topic-progress request remained. Topic pages still request their own mode counts because they display them.

The 1366px probe mounted 330 desktop descendants with `display:flex` and zero mobile descendants. Mobile mounted zero desktop descendants. Responsive tests also cover switching to desktop. The hydration-safe default is mobile; desktop content is selected and loaded after hydration, so first desktop paint can wait for that import. The desktop probe verifies the settled result, not desktop field LCP.

## Validation and practical limits

- `npm run check`: TypeScript passed; **93 test files / 425 tests passed**; lint passed with zero warnings on the final code.
- `npm run build`: production build passed, including **802 generated pages**.
- `npm run check:interface`: light/dark control and layout contracts passed at 320, 390, 768, 1366 and 1440px, including quiz palette safe-area checks.
- `npm run check:performance`: configured entry-JavaScript budget passed. Full requested totals above are measured separately.
- Twelve production asset replay scenarios completed with **zero uncaught page errors**. The 360px and 390px long-chat probes had no horizontal document overflow, and earlier/latest history navigation worked. Plain and mathematical quizzes exercised submission and both optional panels.
- One earlier check run alongside a build passed 424 of 425 tests because a cold dynamic-renderer import exceeded the assertion's default wait. That test passed alone; its import wait was made explicit. The final full check passed all 425 tests after the final application changes.
- The disposable API/storage/Mongo fixture shut down through its own handler. Its processes, four observed ports, and temporary directory `D:\mongo-mem-wUqVIb` are gone.

Measurements use production static HTML/assets replayed through Playwright, a disposable loopback API, and Chromium CPU throttled 4×. There was **no real Android device, slow-4G shaping, live frontend server, deployed CDN, field INP/LCP/CLS, Lighthouse TBT, controlled retained-heap test, battery measurement, or hour-long soak**. Mathematical histories and the mathematical question were synthetic; external services were aborted, and answer/progress writes were intercepted. Real AI generation was not exercised.

Some dynamic/parent RSC destinations are unavailable in static replay. Missing prefetched responses and repeated prefetch requests in this harness are not production 404 or duplicate-request evidence. Mock-test routes remain covered by the original source/bundle audit rather than these browser probes.

Automatic approval review previously rejected live frontend startup with **“blocked by policy”**; asset replay retains that verification limit. It also rejected deleting the earlier audit fixture directory `D:\mongo-mem-PPyw8a`. That earlier directory was not touched during this phase.

The local probe and full observations are in `frontend/test-results/mobile-performance-phase1/`; those files are ignored. The durable evidence JSON includes the probe's SHA-256 and the exact measured chunk sets.

## Remaining audit findings

Findings **4, 7–18** remain: duplicate KaTeX versions; full auth/chat payload duplication and whole-conversation saves; serial later-question resume; unused question fields; growing resume snapshots; mock timer and closed-palette updates; mock autosave; question-image delivery/dimensions; notes prefetch duplication; reconnect reloads; attachment polling frequency; and the global Iconify script. The 360px question-241 probe still made three serial session-page requests. This phase does not claim those mechanisms, memory retention, battery drain, image CLS, or field performance are fixed.
