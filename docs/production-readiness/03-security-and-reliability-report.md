# Deliverable 03 — Security & Reliability Report

**Audit Date:** 2026-11-22  
**Security Posture:** Hardened across Backend Auth/Validation/AI/Idempotency, Frontend CSP/Headers/Upload Proxy, Observability PII Scrubbing, and CI/CD Workflow Isolation  
**Dependency Audit (`npm audit --audit-level=high`):** **0 vulnerabilities** across root, `backend`, `frontend`, and `@meow/contracts`

---

## 1. Authentication, Session Revocation & Abuse Controls

1. **Session Validation & Instant Revocation (`backend/auth/sessions.js`, `backend/auth/socketPrincipal.js`)**:
   - Fast path (non-privileged roles when `subscriberHealthy === true`) batches `[sessionKey, revokedSidKey, revokedUserKey]` into a single Valkey `mGet` (`redisGetJsonMany`), preserving instant revocation markers (`auth-revoked:v2:*`) and `auth-evictions` Pub/Sub invalidation.
   - Fallback path (privileged roles `admin`/`superadmin`/`moderator`/`editor`, or when `subscriberHealthy === false`) executes a single live `authorizationState(decoded)` check (`authSessions` + `users`, halved from 4 reads to 2) while preserving zero-window live DB enforcement for privileged accounts and `localTombstoneEpoch` + `tokensBefore`/`tokensAfter` race fences.
   - Refresh token rotation enforces a 10s reuse grace window; token reuse outside grace revokes the entire session.
   - Socket.IO handshakes authenticate JWT via `createSocketPrincipal` (10s TTL + instant Pub/Sub eviction) and revalidate on every incoming packet (`socket.use`).
2. **Non-Blocking Password Verification (`backend/auth/passwordHash.js`, `backend/auth/passwordWorker.js`, `backend/auth/passport.js`)**:
   - Cost-12 `bcryptjs` hashing and comparison (`$2a$`/`$2b$` compatible) are offloaded to a bounded `worker_threads` pool (max 4 `.unref()`ed workers, queue cap 256, `AUTH_BCRYPT_WORKERS=true` default outside tests) so concurrent logins cannot starve the Node.js event loop.
   - `getDummyPasswordHash()` is computed lazily rather than blocking startup, preserving constant-time timing-attack resistance on unknown emails.
3. **Per-Account Login Lockout & Email Recovery Quotas (`backend/repositories/authLoginLockoutRepository.js`, `backend/routes/auth.routes.js`)**:
   - `POST /auth/login` tracks progressive per-account failures in the TTL-indexed `rateLimits` collection (`5` failed attempts → `15m` temporary lockout returning `429 ACCOUNT_LOCKED` with `Retry-After`; cleared on successful login).
   - `POST /auth/forgot-password` and `POST /auth/resend-verification` enforce `consumeEmailRecoveryQuota` (`60s` cooldown and `5/hr` cap per email/action) while returning uniform `200 { message }` with `Cache-Control: no-store` to prevent account enumeration and Resend quota abuse.
   - `/auth/google/callback` wraps `createSession` in `try/catch` redirecting cleanly to `${frontendUrl}/login?error=oauth` on failure.
   - Cookie security flags (`Secure`, `HttpOnly`, `SameSite`) are unified via `isProductionCookieEnv()` across `auth.routes.js` and `oauthState.js`.
4. **Origin & CSRF Policy (`backend/auth/requestOrigin.js`, `backend/battle/battleSocket.js`)**:
   - Browser requests and all cookie-bearing requests require a trusted `Origin` or `Referer` matching `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS`.
   - Non-browser API/k6 clients without cookies or `Origin` are permitted on designated OTP endpoints only when explicitly presenting `X-Client-Platform: k6|native|api`, preserving strict browser CSRF defenses.
   - Socket.IO CORS (`buildSocketCorsOrigins`) now preserves `CORS_ALLOWED_ORIGINS` alongside `FRONTEND_URL`, matching Express HTTP CORS.

---

## 2. Input Validation, AI Safety & Idempotency Hardening

