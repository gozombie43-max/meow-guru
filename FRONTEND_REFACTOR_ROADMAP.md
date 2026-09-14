# Frontend refactoring: verified roadmap

## Implementation update — 14 September 2026

The local implementation now covers all six priorities below. The original verified review is retained after this update as the historical baseline.

- **Quiz ownership:** the public controller delegates answer handling, navigation, session/resume state, and presentation to `features/quiz/hooks`. Answer scoring helpers live in `features/quiz/model`. The existing route entrypoint, persisted resume shape, cursor pagination, and translation preloading remain intact. Submission is guarded against repeated calls before a render.
- **Transport:** `shared/api/request.ts` provides typed JSON and Response contracts. Axios handles browser session refresh; native Fetch handles server, stream, and keepalive requests. Both share retry, timeout, cancellation, and error policy. Browser credentials are restricted to trusted destinations; mutations do not get network retries by default. Existing Axios-shaped callers use the temporary `shared/api/client.ts` facade; `lib/api/http.ts` is only a re-export. Server vendor integrations remain native internal adapters.
- **Query caching:** plain question API functions and canonical keys live in `features/quiz/api`. SWR owns query caching for both ordinary and study-mode questions. The extra question TTL/in-flight cache is removed. Successful question writes invalidate list/meta/count queries while active session pages retain their ordering. New sessions receive a fresh revision key. Account changes replace the SWR cache.
- **Large files:** admin question loading/mutations and upload flows, notification history/analytics/data logic, brain-scan selectors/styles, and subject-topic styles have feature-owned modules. Route composition and existing authorization remain in place. This is an incremental extraction; smaller UI sections and compatibility entrypoints can move when future changes justify it.
- **TypeScript/accessibility:** all seven JSX source files were converted to TSX with note/upload/editor/image-question types; `allowJs` is disabled. Pinch zoom is enabled. Keyboard/backdrop interactions and lint findings were addressed. ESLint now permits zero warnings.
- **Auth boundary:** one client provider boundary sits below the server root layout. The three nested route-group AuthProviders were removed. In a mocked Chrome development check, admin-to-app navigation previously increased `/users/me` calls from two to four; it now remains at two (initial Strict Mode bootstrap).

### Verification of the implementation

- Full Vitest suite: **55 files, 269 tests passed**. After adding three final transport regression cases, the affected transport suites passed **14 tests**, including those three cases. The full suite was run before this final narrow addition.
- Final `npm run typecheck`: passed.
- Final `npm run lint`: passed with **zero errors and zero warnings**.
- `npm run build`: passed, including production compilation, TypeScript, and **801/801 generated pages**.
- `git diff --check`: passed.
- Chrome with mocked API responses: quiz start/select/submit/solution flows passed for reasoning, mathematics, English, and general awareness at representative 320, 390, and 1440 pixel widths, with no horizontal overflow or page errors. Topic-page screenshots were inspected at 320×568 (light), 390×844 (dark), and 1440×844 (light); no horizontal overflow occurred. Browser viewport metadata allows zoom.
- Chrome with mocked API responses: notes create, edit, view, confirmed delete, and image upload passed. Uploads preserved the browser-generated multipart boundary. Provider tests cover account/logout cache isolation; controller tests cover local/server resume, qid navigation beyond a page, pagination boundaries, submission, and restart.

Live backend token expiry, AI, database writes, notification delivery, remote deployment, and a complete device/accessibility matrix were not exercised. Browser API traffic was mocked; no notifications were broadcast. Brain-scan extraction was checked through typecheck/build and existing tests, without a dedicated live browser fixture. Changes are local and uncommitted; existing user edits were preserved.

---

Reviewed 2026-09-14 against local HEAD `08912c2` plus the existing working tree. This is a source-verified plan, not an implementation or production-readiness assessment. Existing changes in math rendering, quiz chatbot, translation, and `useQuizController.tsx` were present before this review and must be preserved. The only deliverable added by this review is this document.

The attached review is directionally sound. Keep the modular monolith and introduce domain ownership as code is changed. Prioritize explicit state transitions and transport contracts over file moves. A numerical frontend score is not a measurable acceptance criterion.

## Findings and corrections

