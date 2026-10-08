# Request-flow latency check

Measured 2026-10-08 against the local production Next build after Batches A–D. The clearest miss is **cold Next.js startup: 1,180–1,224 ms to the first `/play` response headers**, above the existing 800 ms benchmark target. Warm response headers took 18–27 ms. The benchmark correctly exited with failure for that target.

Five fresh-account journeys completed for each of desktop and mobile. Browser API traffic went through the **actual Next rewrite** to real Express handlers and disposable MongoDB; it was not intercepted or fulfilled by Playwright. These are current local measurements, not a before/after comparison or production latency forecast.

## Action timings

Milliseconds, **median [minimum–maximum]**, five samples per viewport. Click timers start at the trusted browser click event, before React handles it; Playwright scrolling, actionability checks and polling are excluded. Readiness is the first animation frame where the specified DOM marker has visible geometry intersecting the viewport. This does not measure animation completion, INP, LCP or physical display paint. Document timers start just before issuing navigation and include browser automation dispatch overhead.

| Action / readiness marker | Desktop | Mobile |
|---|---:|---:|
| Login → authenticated dashboard greeting | 717 [546–756] | 652 [555–670] |
| Reload dashboard → authenticated greeting | 272 [235–318] | 192 [180–209] |
| Open Mathematics document → catalog container | 107 [93–159] | 102 [94–172] |
| Open Algebra document → loaded PYQ count | 210 [190–223] | 187 [160–195] |
| Select PYQ → enabled Start Quiz | 411 [407–529] | 391 [373–586] |
| Start Quiz → Submit control rendered | 351 [349–364] | 73 [53–81] |
| Submit answer → enabled Next control | 16 [13–17] | 12 [10–13] |
| Next → second question rendered | 8 [6–10] | 10 [8–10] |
| Open solution → solution dialog/content marker | 28 [23–31] | 327 [324–339] |
| Open AI tutor → composer rendered | 28 [24–29] | 340 [332–350] |
| Open training hub → Adaptive setup control | 119 [112–136] | 150 [129–155] |
| Open Adaptive setup → enabled Begin training | 63 [54–90] | 71 [61–93] |
| Begin training → first question rendered | 265 [172–277] | 233 [224–304] |
| Confirm finish → results container rendered | 209 [167–236] | 187 [153–239] |
| Open mock catalog document → SSC CGL link | 104 [91–123] | 92 [86–115] |
| Open SSC CGL exam → fetched fixture slot title | 158 [100–393] | 118 [98–392] |
| Open mock instructions document → heading | 153 [138–156] | 153 [129–180] |
| Start mock → first answer control | 383 [367–433] | 380 [379–446] |

Mathematics catalog rendering can precede private progress. Progress readiness is therefore reported separately as an API timing below. Training hub rendering can similarly precede its private data. Quiz start uses the Submit control as a readiness proxy; this is not an independently timed first-question text paint. Finish uses the results container, not completion of all result animations.

The benchmark deliberately reloads documents for dashboard, Mathematics, topic, training hub, mock root and instructions. Each full reload restores auth again. Warm SPA dashboard navigation, which has no dashboard-specific API request, is not separately timed here. Quiz setup, training setup and mock exam navigation use real client navigation. The fixture mock is opened directly from its exam page because its seeded catalog entry lacks the free-slot flag.

## Browser API durations

Median milliseconds from Chromium request start through response completion, including the Next rewrite, Express work and local Mongo operations. Successful responses only. These are request durations, not sums of parallel requests or a decomposition of Mongo/JWT/serialization time.

| API | Desktop | Mobile |
|---|---:|---:|
| POST `/auth/login` | 513.6 | 456.5 |
| GET `/users/me` | 21.8 | 22.5 |
| GET `/api/questions/meta` | 10.6 | 10.5 |
| GET `/api/questions/session` | 9.7 | 8.6 |
| POST `/api/questions/answer` | 95.0 | 86.7 |
| GET `/api/progress/topics/private` | 17.7 | 14.8 |
| GET `/api/training/capabilities` | 12.1 | 15.8 |
| GET `/api/training/dashboard` | 26.5 | 34.0 |
| POST `/api/training/sessions` | 128.3 | 123.5 |
| GET mock exam slots | 12.9 | 15.0 |
| GET mock exam history | 17.4 | 21.2 |
| POST mock start | 22.4 | 24.4 |

Answer grading stays immediate while persistence completes later: 12–16 ms for feedback versus 87–95 ms for the answer command. The metadata first-use requests reached 170 ms desktop / 198 ms mobile; the warm medians above do not describe every cold request. Private progress reached 124 ms on the first desktop journey. Raw files retain every sample.

## Proxy comparison

Ten warm pairs per endpoint per viewport, alternating direct/rewrite order. These use Playwright's Node HTTP client, explicitly warmed paths and the same real account token; they are separate from browser UI timings and browser request counts. Times include response-body consumption and HTTP client overhead.

| Endpoint | Desktop direct / rewrite / paired extra | Mobile direct / rewrite / paired extra |
|---|---:|---:|
| Algebra counts | 6.3 / 9.1 / +3.3 ms | 6.8 / 9.3 / +2.7 ms |
| Private progress | 15.3 / 17.8 / +2.5 ms | 15.9 / 17.8 / +1.7 ms |
| Cached training dashboard | 16.9 / 20.2 / +2.9 ms | 16.0 / 19.9 / +3.3 ms |