1. **Strict Zod Validation (`backend/routes/*`, `backend/controllers/imageQuestionController.js`)**:
   - Stripped `.passthrough()` mass-assignment surfaces from `backend/routes/mocktest.js` Zod schemas (`startBodySchema`, `autosaveBodySchema`, `adminCreateSlotBodySchema`, `adminUpdateSlotBodySchema`).
   - Added Zod `validateBody`/`validateParams`/`validateQuerySafe` coverage on `notes.routes.js`, `training.js`, `questionRoutes.js`, and `PUT /users/me/ai-chats/:chatId` (`user.routes.js`).
   - Wrapped `JSON.parse(optionRegions)` in `backend/controllers/imageQuestionController.js` in `try/catch` returning HTTP `400` instead of `500`.
   - Scoped Multer error handling in `backend/routes/questionRoutes.js` strictly to upload routes (`err instanceof multer.MulterError` → `400`/`413`), forwarding all non-Multer errors to centralized `errorHandler` so 5xx errors are never masked as `400` or leaked in production.
   - Removed the hardcoded `'meow-quiz-session-cursor-v1'` HMAC secret fallback in production (`backend/services/questions/quizSessionV1Service.js` now requires `QUIZ_CURSOR_SECRET || JWT_SECRET`).
2. **AI Tutor Prompt-Injection & Admission Controls (`backend/services/tutorChatService.js`, `backend/routes/aiRoutes.js`, `backend/routes/training.js`)**:
   - Isolated untrusted student inputs and question contexts using explicit structural delimiters (`<student_context>`, `<student_question>`) and system-level instruction hierarchy so embedded prompt-injection text cannot override tutor instructions.
   - Added `aiAdmission` concurrency lease enforcement on `POST /api/training/sessions/:id/diagnosis`.
   - Added `idempotency(...)` middleware on `/api/ai/diagram`, `/api/ai/explain`, and text-only `/api/ai/tutor-chat` (preserving multipart attachment upload protocol).
3. **Mutation Idempotency & Atomic Writes (`backend/middleware/idempotency.js`, `backend/routes/v1/quizSessionRoutes.js`, `backend/repositories/userRepository.js`)**:
   - Removed premature `res.on('close', ...)` deletion of `pending` idempotency keys in `idempotency.js` so client disconnects mid-write never unlock duplicate mutations; added `400` to `retryable` statuses so validation errors do not poison keys for 24h.
   - Moved `validateBody(...)` **before** `idempotency(...)` in `quizSessionRoutes.js`.
   - Added optional `idempotency` middleware on `PATCH /users/me/progress` and `PATCH /users/me/usage`.
   - Replaced the non-atomic two-write bookmark mutation with a single atomic `mutateUserBookmarks` CAS/transaction write in `userRepository.js`.

---

## 3. Frontend Security Headers, Upload Proxy & Client Reliability

- **HTTP Security Headers (`frontend/next.config.ts`, `frontend/lib/security/csp.ts`)**:
  - Removed the redundant duplicate `Content-Security-Policy-Report-Only` header (retaining enforcing `Content-Security-Policy`).
  - Added `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Frame-Options: SAMEORIGIN`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - Pruned unused third-party CDN origins (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `code.iconify.design`) from `csp.ts`.
  - Added a production build guard in `next.config.ts` failing builds if `NEXT_PUBLIC_ADMIN_SECRET` is ever set.
- **Upload Proxy Hardening (`frontend/app/api/upload-image/route.ts`)**:
  - Enforces a `10 MB` (`MAX_UPLOAD_BYTES`) ceiling via both `Content-Length` pre-check and multipart byte validation (returning `413 Payload Too Large`).
  - Forwards `req.signal` and `X-Request-ID`, and parses upstream non-JSON `502`/`504` responses safely without crashing or masking status codes.