| Area | Verified current evidence | Consequence |
| --- | --- | --- |
| Two HTTP implementations | `frontend/lib/axios.ts` handles in-memory tokens, cookie refresh, concurrent refresh deduplication, and retries. `frontend/lib/api/http.ts` independently implements Fetch retries, timeouts, caller cancellation, and Retry-After handling. | Unify the feature-facing contract and policy; simply replacing Fetch calls with Axios does not preserve all existing behavior. |
| Server and client consumers | `frontend/app/api/upload-image/route.ts` uses the same Fetch helper as browser features, forwards the incoming bearer token, and explicitly opts into POST retries. Resources also consume binary responses. | Keep server authentication request-scoped. Support JSON, FormData, and binary output. Audit mutation replay before moving this route. |
| Question caching | `frontend/hooks/useQuestions.ts:48` uses SWR but its fetcher calls the HTTP helper directly. `frontend/lib/api/questions.ts:12` separately owns a two-minute Map. `frontend/app/(app)/english/_shared/useStudyModeEngine.ts:13` actually layers SWR over that Map. | There are competing cache paths, but `useQuestions()` itself is not double-cached. Remove the Map only after its consumers use the query layer. |
| Imperative study-mode fetch | `frontend/app/(app)/english/_shared/study-mode-start.tsx:43` calls `fetchQuestions` with `useCache: false` to calculate a count. It currently substitutes 5612 while loading and 0 on failure. | Migrate this consumer explicitly; define loading/error count states and verify whether the existing count endpoint has equivalent study-mode semantics before substituting it. Treat display behavior changes separately from a mechanical refactor. |
| Pagination | `frontend/hooks/useQuizSession.ts` already uses `useSWRInfinite`, a default limit of 50, cursor keys, and a pending-request guard. | Preserve this implementation's contracts; no replacement pagination framework is needed. |
| Controller | `frontend/components/quiz-engine/hooks/useQuizController.tsx` is 720 lines / 20,745 bytes. It already composes filters, bookmarks, keyboard, sync, resume, timer, preferences, and translation hooks. | Extract remaining answer, start/resume/restart, navigation, and presentation coordination. Do not duplicate the existing hooks. |
| Admin screens | Admin questions: 952 lines / 43,834 bytes. Notifications: 849 lines / 32,127 bytes. The latter owns history, analytics, health, composition, confirmation, and broadcast mutation. | These are stronger candidates for domain data/mutation boundaries than file size alone suggests. |
| Large presentation files | `BrainScanCoachView.tsx`: 1,004 lines / 32,380 bytes, with inline styles at lines 485–1001 and data fetching delegated to `useBrainScan`. `SubjectTopicPage.tsx`: 840 lines / 28,665 bytes, with inline styles at lines 113–789. | Separate styles and coherent visual sections first. Do not invent controllers for mostly presentational code. |
| Viewport | `frontend/app/layout.tsx:58` sets `maximumScale: 1` and `userScalable: false`. | Remove both in an independent early accessibility change; retain device width, initial scale, and viewport fit. |
| Lint budget | `frontend/package.json` permits 58 warnings, and `.github/workflows/ci-verify.yml` runs frontend lint. | Ratchet from a measured count. Changing the allowance alone does not fix warnings. |
| JavaScript | Seven JSX files remain: `ImageMCQ.jsx` and six files under the notes routes. `tsconfig.json` has `allowJs: true`. | Convert by domain with actual response/editor types. Audit remaining JavaScript imports before turning off `allowJs`; do not combine strictness changes with all other migrations. |
| Auth provider ownership | `(app)`, `(auth)`, and `(admin)` layouts each mount `AuthProvider`; its mount effect bootstraps the session. | Remounting can repeat bootstrap, but user-visible cost has not been measured. Shared in-flight refresh already exists. Defer a root-provider move until route-transition evidence justifies it. |

## Proposed sequence and completion gates

Each numbered change is independently reviewable. Larger stages may require several commits. Keep existing imports working with temporary re-exports where useful, then remove compatibility code once all callers migrate.

### 1. Establish controller behavior; ship the viewport fix independently

Add characterization coverage around the controller's public behavior before extracting it: select/clear/submit, submitted-answer locking, time accounting, restart, local resume, server resume, direct question links, and final-page completion. Exercise rapid repeat submissions and record any existing duplicate-effect behavior as a separate defect rather than silently changing it during extraction. Address the controller's two existing effect-state lint errors as part of defining lifecycle ownership; resolve the other four lint errors in focused accessibility/state changes early, so the full lint gate can become usable.

Extract in this order:

