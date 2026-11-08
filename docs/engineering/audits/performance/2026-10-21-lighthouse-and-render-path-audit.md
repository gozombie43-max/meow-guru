# Performance implementation and verification

Local checkpoint: 2026-10-21. Image delivery and session preloading are implemented.
The 2,500ms Lighthouse LCP target is **not achieved**, so strict Lighthouse
enforcement remains pending. No thresholds have been relaxed.

## Implemented behavior

- Shared topic thumbnails use Next Image with explicit dimensions and `sizes`.
  The first visible mobile topic loads eagerly with high fetch priority; remaining
  thumbnails retain lazy loading. The existing images and card layout are preserved.
- A self-contained HTML bootstrap starts the existing HttpOnly-cookie exchange
  and verified `/users/me` read before application JavaScript finishes loading.
  Axios and AuthContext consume those results once. The ordinary transport remains
  the fallback when preloading is unavailable or a profile read fails.
- Tokens and profiles stay in temporary browser memory. The HTML contains only
  public API configuration. A 15-second deadline bounds requests and Web Lock
  waits. Logout, provider cancellation, token mismatch, and expiry discard the
  preload. The provider still checks its account generation before accepting data.
- A failed profile preload counts toward the existing three-read recovery budget.
  It does not introduce an additional outer retry loop.
- The full mobile run exposed a mock-attempt startup race: the verified profile
  and first token could arrive together while the attempt loader still held a
  null token. Synchronize the token reference before the attempt-loading layout
  effect. Token rotation still preserves local answers without reloading.

## Fresh Lighthouse comparison

Both local collections used the same Windows host, production build mode,
Lighthouse 12.6.1, Chrome for Testing 131.0.6778.264, default mobile emulation and
simulated throttling, six unchanged URLs, and three runs per URL. Each audit ran
in a fresh Node process to avoid accumulating memory. Builds and browser runs
were serialized, and the local development server was temporarily stopped.

These are **local simulated metrics**, not a GitHub Actions or production result.
The original GitHub artifact has a different hardware/OS baseline; compare each
local measurement with the local baseline below.

This complete 18-report comparison covers the initial performance implementation,
before the subsequent mock-attempt effect-ordering fix described above.

| Route | Before median LCP | After median LCP | Before/after performance |
| --- | ---: | ---: | ---: |
| `/login` | 3,209ms | 3,077ms | 0.85 / 0.93 |
| `/mathematics` | 4,554ms | 3,904ms | 0.84 / 0.87 |
| `/play` | 3,526ms | 3,444ms | 0.89 / 0.89 |
| `/play/session/lighthouse-training` | 3,517ms | 3,525ms | 0.89 / 0.89 |
| `/mathematics/advance/algebra/quiz?resume=1` | 3,902ms | 3,770ms | 0.86 / 0.86 |
| `/mock-test/ssc-cgl/browser-test/attempt` | 3,648ms | 3,676ms | 0.88 / 0.89 |

Mathematics median image transfer fell from 461,223 to 65,536 bytes, about 86%.
Its median LCP improved about 14%. Training and mock-attempt LCP did not improve
materially; the small differences should not be presented as wins or regressions
without more samples. Earlier session requests alone did not solve rendering LCP.

The fresh collection contains all 18 reports. `check-lighthouse-routes.mjs` passed
for every requested route, including its successful session/question API checks.
LHCI assertions returned success **with warnings**: all six median LCP values
exceed 2,500ms and five routes miss performance 0.90. All six median TBT values
are below 200ms and median CLS values below 0.1. This is not a clean performance
gate pass.

Reports and the comparison JSON are available locally under
`test-results/performance-stage/{before,after}/` and
`test-results/performance-stage/comparison.json`. An earlier interrupted
17-report collection and single-run pilots are retained separately and are not
counted as complete validation.

After the final mock-attempt ordering fix and rebuild, that affected route was
measured separately for three more runs with the same settings. All three passed
the unchanged route/data validator, scoped in memory to the one follow-up URL.
Median performance was 0.87, LCP 3,738ms, TBT 157ms, and CLS 0. The performance/LCP
warnings therefore remain. These three reports are kept separately in
`test-results/performance-stage/mock-after-correctness-fix/`; they are not combined
with the earlier collection or presented as another complete six-route run.

## Correctness checks

- Root production build passed contracts, backend type checking/runtime boundaries,
  and all 816 frontend pages. Entry JavaScript budgets and interface checks passed.
- Full frontend coverage run: 139 files and 749 tests passed. Existing coverage
  thresholds passed (56.38% lines, 54.32% statements, 47.43% functions, 44.66%
  branches). No thresholds or test selections were changed.
- After the browser-discovered mock race, all 29 mock-engine tests passed,
  including two new start/resume cases that both fail with the original effect
  ordering. The full coverage run above preceded this final ordering fix.
- Full frontend TypeScript and zero-warning ESLint checks passed.
- CI policy and gate tests passed: 13 tests, including deployment isolation and
  failure/cancellation handling.
- Production browser smoke passed all 10 desktop/mobile cases: assessment
  reload/submission, resource light/dark themes, session loading while application
  scripts are held back, and transport recovery after a failed profile preload.
