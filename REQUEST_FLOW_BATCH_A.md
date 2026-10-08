# Request-flow Batch A

Implemented locally on 2026-10-08 against checkout `8a65e94d`; changes are uncommitted. The original [request-flow audit](REQUEST_FLOW_AUDIT.md) records the pre-change baseline. Counts below exclude auth bootstrap, document/RSC requests, assets, retries, and unrelated catalogs.

## Training startup: F8 and the create-response portion of F12

```text
Browser /play
  -> Next /backend-api -> Express GET capabilities ----+
  -> Next /backend-api -> Express GET dashboard(E) ----+ concurrent
       -> existing JWT/session validation, rate limits, Mongo/Redis services
Browser /play/setup/M?exam=E
  -> shared owner/resource/exam SWR data; no repeated HTTP while fresh
Begin
  -> Next /backend-api -> Express POST training/sessions
       -> existing selection/transaction -> full public session
  -> account/session-scoped creation handoff -> /play/session/id -> first question
       -> no immediate session GET
Reload / revisit / expired handoff / queued offline action
  -> existing authoritative session read and offline-recovery protocol
```

The normal quick hub-to-setup journey drops from six training requests to three. Capabilities remain fresh for five minutes; dashboard data for fifteen seconds, with one-second SWR request deduplication. These are fetch-time freshness checks, and owner keys survive token rotation. Account-scoped application SWR providers continue to reset on account changes. Entering a session and successful actions invalidate dashboard data so returning to the hub reads fresh state.

Both the setup page and the hub's mission start seed the returned full session. Creation handoffs last at most thirty seconds, hold at most twenty entries, clear on logout/session changes, and reject responses from an earlier session epoch. They are memory-only and consumed after successful loading. Training clock synchronization keeps the original receive time. A queued offline action takes priority even when create returns an existing active session.

Sources: [shared queries](frontend/app/(app)/play/hooks/trainingQueries.ts), [hub creation](frontend/app/(app)/play/hooks/useTrainingSetup.ts), [setup creation](frontend/app/(app)/play/setup/[mode]/page.tsx), [session loading](frontend/components/training/session/hooks/useTrainingSession.ts), [write invalidation](frontend/components/training/session/hooks/useTrainingActions.ts), [handoff](frontend/lib/start-response-cache.ts).

## Mock startup: F15

```text
Instructions Start
  -> Next /backend-api -> Express POST mocktest/E/T/start, stable account-scoped key
       -> existing authorization
       -> Mongo mockSlots.findOne ONCE
       -> buildPaper receives that slot -> insert/reuse attempt -> full public attempt
  -> owner/exam/test/attempt-scoped handoff -> attempt route -> first question
       -> no immediate attempt GET or second paper transfer
Reload / expired or missing handoff / different account
  -> GET attempt/id -> authoritative saved answers/revision/time remaining
```

The normal instructions-to-attempt journey drops from POST+GET to one POST, and the backend avoids its second full slot read. Standalone paper-builder callers still fetch their own slot. Both start entry points use the same account-scoped sessionStorage key; uncertain instruction responses can be retried with the same key. A synchronous button guard prevents overlapping clicks. Completion removes that key.

The attempt loader waits for completed auth restoration and a verified account before dispatching; token arrival followed by profile arrival does not produce two reload reads. Mock deadlines use the start response's original receive time, so navigation does not grant extra time. Existing answer hiding, confidential assessment policy, revision checks, autosave, and submission behavior remain in place.

Sources: [instructions](frontend/app/(app)/mock-test/_shared/TestInstructions.tsx), [attempt loading](frontend/app/(app)/mock-test/_shared/MockTestEngine.tsx), [start keys](frontend/app/(app)/mock-test/_shared/startKey.ts), [start controller](backend/controllers/mockTestController.js), [paper builder](backend/services/mock/mockPaperService.js).

## Gemini authentication: F6

```text
First message / missing Firebase credential
  -> Next /backend-api -> Express POST auth/firebase/token
       -> existing Meow authorization -> mint custom token
  -> Firebase custom sign-in -> getIdToken -> Firebase AI generation
Later message with matching Firebase user
  -> Next /backend-api -> Express POST auth/firebase/session
       -> SAME Meow authorization checks -> trusted uid/project, no custom-token mint
  -> existing Firebase user.getIdToken (SDK refresh if needed) -> generation
Mismatch / invalid Firebase token
  -> sign out old credential -> mint/sign in once again
Logout / different Meow session / rejected Meow authorization
  -> block pending auth work and clear Firebase credentials
```

Completed Firebase sign-in is reused; concurrent authentication still coalesces and sign-in/sign-out remain serialized. The validation endpoint uses `protect`, the enclosing auth/global limiters, and `Cache-Control: no-store`. Meow JWT/session validation still occurs before every Gemini message, preserving immediate revocation/privilege checks. This removes repeated Firebase custom-token creation and custom sign-in, **not** the per-message Meow request or F1's Mongo guards. Same-session access-token rotation retains Firebase credentials; identity/session changes invalidate them. Firebase credentials stay in memory.

Sources: [Firebase client auth](frontend/lib/firebase/auth.ts), [validation/token routes](backend/routes/firebaseAuth.routes.js), [local invalidation identity](frontend/lib/auth-session-identity.ts).

Batch A does not change Mongo authorization guards, dashboard expiry reconciliation, quiz persistence, metadata grouping, history queries, public auth gates, translation, or general token-rotation/retry behavior.

## Validation

Checks completed locally:

- Frontend full suite: **102 files / 477 tests passed** (`npm run test:run`).
- Backend focused suite: **3 files / 28 tests passed**, including disposable Mongo replica-set integration (`npm test -- routes/__tests__/firebaseAuth.test.js services/__tests__/mockTestEngine.test.js routes/__tests__/mocktest.integration.test.js`).
- Frontend typecheck, full lint, and final production build passed.
- Backend build (typecheck and runtime-boundary checks) and full lint passed.
- Browser checks: **4 passed** (`npx playwright test e2e/training-play.spec.ts e2e/assessment.spec.ts --reporter=line`), covering desktop/mobile training and mock startup, reload, persistence, finish/submission, and confidential-answer hiding. The mock assertions count one start POST, zero immediate attempt GETs, and one GET after reload. Training assertions reuse capabilities/dashboard on the first setup navigation and accept creation without a session GET.

Tests cover shared query reuse/concurrency/owner and exam isolation/freshness/retry/invalidation; creation handoff ownership, lifetime, logout and late-response fencing; training offline recovery and authoritative reload; mock instruction retry keys, single POST/no immediate GET, preserved timers, autosave/conflicts/submission; and Firebase reuse, rejected sessions, user mismatch, invalid credentials, logout races and same-session token rotation. HTTP/Mongo integration counts the fixed slot lookup once and checks active-paper answer hiding.

The browser assertions exposed token-before-profile duplicate mock reload reads. The restored-owner gate fixes that case and has a dedicated component regression. The final full frontend suite and all four browser checks passed after that change.

Browser evidence uses disposable local fixtures, not production services. Training transport responses are intercepted fixtures; mock browser traffic uses the actual Express/Mongo fixture. Live Firebase/Auth/App Check/provider verification and production latency measurements remain outside these local checks. The full backend suite was not run. No deployment or commit is included.