1. `features/quiz/model/answerLifecycle.ts`: pure transitions for selections, submissions, results, streaks, and difficulty. Preserve the existing adaptive rule and serialized field shapes.
2. `features/quiz/hooks/useQuizAnswerLifecycle.ts`: coordinate transitions with timers and progress writes. Keep network side effects outside state updater functions.
3. `features/quiz/hooks/useQuizSessionLifecycle.ts`: start, local/server resume application, restart, completion, and direct-question activation. Compose existing `useQuizResume` and `useQuizSync`; retain persisted storage keys and route identity.
4. `features/quiz/hooks/useQuizNavigation.ts`: previous/next/jump and palette navigation, integrating the existing keyboard hook and page availability.
5. `features/quiz/hooks/useQuizPresentation.ts`: overlay state, presentation selection, rail refs, and display derivations. Keep translation request/cache logic in its existing owner while preserving the current translation work.

Keep `useQuizController` as the orchestration facade with its existing return contract until desktop and mobile consumers migrate. Use one owner for answer/session state and explicit actions; avoid several hooks that each mirror the same selected answer or current index. Extraction is complete when lifecycle behavior is covered and each state transition has one owner, not when an arbitrary line count is reached.

**Gate:** focused lifecycle tests; existing resume/filter/timer/analytics tests; browser start → answer → navigate → resume → finish flows. Verify sparse filtering and resume beyond the currently loaded page. Preserve mobile fixed controls, list scrolling, light/dark themes, safe areas, and the `frontend/design.md` contract.

The viewport change can ship before this larger work. Validate zoom/readability on mobile and layout at increased text size. Do not wait for networking changes to enable pinch zoom.

### 2. Introduce one feature-facing HTTP contract

Create a narrow shared transport surface under `frontend/shared/api/`. The proposed request shape includes URL, method, headers, body, signal, timeout, response type, and an explicit authentication policy. Return typed data; expose one normalized error containing status, code/kind, safe message, and optional request ID. Distinguish HTTP failure, network failure, timeout, and caller cancellation.

Use the current Axios instance for first-party browser API calls, retaining its refresh mechanism. Centralize retry decisions so an adapter, an interceptor, and a query hook cannot multiply the same request's retry budget. A native Fetch adapter remains appropriate for server or streaming requirements, but must implement the same applicable policy rather than maintain an independent retry architecture.

Required details before migration:

- Only attach browser access tokens and refresh cookies to explicitly trusted first-party destinations. External/signed URLs must not inherit them.
- Server requests use incoming request credentials, never a process-global browser token or refresh session.
- Preserve `/backend-api` routing and avoid duplicating the Axios base path when existing callers supply prefixed URLs.
- Preserve FormData boundaries, JSON parsing, blob downloads, and response headers/status where consumers need them. Do not force JSON Content-Type onto uploads.
- Bound auth replay to one refresh cycle and retain concurrent refresh deduplication. Failed refresh must not create a retry loop.
- Caller cancellation must stop dispatch and retry backoff immediately. The existing Axios interceptor currently treats missing status as retryable without an explicit cancellation exclusion.
- Separate timeout from cancellation; honor Retry-After consistently. Keep mutations unretried by default and explicitly review the upload route's existing POST retry opt-in for duplicate-write risk.

Migrate questions/session/meta/counts/warmup first, then notes/resources/admin uploads. Inventory remaining direct Axios/Fetch consumers as well, including translation and streaming; migrate them by domain before declaring the transport unified. Temporary `fetchWithRetry` compatibility must not wrap another retry loop or bypass refresh through success-status overrides.

**Gate:** controlled tests for simultaneous expired-token requests, refresh rejection, public/external requests, cancellation before dispatch and during backoff, timeout, Retry-After, JSON errors, FormData, blobs, server credential isolation, and mutation non-replay. Verify browser auth expiry and upload/download flows against the application; mocks alone do not establish live refresh correctness.

### 3. Give SWR ownership of client query caching

Move question parameter normalization, response filtering, and transport calls into plain domain API functions. Introduce shared question key builders that include all relevant filters and pagination inputs. Make `useQuestions` and study-mode query hooks consume these functions instead of duplicating parsing/filtering rules.

Migrate `useStudyModeEngine` and `StudyModeStartView`, then delete the Map, TTL, in-flight promise cache, and `useCache` option from `lib/api/questions.ts`. Do not replace domain caches that serve a different purpose, such as KaTeX rendering or translation batching, merely because they also use a Map.

Define revalidation policy by resource: avoid surprise refetches during an active quiz; explicitly invalidate affected lists, metadata, counts, and study-mode queries after question writes. Preserve active session ordering and answer indexes when admin data changes; refresh new sessions without silently rewriting an in-progress attempt. Scope private data keys by identity and clear/invalidate those entries on logout/account change.

Keep `useQuizSession` on SWR Infinite and preserve `{ questions, nextCursor, hasMore, totalCount }`, limit 50, cursor progression, and its concurrent-load guard. A SWR deduplication interval is not a substitute for a documented freshness policy.