- After the ordering fix, assessment reload/submission passed three repeated runs
  per viewport: 6 passed. The original failing full-mobile trace is retained under
  `test-results/performance-stage/mobile-failed-html/` and
  `test-results/performance-stage/mobile-test-results/`.
- Mobile mathematics checks verified optimized image delivery (at most 128px
  natural width for the test viewport). Light/dark screenshots were reviewed at
  390px using the real saved theme and a reload; the existing layout is preserved.
- After the ordering fix, fresh full production-browser projects passed with no
  failures or flaky tests: desktop 129 passed / 20 skipped; mobile 134 passed /
  15 skipped. Reports are `test-results/performance-stage/final-desktop-html/`
  and `test-results/performance-stage/final-mobile-html/`. The existing conditional
  skips are retained. No failing run is counted as a full pass.
- Final full frontend TypeScript, zero-warning ESLint, and Git whitespace checks
  passed. The generated tracked quiz screenshot was restored.
- The original development service was restored on port 3000. `/login` returned
  HTTP 200, and the actual development HTML bootstrap passed a simulated guest
  execution without contacting the backend. Disposable test services were stopped.

## Release checkpoint

Keep the current Lighthouse warnings until a fresh complete collection meets all
four existing targets. The remaining work is to shorten the first question and
attempt rendering path and the subject hub's critical resource path, then obtain a fresh
three-run result on the isolated GitHub runner. Do not bypass profile verification,
remove real question content, or treat successful HTTP responses as proof of LCP.

No commit, push, cloud configuration change, or deployment was performed.

## Render-path proposal review (2026-10-21)

The supplied proposal is directionally useful, but its 87–88% render-delay
interpretation is too specific. That interval includes resource dependencies and
late content insertion as well as CPU work. The saved median training report
identifies two long tasks (179ms and 63ms) in the React DOM runtime chunk
`0-miyfba37k3g.js`; it does not attribute the whole delay to application CPU work.

Verified against the current source and production output:

- Mathematics topic text already exists in server HTML. After stripping script
  elements from `.next/server/app/mathematics.html`, “Time, Speed & Distance”
  remains present. A client boundary does not itself imply absent server HTML.
- MockCountdown and training clock/pace components already isolate timer ticks.
  Replacing the timer architecture would duplicate existing behavior.
- PageTransitionShell keeps initial content visible. No proposed mounted-only
  gate or entrance fade was found on the inspected question/topic path.
- Plain question text bypasses the lazy math renderer. Server-side KaTeX is not
  an explanation or immediate fix for these plain-text benchmark questions.
- The inspected client entry paths contain no question-bank JSON/NDJSON import.
  Root providers do not initialize battle/socket providers on these routes.
- Blanket content-visibility was not applied: the initial question must remain
  visible, and no expensive below-fold section was established as the bottleneck.
- Installed Next 16.4.0 documentation uses `next analyze`, rather than the
  proposal's older `next experimental-analyze` command.

Implemented:

- Training session route parameters resolve in a Server Component, passing only
  the session ID into the existing interactive session view. This does not claim
  to server-render private questions.
- The training palette loads only for desktop or when opened on mobile, using
  the existing 1024px CSS breakpoint. Hidden mobile palette DOM is absent.
- Training finish dialog and mobile quiz settings load only when opened.
  First-question components remain eager. Existing dialog lifecycle, focus
  restoration, navigation guards, and save/authentication behavior are retained.

Private question SSR remains unimplemented. The current browser authentication
exchanges an HttpOnly refresh cookie through an endpoint that rotates that cookie.
A Server Component cannot simply perform that exchange and propagate Set-Cookie
to the browser. A verified server-readable session design and safe data handoff
are prerequisites; moving a useEffect fetch into page.tsx alone is insufficient.

Current checks: production build (816 pages), TypeScript, zero-warning ESLint,
entry budgets, and interface checks passed. Training browser tests passed on both
desktop and mobile (2 tests covering modes, themes, reload, palette, and dialog
focus). Four quiz-navigation tests passed with NAVIGATION_APP_URL supplied,
covering 320px, 390px, and 1440px. An initial combined invocation skipped those
four cases in each project because that environment variable was absent; those
skips are not counted as passes. The training test now checks that the closed
mobile palette is absent from the DOM.

Six fresh production Lighthouse reports (three per changed route), using the
same Chrome 131, Lighthouse 12.6.1 and mobile simulation, passed the unchanged
route/data validator scoped in memory to these two URLs. Artifacts are in
`test-results/performance-stage/render-after/`.

| Route | Previous median LCP | New median LCP | Score | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Training session | 3,525ms | 3,641ms | 0.87 | 171ms | 0.00027 |
| Algebra quiz resume | 3,770ms | 3,892ms | 0.84 | 228ms | 0 |

These samples do **not** demonstrate an LCP improvement. Both routes still miss
the LCP and score targets, and quiz median TBT exceeds 200ms. Deferred training
palette, finish dialog, and quiz settings chunks are absent from the initial
mobile network reports, but that alone is not a performance-gate pass. The six
reports are not a complete six-route collection. No thresholds were changed.

The disposable performance fixture was stopped and development on port 3000
restored. No commit, push, authentication redesign, or deployment was performed.