- **Client Auth & Double-Submit Safety**:
  - `AuthGate.tsx` renders an accessible loading shell (`role="status"`, `aria-busy="true"`) while `!isPublic && loading` so child `useEffect` hooks never fire unauthenticated `401` calls.
  - Synchronous `useRef` locks + `Idempotency-Key` + `AbortController` added to `/battle/rewards`, `/ai-chat`, `QuizChatbot`, `/notifications` ("Read all"), `/resource` (`openFile`), and `/admin/battle-integrity`.
  - Added 7 segment `error.tsx` boundaries (`mock-test`, `battle`, `play`, `profile`, `notifications`, `resource`, `(admin)`).

---

## 4. Observability, Sentry PII Scrubbing & Prometheus Alerting

- **Backend Sentry (`@sentry/node@^11.16.0` in `backend/infrastructure/sentry.js`, `instrumentation.js`, `app.js`, `middleware/errorHandler.js`)**:
  - Clean no-op when `SENTRY_DSN` is unset (zero overhead in local dev/test; passes `verify-app-no-optional-integrations.js` and `verify-tracing-runtime.js`).
  - Coordinates with OpenTelemetry (`skipOpenTelemetrySetup: process.env.OTEL_ENABLED === 'true'`) and flushes cleanly during graceful shutdown.
  - `scrubSentryEvent(event)` (`beforeSend` & `beforeSendTransaction`) strips `authorization`, `cookie`, `set-cookie`, `x-access-code`, `x-metrics-token`, passwords, OTPs, reset/access/refresh tokens, JWTs, emails, and `user.{email,ip_address,username}` from headers, URLs, query strings, JSON bodies, `extra`, `contexts`, `tags`, and `breadcrumbs` (with circular-reference protection).
  - Captures unexpected `5xx` errors (with `requestId`, `method`, scrubbed `path`, opaque `userId`) while skipping `4xx` client errors and preventing duplicate capture between `attachSentryErrorHandler(app)` and `errorHandler`.
- **Actionable Prometheus Alerts (`backend/observability/slo-rules.yml`)**:
  - Retains all existing error-budget burn (`MeowFastErrorBudgetBurn`, `MeowSlowErrorBudgetBurn`) and probe availability alerts.
  - Adds recording rules (`meow:write_latency:p95`, `meow:mongo_command_latency:p95`, `meow:nodejs_heap_growth_bytes_per_second:30m`) and 9 actionable alerts aligned to exported `meow_*` metrics:
    - `MeowReadApiLatencyHigh` (`meow:get_latency:p95 > 0.5` for `5m`, `page`)
    - `MeowWriteApiLatencyHigh` (`meow:write_latency:p95 > 0.8` for `5m`, `page`)
    - `MeowMongoPoolSaturation` (`max(meow_mongo_pool_waiting) > 5` for `2m`, `page`)
    - `MeowMongoCommandLatencyHigh` (`meow:mongo_command_latency:p95 > 0.25` for `5m`, `ticket`)
    - `MeowValkeyCircuitOpen` (`max(meow_redis_circuit_state) > 0` for `2m`, `page`)
    - `MeowValkeyLatencyHigh` (`meow:redis_latency:p95 > 0.1` for `5m`, `ticket`)
    - `MeowProcessRssSaturation` (`meow_process_resident_memory_bytes > 1258291200` [1.2 GiB] for `5m`, `page`)
    - `MeowSustainedHeapGrowth` (`deriv(meow_nodejs_heap_size_used_bytes[30m]) > 65536` and heap > `512 MiB` for `15m`, `ticket`)
    - `MeowEventLoopLagHigh` (`max by (instance) (meow_nodejs_eventloop_lag_p99_seconds) > 0.1` for `3m`, `page`)

---

## 5. Dependency Vulnerability Scan (`npm audit --audit-level=high`)

Executed read-only on `2026-11-22` **after** installing `@sentry/node@^11.16.0`:

```text
$ npm audit --audit-level=high
found 0 vulnerabilities

$ npm audit --workspace backend --audit-level=high
found 0 vulnerabilities

$ npm audit --workspace frontend --audit-level=high
found 0 vulnerabilities

$ npm audit --workspace @meow/contracts --audit-level=high
found 0 vulnerabilities
```