**Gate:** duplicate consumers share requests; keys separate every filter; mutation invalidation refreshes the correct resources; study-mode filtering is unchanged; logout does not expose prior private data; pagination, sparse filters, and retry budgets remain correct.

### 4. Decompose screens and establish domain ownership

| Target | Proposed boundary | Acceptance |
| --- | --- | --- |
| Admin question screen | `features/admin/questions/`: filter/list query hook, editor mutation hook, upload flows, table/list, editor dialog, bulk actions. | Existing cancellation, large-response timeout, upload result handling, CRUD payloads, filters, and refresh behavior survive. |
| Admin notifications | `features/notifications/admin/`: history/analytics/health queries, composer, confirmation, broadcast mutation, result panels. | Preserve audience validation and send confirmation; test with mocked sending so verification does not broadcast to users. |
| Brain scan | `features/brain-scan/`: view-model selectors, coaching sections, colocated styles; reuse `useBrainScan`. | Preserve data-source attribution, empty/loading states, coaching links, and readable mobile/desktop layouts. |
| Subject topic page | `features/quiz/components/`: topic shell, banner, mode cards, and scoped styles. | Preserve route overrides, study-mode availability, current theme behavior, and responsive layout. |

Move code only with these concrete changes. Routes remain composition/authorization entry points. Shared API and truly cross-domain UI belong under `shared`; domain-specific widgets stay with their feature. Keep `context` until a separate provider decision. Do not make global UI import a domain's internal controller.

Style extraction must preserve current selector scope and injection behavior; use visual comparison to catch leakage or cascade changes. Run representative 320px, 390px, short mobile, and 1440px layouts in both themes, including scroll regions, dialogs, focus, and touch targets.

### 5. Convert JSX and ratchet lint

Convert the notes editor/client/components together with explicit Note and upload-response types, then the thin notes route wrappers. Convert `ImageMCQ.jsx` with typed question and answer callbacks. Keep route URLs, exports, editor save behavior, and payloads stable. Avoid introducing `any` or blanket suppressions to make the conversion pass.

Fix lint by rule/category and touched domain. The measured baseline is 6 errors and 48 warnings. Once errors are fixed, the allowance can tighten from 58 to at most 48, then target 40 → 20 → 10 → 0 as fixes land. Warnings comprise 31 unused-variable findings, 14 dependency-array findings, and 3 relative-location-assignment findings. Review hook dependencies for behavior changes rather than applying blind autofixes. Maintain zero new warnings in changed files without disabling useful rules or excluding legacy directories.

**Gate:** frontend typecheck, notes create/edit/view/delete and image upload checks, image-question rendering/selection, full lint, and the relevant suites. Disable `allowJs` only after auditing all source imports and confirming typecheck/build still work.

### 6. Measure auth boundary changes separately

Instrument or inspect browser network calls across login → app → admin transitions and logout/login with another account. If remount bootstrap has a meaningful cost, add a small client provider boundary below the server root layout and remove the three nested AuthProviders in the same change. Preserve protected-route loading behavior, authorization, socket teardown, and query isolation. Do not make the entire root layout a client component.

**Gate:** direct entry to each route group, session restoration, cross-group navigation, logout/account switch, expired cookie, and denied admin access. No duplicate provider trees or stale private query data.

## Validation performed for this review

- `npm run typecheck` from `frontend`: passed.
- Targeted Vitest run from `frontend`: 4 files, 20 tests passed (`lib/api/http.test.ts`, `hooks/useQuizSession.test.tsx`, `useQuizResume.test.ts`, `useQuizFilters.test.ts`). These cover existing helper/pagination/filter/resume behavior; they do not establish full controller or live authentication coverage.
- Full ESLint baseline (`npx eslint . --format json --output-file <temporary report>`): failed with 6 errors and 48 warnings. Errors: `QuizExitDialog.tsx:33` (two accessibility rules), `useQuizController.tsx:274` and `:315` (state updates in effects), `SeriesStartViews.tsx:768` (click/keyboard accessibility), and `SolutionViews.tsx:34` (state update in effect). These are observations of the current working tree, not attribution to any particular prior change. The configured 58-warning allowance cannot make this baseline pass because errors remain.
- No application code changed. No full production build, full test suite, browser visual run, live AI, remote deployment, or production API/database checks were performed.

Implementation should start with controller behavior coverage and the independent viewport fix, followed by the transport contract and question-cache migration. Feature folders grow through those changes. Existing uncommitted controller/translation work must be reconciled before editing those same paths.