The extra column is the median of paired differences, so it need not equal the difference between the two independent medians. The rewrite is a small part of local delay. A remote Next/Express deployment could have a different network cost; this does not establish a production bound.

## Observed request counts

Every completed journey had the following counts:

| Flow | Observed browser API requests |
|---|---|
| Answer | One consolidated answer POST; zero separate progress PATCHes |
| Training hub → setup | One capabilities GET and one dashboard GET across both screens |
| Training creation → session | One create POST; zero session GETs |
| Finish training | One finish action; results came from that response |
| Mock start → attempt | One start POST; zero attempt GETs |
| Mathematics progress | One private-progress GET; zero combined-progress GETs |
| Solution opening | Zero API requests |
| Tutor opening | Zero API requests; no message was sent |

Each desktop journey recorded 30 browser API sends; mobile recorded 29. The desktop includes an additional selected-topic counts read. Seven profile reads per journey reflect login plus the six intentional authenticated document reloads. Each new unauthenticated login page attempted one refresh and received the expected 401; all subsequent measured traffic had no unexpected HTTP failure or failed request. Registration and the warm direct/rewrite probes are excluded from browser counts. Browser observations cannot count server-side catalog fetches, Mongo queries or Redis commands.

## Priority from this measurement

1. **Cold Next document startup:** strongest measured miss, median 1,183 ms against the existing 800 ms target. The separate restart probe ran without Express/Mongo, so this delay can occur within the Next document path. Profile framework/module initialization and first-request rendering before changing database queries.
2. **Login:** slowest routine API request, median 457–514 ms. The tested route uses bcrypt cost 12. That is a source-backed contributor, not an isolated CPU measurement; retain the password security work factor.
3. **Quiz navigation and mock startup:** roughly 380–411 ms to their readiness markers, while their API medians are much smaller. Investigate RSC navigation, chunk loading and rendering with a browser CPU/network trace. Do not attribute the whole difference to React or JavaScript from these samples alone.
4. **First optional panels on mobile:** solution/tutor took 327–340 ms with no API request. Both mobile panels load code on demand: [solution import](frontend/features/quiz/components/views/MobileQuizView.tsx:14), [tutor import](frontend/features/quiz/components/views/MobileQuizChrome.tsx:15). This supports inspecting first-use bundle/render cost; it does not isolate that cost from animation.
5. **Training create and finish:** 233–265 ms / 187–209 ms to UI readiness. The create API is 123–128 ms. Setup's repeated requests and create-to-GET duplication were absent in these journeys.

Proxy elimination is a lower latency priority in this local environment. The broad authorization/database load concerns in the original audit remain unmeasured under concurrency; fast requests against a tiny local database do not establish server capacity.

## Environment and reproducibility

- Checkout `8a65e94d` plus existing uncommitted A–D changes; production build ID `chUrtpfPyOWVnk3hQXjL2`.
- Windows, AMD Ryzen 5 5500U, Node `v22.23.2`, headless Microsoft Edge. Desktop 1366×900; mobile is Chromium viewport/touch emulation at 390×844. No CPU or network throttling; not real-device evidence.
- Existing [browser fixture](backend/scripts/browser-fixture.js) with disposable single-node Mongo replica set, 250 Algebra questions and a 100-question fixed mock. Fresh accounts created through real registration use bcrypt cost 12 and separated history storage; histories are small.
- Redis is disabled. The fixture mounts real routers/controllers but omits the full production Express middleware stack and distributed global limits. Mongo and Express run on the same machine. No Atlas, production Redis, multi-instance auth, large-history or load-test evidence.
- Invite-page cookie presence is supplied locally; Express login, JWT verification and session validation remain real. AI generation, Firebase authentication/provider latency, translation and TTS are not measured.
- Browser journeys use an already started Next server, warmed by its login readiness check. Fresh contexts reset browser state; shared Next/backend caches can remain warm across runs. The restart probe separately measures process-cold response headers.
- Five UI samples are descriptive. No production p95, SLA, statistical before/after speedup or measured server-load reduction is claimed.

```powershell
# From frontend; uses the existing local-target production build.
$env:REQUEST_FLOW_LATENCY = '1'
$env:REQUEST_FLOW_LATENCY_RUNS = '5'
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:TEMP = 'D:\codex-tmp'
$env:TMP = 'D:\codex-tmp'
npx playwright test e2e/request-flow-latency.spec.ts
npm run test:performance:startup -- --restarts 3 --output ../REQUEST_FLOW_LATENCY_STARTUP.json
```

The [benchmark](frontend/e2e/request-flow-latency.spec.ts) is opt-in and rejects a build whose backend rewrite does not target loopback. Final five-journey desktop and mobile checks each passed. Focused zero-warning ESLint, frontend TypeScript and `git diff --check` passed. The startup benchmark ran successfully and **failed its latency target**. Earlier harness trials, including the timings before click-event correction, are excluded from these artifacts.

Artifacts: [summary](REQUEST_FLOW_LATENCY.json), [desktop samples](REQUEST_FLOW_LATENCY_desktop.json), [mobile samples](REQUEST_FLOW_LATENCY_mobile.json), [cold-start samples](REQUEST_FLOW_LATENCY_STARTUP.json). No application code changes, commits, deployment or production database writes were performed for this latency check.