CI enforces these scans alongside Gitleaks secret scanning and CodeQL (`security-extended,security-and-quality`) on every pull request and `main` push (`.github/workflows/ci-verify.yml`, `.github/workflows/codeql.yml`).

---

## 6. Runtime Resilience, Graceful Shutdown & Disaster Recovery

### 6.1 HTTP Timeouts & Graceful Shutdown (`backend/middleware/requestTimeout.js`, `httpListen.js`, `index.js`)
- **Inbound Bounds:** `server.keepAliveTimeout = 65000ms`, `server.headersTimeout = 66000ms`, `server.requestTimeout = 60000ms` (`HTTP_REQUEST_TIMEOUT_MS`); route-level `requestTimeout()` attaches `req.abortSignal` / `res.locals.abortSignal` with `30s` standard / `60s` AI & upload deadlines (`504 REQUEST_TIMEOUT`), listening to `res.once('close')` and `req.once('aborted')` (Node 22 body-read safe).
- **Graceful Shutdown Sequence (`SHUTDOWN_TIMEOUT_MS=20000`):**
  1. `SIGTERM`/`SIGINT`/`uncaughtException`/`unhandledRejection` flips `isShuttingDown = true`, `isReady = false` → `/health` returns `503` and incoming requests receive `503 { ok: false, state: 'draining' }`.
  2. Stops optional services and drains embedded/attachment workers (`waitForAttachmentWorkerIdle(12_000)`).
  3. Broadcasts Socket.IO `server:shutdown` (`retryAfterMs: 3000`), waits `250ms`, and closes Socket.IO + HTTP server.
  4. Stops runtime metrics, closes Redis Pub/Sub subscribers, Battle Redis adapter, Valkey clients, MongoDB client, and flushes OpenTelemetry + Sentry (`globalThis.__shutdownTelemetry()`).

### 6.2 MongoDB Atlas Backup & Restore Drill Procedure (RPO/RTO Checklist)

> **Policy:** Never restore over production during a drill. Always restore into an isolated staging/DR cluster or database and record measured timestamps.

- **Target Objectives (Dedicated Atlas M10+ with Continuous Cloud Backup / PITR):**
  - **RPO (Recovery Point Objective):** `≤ 5 minutes` (with Atlas Continuous Backup / oplog PITR enabled) or `≤ 6 hours` (snapshot-only policy).
  - **RTO (Recovery Time Objective):** `≤ 30 minutes` from incident declaration to verified restored readiness.
- **Quarterly Restore Drill Checklist:**
  1. [ ] **Pre-Drill Snapshot Verification:** Confirm Atlas Continuous Backup + Point-in-Time Restore (PITR) is active and termination protection is enabled on the production cluster. Record `T0` (drill start UTC) and target recovery timestamp `T_target`.
  2. [ ] **Isolated Restore Execution:** Trigger an Atlas PITR restore of `quizDB` to `T_target` targeting the **isolated DR/staging cluster** (never production). Record `T_restore_complete`.
  3. [ ] **Schema & Index Integrity Verification:** Run `npm run db:migrate --workspace backend` against the restored URI (must report all `29` migrations applied with zero errors) and confirm `schemaMigrationLocks` is clean.
  4. [ ] **Application Readiness & Data Spot-Check:** Boot an isolated staging API pointed at the restored DB; verify `GET /health` returns `200 { ok: true, state: "ready" }`. Verify document counts and sample reads across `users`, `questions`, `mockSlots`, `mockAttempts`, `userQuestionProgress`, `trainingSessions`, and `battleProfiles`.
  5. [ ] **Synthetic Functional Verification:** Run an authenticated read + quiz session + mock attempt check on the restored staging instance; verify zero 5xx errors and valid `IXSCAN` performance.
  6. [ ] **Metrics & Sign-Off:** Record `Measured RPO = T_backup_latest - T_target`, `Measured RTO = T_verified - T0`, operator name, release SHA, and any runbook gaps in `docs/engineering/runbooks/staging-reliability-and-recovery.md`, then tear down/sanitize temporary DR credentials.
