# Deliverable 04 — Changes, Deployment & Rollback Runbook

**Release Scope:** Production Readiness Hardening (Milestones M1–M4 + k6 Load Suite)  
**Verified Against:** Repository `git status --short` on `2026-11-22`

---

## 1. Complete File-by-File Change Manifest (M1–M4)

### 1.1 Milestone M1 — Backend Auth, Security, Validation, Idempotency & HTTP Resilience
| File | Action | Summary of Change |
|---|---|---|
| `backend/auth/sessions.js` | Modified | Batched fast-path Redis lookups via `redisGetJsonMany` (1 `mGet` vs 3 `GET`s); halved fallback path to 1 `authorizationState` call (2 Mongo reads vs 4) preserving revocation fences |
| `backend/auth/passwordHash.js` | **New** | Bounded `worker_threads` bcrypt pool (max 4 `.unref()`ed workers, `AUTH_BCRYPT_WORKERS`) with cost-12 compatibility |
| `backend/auth/passwordWorker.js` | **New** | Worker thread script executing `bcryptjs.hash` / `bcryptjs.compare` off main event loop |
| `backend/auth/passport.js` | Modified | Switched to `verifyPassword` and lazy `getDummyPasswordHash()` |
| `backend/auth/requestOrigin.js` | Modified | Exported `isProductionCookieEnv()`; kept strict browser/cookie CSRF policy while allowing explicit `X-Client-Platform: k6\|native\|api` cookie-free requests |
| `backend/auth/oauthState.js` | Modified | Unified cookie security flag check via `isProductionCookieEnv()` |
| `backend/repositories/authLoginLockoutRepository.js` | **New** | Per-account login lockout (`5` failures → `15m` TTL) and email recovery quota (`60s` cooldown, `5/hr`) reusing `rateLimits` collection |
| `backend/repositories/authRegistrationRepository.js` | Modified | Hardened registration/recovery token handling & repository support |
| `backend/repositories/userRepository.js` | Modified | Added atomic `mutateUserBookmarks` CAS/tx helper keeping `bookmarks` and `bookmarkEntries` in sync |
| `backend/middleware/idempotency.js` | Modified | Removed `res.on('close')` pending lock deletion; marked `400` validation responses retryable |
| `backend/middleware/requestTimeout.js` | **New** | Route-level `AbortController` (`req.abortSignal` / `res.locals.abortSignal`), 30s std / 60s AI & uploads (`504 REQUEST_TIMEOUT`), Node 22 safe (`res.once('close')` + `req.once('aborted')`) |
| `backend/infrastructure/httpListen.js` | Modified | Added `server.requestTimeout` (`60000` ms default, `HTTP_REQUEST_TIMEOUT_MS`) |
| `backend/infrastructure/readiness.js` | Modified | Added single-flight 3s `checkReadiness()` cache (`READINESS_CACHE_TTL_MS`) and 60s `assertMigrations` cache |
| `backend/routes/auth.routes.js` | Modified | Wired login lockout (`429 ACCOUNT_LOCKED`), email recovery cooldowns (uniform `200`), OAuth callback `try/catch` redirect, `hashPassword`, unified cookie flags |
| `backend/routes/user.routes.js` | Modified | Added `idempotency` on `PATCH /users/me/progress` & `/usage`, Zod `validateBody` on `PUT /users/me/ai-chats/:chatId` |
| `backend/routes/questionRoutes.js` | Modified | Replaced catch-all 400 error swallower with Multer-scoped upload handler; added Zod param/query validation |
| `backend/routes/v1/quizSessionRoutes.js` | Modified | Moved `validateBody` before `idempotency` on create & submit |
| `backend/routes/mocktest.js` | Modified | Removed `.passthrough()` mass-assignment surfaces from Zod schemas |
| `backend/routes/notes.routes.js` | Modified | Added Zod `validateBody`/`validateParams` middleware |
| `backend/routes/training.js` | Modified | Added `aiAdmission` on `/diagnosis` + Zod param/query validation |
| `backend/routes/aiRoutes.js` | Modified | Added `idempotency` on `/diagram`, `/explain`, and JSON `/tutor-chat` |
| `backend/controllers/userController.js` | Modified | Switched `updateBookmarks` to atomic `mutateUserBookmarks` |
| `backend/controllers/imageQuestionController.js` | Modified | Wrapped `JSON.parse(optionRegions)` in `try/catch` returning `400` |
| `backend/services/tutorChatService.js` | Modified | Added `<student_context>` / `<student_question>` structural delimiters & system instruction hierarchy |
| `backend/auth/__tests__/m1.authResilience.test.js`, `backend/middleware/__tests__/m1.idempotencyAndTimeout.test.js`, `backend/middleware/__tests__/requestTimeout.test.js`, `backend/routes/__tests__/m1.routeHardening.test.js` (+ updated existing auth/route tests) | **New** / Modified | Unit & integration regression suites covering M1 |

### 1.2 Milestone M2 — MongoDB Queries, Indexes, Valkey & Battle Scaling
| File | Action | Summary of Change |
|---|---|---|
| `backend/migrations/029-production-scale-indexes.js` (+ `029-load-readiness-indexes.js` shim) | **New** | ESR-aligned `questions` ring-scan indexes, partial battle leaderboard indexes (`gamesPlayed >= 1` / `>= 5`), safe drop of superseded/prefix-duplicate indexes |
| `backend/migrations/runner.js` | Modified | Registered migration `029` |
| `backend/services/questions/questionCache.js` | Modified | Unified `isNormalizedQuestionKeysEnabled()` default to `true` (`!== 'false'`) |
| `backend/services/questions/questionCursorService.js` | Modified | Switched cursor queries to normalized keys, bounded search (120 chars), added `maxTimeMS: 5000` |
| `backend/services/questions/quizSessionV1Service.js` | Modified | Removed hardcoded prod cursor secret fallback; gated `$or` unnormalized fallback behind `QUESTIONS_ALLOW_UNNORMALIZED_FALLBACK === 'true'` |
| `backend/services/mock/mockPaperService.js` | Modified | Gated `$or` unnormalized fallback behind `QUESTIONS_ALLOW_UNNORMALIZED_FALLBACK === 'true'` |
| `backend/services/questions/questionReadService.js` & `backend/controllers/questionController.js` | Modified | Added cursor-based `iterateExportCursor` (`batchSize(250)`, `maxTimeMS(30_000)`) streaming NDJSON with backpressure |
| `backend/services/questions/questionIdentity.js`, `questionSessionService.js`, `questionWriteService.js`, `services/quizAnswerService.js`, `repositories/mockTestRepository.js`, `questionProgressRepository.js`, `trainingRepository.js` | Modified | Normalized key consistency & query optimization alignment |
| `backend/controllers/mockTestController.js` | Modified | Switched `startMockTest` to `fetchCachedSlotById(examSlug, testId)` |
| `backend/services/mock/mockGradingService.js` | Modified | Cached percentile counts via `percentileCountCache` (45s/60s) + `maxTimeMS: 2000` |
| `backend/repositories/battleRepository.js` & `backend/controllers/battleController.js` | Modified | Added `battleLeaderboardCache` (30s TTL + singleflight), strict projections, `maxTimeMS: 3000`, and `.limit()` bounds |
| `backend/services/battleQuestionDeadlineWorker.js`, `battlePresenceWorker.js`, `battleResultWorker.js` | Modified | Added distributed worker lease locking (Redis `SET NX PX` + Mongo fallback), multi-batch draining (up to 500 rooms/tick), `user:${userId}` `game:end` parity |
| `backend/battle/battleSocket.js`, `battleReadiness.js`, `redisSocketAdapter.js` | Modified | Preserved `CORS_ALLOWED_ORIGINS` in Socket.IO CORS (`buildSocketCorsOrigins`) and aligned Redis connect timeout |
| `backend/controllers/adminUsers.controller.js` & `backend/repositories/adminUserRepository.js` | Modified | Switched to `users_text_search`/anchored prefix (`maxTimeMS: 3000`) and covered bounded `findAndroidUserIds` (`limit(5000)`) |
| `backend/config/redis.js` | Modified | Raised default `REDIS_CONNECT_TIMEOUT_MS` (`3000`) and `REDIS_COMMANDS_QUEUE_MAX` (`4096`) |
| `backend/infrastructure/durableProgressCache.js` | Modified | Added fail-closed `withCounterDeadline(1500ms)` + 1.5s local grace window for Redis blips |
| `backend/scripts/audit-db-explain.js` & `backend/test-results/db-explain-audit.json` | **New** | Reproducible offline `MongoMemoryReplSet` `explain("executionStats")` audit proving `22/22` `IXSCAN`, `0` `COLLSCAN` |
| `backend/services/__tests__/m2ProductionReadiness.test.js` (+ updated migration/question/battle/redis tests) | **New** / Modified | Regression suites covering M2 |

### 1.3 Milestone M3 — Frontend Security, Reliability & Mobile Performance
| File | Action | Summary of Change |
|---|---|---|
| `frontend/app/(app)/battle/rewards/page.tsx`, `frontend/lib/api/battleRewardApi.ts`, `page.test.tsx` | Modified / **New** | Auth readiness gate, `AbortController`, `role="alert"` error/retry UI, synchronous `claimingRef` lock, `Idempotency-Key` |
| `frontend/lib/early-session.ts`, `frontend/lib/axios.ts`, `early-session.test.ts` (+ E2E fixture sync) | Modified | Added `meow_has_session` hint; eliminated pre-hydration guest & auth-route `POST /auth/refresh` storms |
| `frontend/app/(app)/layout.tsx`, `frontend/context/NotificationCenterContext.tsx`, `frontend/app/(app)/notifications/page.tsx` | Modified | Mounted `NotificationCenterProvider` with visibility-aware REST polling (no eager Socket.IO); removed auto-mark-all-read on mount; added `markingAllRef` lock |
| `frontend/app/(app)/ai-chat/page.tsx`, `frontend/components/QuizChatbot/index.tsx`, `frontend/features/tutor/api/tutorGateway.ts` | Modified | Added synchronous `sendingRef` double-submit lock, `AbortController` on unmount/"New chat", and `Idempotency-Key` on text `/api/ai/tutor-chat` |
| `frontend/components/auth/AuthGate.tsx`, `AuthGate.test.tsx` | Modified / **New** | Renders accessible loading shell during `!isPublic && loading` so protected child effects wait for auth hydration |
| `frontend/next.config.ts`, `frontend/lib/security/csp.ts`, `csp.test.ts` | Modified | Removed duplicate Report-Only CSP, added HSTS / `X-Frame-Options` / `Permissions-Policy`, pruned unused CDNs, guarded `NEXT_PUBLIC_ADMIN_SECRET` |
| `frontend/app/api/upload-image/route.ts`, `route.test.ts` | Modified / **New** | 10 MB upload limit (`413`), `req.signal` & `X-Request-ID` forwarding, safe non-JSON 502/504 handling |
| `frontend/components/ai/VisualResponse.tsx`, `HomeStaticContent.tsx`, `app/layout.tsx`, `resource/page.tsx`, `hooks/useBattle.ts`, `admin/battle-integrity/page.tsx` | Modified | Memoized `extractVisuals` + `MathText` table cells, lazy dark hero, deduplicated Bengali fonts, `/resource` abort + per-file lock, `battle:resume`-first reconnect, admin integrity busy/pagination |
| `frontend/app/(app)/{mock-test,battle,play,profile,notifications,resource}/error.tsx`, `frontend/app/(admin)/error.tsx` | **New** (7 files) | Segment error boundaries matching `RouteErrorState` theme contracts |

### 1.4 Milestone M4 — Backend Sentry, Prometheus Alerts, CI/CD & Production Docs (plus k6 Suite)
| File | Action | Summary of Change |
|---|---|---|
| `backend/package.json`, `package-lock.json` | Modified | Installed `@sentry/node@^11.16.0` (0 vulnerabilities) |
| `backend/infrastructure/sentry.js` & `backend/infrastructure/__tests__/sentry.test.js` | **New** | Opt-in Sentry SDK init (`SENTRY_DSN`), `scrubSentryEvent` PII/header redactor, `attachSentryErrorHandler`, `captureException`, `flushSentry` + unit tests |
| `backend/instrumentation.js`, `backend/middleware/errorHandler.js`, `backend/app.js` | Modified | Wired `initSentry()` + `flushSentry()`, hooked `attachSentryErrorHandler(app)` before `errorHandler`, captured unexpected `5xx` errors in `errorHandler` |
| `backend/observability/slo-rules.yml` | Modified | Added 3 recording rules and 9 saturation/latency Prometheus alerts (Read/Write p95, Mongo pool & p95, Valkey circuit & p95, RSS, sustained heap growth, event-loop lag) |
| `.github/workflows/main_quizguru-backend.yml`, `.github/workflows/main_quizguru-backend-staging.yml` | Modified | Configured `QUESTIONS_NORMALIZED_KEYS`, `RUN_EMBEDDED_WORKERS`, `BATTLE_REDIS_ADAPTER`, `REDIS_CONNECT_TIMEOUT_MS`, `HTTP_REQUEST_TIMEOUT_MS` with multi-instance scaling vars & dynamic worker readiness check (preserving all CI/CD security assertions) |
| `backend/.env.example`, `frontend/.env.example` | Modified | Documented all new runtime, timeout, Valkey, Sentry, and server-only secret variables |
| `docs/production-readiness/01..04-*.md` | **New** (4 files) | Production Readiness Deliverables 01–04 |
| `load-tests/k6/**`, `.gitignore` | Modified / **New** | Modular staged k6 suite (auth, health, catalog/question-delivery, quiz-session, user-progress, mixed-workload) |

---

## 2. Required Environment Variables Matrix

### 2.1 Backend — Azure App Service (`quizguru-backend` / Workers)
| Variable | Single-Instance Default | Multi-Instance 1,000-VU Target | Notes |
|---|---|---|---|
| `NODE_ENV` | `production` | `production` | Required by `validateEnvironment()` |
| `DEPLOYMENT_ENVIRONMENT` | `production` / `staging` | `production` / `staging` | Must match target environment |
| `PROCESS_ROLE` | `api` | `api` (web), `worker` (worker), `attachments` (ocr/pdf) | Role-enforced at boot |
| `MONGODB_URI`, `MONGODB_DB` | Atlas SRV URI, `quizDB` | Dedicated Atlas M10–M30 | Secret (`quizDB_staging` on staging) |
| `MONGO_MAX_POOL_SIZE` / `MONGO_MIN_POOL_SIZE` | `50` / `5` | `40`–`50` / `5` per API replica | Budget total conns < 80% Atlas limit |
| `JWT_SECRET`, `REFRESH_TOKEN_SECRET` | 32+ char distinct random secrets | Same (rotated via secrets store) | Must differ (`validateEnvironment()`) |
| `QUIZ_CURSOR_SECRET` | Optional (falls back to `JWT_SECRET`) | Dedicated 32+ char random secret | Required in prod alongside `JWT_SECRET` |
| `QUESTIONS_NORMALIZED_KEYS` | `true` | `true` | Run `db:normalize -- --verify` before first enable |
| `QUESTIONS_ALLOW_UNNORMALIZED_FALLBACK` | `false` | `false` | Keep `false` for pure `IXSCAN` |
| `AUTH_BCRYPT_WORKERS` | `true` | `true` | Offloads cost-12 bcrypt to worker_threads |
| `REDIS_URL`, `REDIS_NAMESPACE` | `rediss://...`, `meow:prod` | Aiven Valkey TLS, `meow:prod` (`meow:staging` on staging) | Required for shared cache, rate-limits & invalidation |
| `REDIS_CONNECT_TIMEOUT_MS` / `REDIS_COMMAND_TIMEOUT_MS` / `REDIS_COMMANDS_QUEUE_MAX` | `3000` / `1000` / `4096` | `3000` / `1000` / `4096`–`8192` | Tuned for remote Aiven TLS handshakes |
| `RUN_EMBEDDED_WORKERS`, `RUN_CONCEPT_GROUPING_WORKER` | `true`, `true` | **`false`, `false` on API** (`worker.js` owns jobs) | Set via GitHub repo vars `RUN_EMBEDDED_WORKERS` |
| `BATTLE_REDIS_ADAPTER`, `BATTLE_REDIS_CRITICAL` | `false`, `false` | **`true`, `true`** (when >1 API replica) | Enables Socket.IO Redis Streams fanout |
| `USE_DURABLE_QUEUE`, `QUEUE_REDIS_URL`, `QUEUE_REDIS_NAMESPACE` | `false` | `true` **only** with separate `noeviction` persistent Redis | Startup validates `maxmemory-policy=noeviction` |
| `HTTP_REQUEST_TIMEOUT_MS` / `HTTP_ROUTE_TIMEOUT_MS` / `HTTP_AI_REQUEST_TIMEOUT_MS` | `60000` / `30000` / `60000` | `60000` / `30000` / `60000` | Paired with `HTTP_KEEP_ALIVE_TIMEOUT_MS=65000` |
| `READINESS_CACHE_TTL_MS` | `3000` | `3000` | Coalesces `/health` Mongo probes |
| `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` | Secret DSN, `0` (or `0.05`–`0.1`) | Secret DSN, `0`–`0.1` | Empty disables cleanly |
| `METRICS_TOKEN` | Secret bearer token | Secret bearer token | Required for Prometheus `/metrics` scrape |
| `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` | `https://meowguru.me` | Explicit comma-separated allowlist | Shared across Express & Socket.IO CORS |
| `AZURE_OPENAI_KEY` / `OPENAI_API_KEY`, `AZURE_TTS_*`, `AZURE_TRANSLATOR_*`, `RESEND_API_KEY`, `B2_*`, `CONVEX_JWT_*` | Provider secrets | Provider secrets | Stored in Azure App Settings / Key Vault only |

### 2.2 Frontend — Vercel
| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Public | `/backend-api` (uses Next.js rewrite to `API_URL`) |
| `API_URL` | Server-only | Backend origin (e.g., `https://quizguru-backend.azurewebsites.net`) |
| `NEXT_PUBLIC_SOCKET_URL` | Public | Backend WebSocket origin for lazy `/battle` Socket.IO |
| `SESSION_SECRET`, `ACCESS_CODE_SECRET`, `ADMIN_SECRET` | **Server-only** | Used by `proxy.ts` & `/api/access-code/verify`. **NEVER set `NEXT_PUBLIC_ADMIN_SECRET`.** |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Public DSN / Server upload token | Enables `@sentry/nextjs` + `/monitoring` tunnel + source maps |
| `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_AUTH_ENABLED` | Public | Never set `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` in production |

---

## 3. Production Deployment Runbook (Ordered Steps)

### Step 1 — Pre-Release Verification & Database Preparation
1. Ensure CI quality gate (`.github/workflows/ci-verify.yml`) is green on `refs/heads/main` (includes `promtool check/test rules`, real Redis integration tests, `npm audit --audit-level=high`, Gitleaks, frontend build + performance budget + `check:interface`).
2. Verify normalized question keys on the target database **before** switching `QUESTIONS_NORMALIZED_KEYS=true` for the first time:
   ```bash
   # Dry run first, inspect counts:
   npm run db:normalize --workspace backend
   # Apply backfill if candidates > 0:
   npm run db:normalize --workspace backend -- --apply
   # Verify 0 remaining unnormalized documents (must exit 0):
   npm run db:normalize --workspace backend -- --verify
   ```
3. Run additive migrations (`001`–`029`) — also executed automatically by `main_quizguru-backend.yml` before traffic cutover:
   ```bash
   npm run db:migrate --workspace backend
   npm run db:initialize-public-catalog --workspace backend
   ```
   *(Migration `029` creates new ESR ring-scan and partial leaderboard indexes BEFORE dropping superseded indexes, avoiding any unindexed window.)*

### Step 2 — Deploy Backend (Single-Instance or Decoupled Multi-Instance)
- **Single-Instance (Current Default):** Trigger `.github/workflows/main_quizguru-backend.yml` from `refs/heads/main` (defaults: `QUESTIONS_NORMALIZED_KEYS=true`, `RUN_EMBEDDED_WORKERS=true`, `BATTLE_REDIS_ADAPTER=false`, `REDIS_CONNECT_TIMEOUT_MS=3000`, `HTTP_REQUEST_TIMEOUT_MS=60000`).
- **Multi-Instance Horizontal Scale (>1 API Replica):**
  1. Provision and start dedicated worker containers from `backend/Dockerfile.worker` (`PROCESS_ROLE=worker npm run start:worker`) and attachment worker (`PROCESS_ROLE=attachments npm run start:attachments`) pointing at production Atlas + Aiven Valkey. Confirm worker health logs.
  2. Set GitHub Repository Variables: `RUN_EMBEDDED_WORKERS=false`, `RUN_CONCEPT_GROUPING_WORKER=false`, `BATTLE_REDIS_ADAPTER=true`, `QUESTIONS_NORMALIZED_KEYS=true`, `REDIS_CONNECT_TIMEOUT_MS=3000`, `HTTP_REQUEST_TIMEOUT_MS=60000`.
  3. Configure `SENTRY_DSN`, `METRICS_TOKEN`, `REDIS_URL`, `REDIS_NAMESPACE=meow:prod`, and `BATTLE_REDIS_CRITICAL=true` in Azure App Service settings.
  4. Scale App Service Plan to `P1v3`/`P2v3` (2–3 instances), disable ARR Affinity, keep Always On enabled, and deploy via `main_quizguru-backend.yml` (or canary slot via `backend-canary-promotion.yml`).

### Step 3 — Deploy Frontend (Vercel) & Post-Deploy Smoke Checks
1. Confirm `NEXT_PUBLIC_ADMIN_SECRET` and `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` are **absent** from Vercel Production env vars, and `SESSION_SECRET`/`ACCESS_CODE_SECRET`/`ADMIN_SECRET`/`API_URL` are set server-only.
2. Deploy frontend from `main`.
3. Verify post-deploy health & telemetry:
   - `GET https://<api-host>/health` → `200`, `ok: true`, `releaseId == <sha>`, `environment == "production"`, `dependencies.mongo == "healthy"`, `dependencies.redis == "healthy"`, `dependencies.battle == "healthy"`, `dependencies.workers == "healthy"` (single-instance) or `"disabled"` (decoupled).
   - `GET https://<api-host>/metrics` with `Authorization: Bearer <METRICS_TOKEN>` → `200` exporting `meow_http_duration_seconds`, `meow_mongo_pool_waiting`, `meow_redis_circuit_state`, `meow_nodejs_eventloop_lag_p99_seconds`.
   - Verify Prometheus alert rules loaded (`slo-rules.yml`) and Sentry receives a controlled non-PII test event tagged with `releaseId`.
   - Verify browser response headers on Vercel include enforcing `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, and `Permissions-Policy` (no duplicate Report-Only header).

---

## 4. Rollback Procedures

### 4.1 Canary Slot Rollback (Standard/Premium App Service)
1. When deploying via `.github/workflows/backend-canary-promotion.yml`, 5% traffic is evaluated for 300s by `backend/scripts/evaluate-canary.js`. Any SLO breach, missing metric, or stale observation automatically resets canary traffic routing to `0%` and aborts promotion.
2. If an issue surfaces immediately after slot swap:
   ```bash
   # Verify currently serving releaseId first so a failed swap is not reversed into the bad build:
   curl -sS https://<api-host>/health | jq '{releaseId, state, ok}'
   # Swap Production <-> Canary slot back to the verified prior release:
   az webapp deployment slot swap --resource-group Meowguru_group --name quizguru-backend --slot canary --target-slot production
   ```

### 4.2 Instant Feature-Flag & Runtime Rollbacks (Zero Redeploy)
| Symptom | Instant Mitigation (Azure App Settings) | Effect |
|---|---|---|
| Missing questions due to incomplete legacy normalization | Set `QUESTIONS_ALLOW_UNNORMALIZED_FALLBACK=true` (or `QUESTIONS_NORMALIZED_KEYS=false`) & restart | Re-enables legacy unnormalized query branches while `db:normalize -- --apply` completes |
| Worker-thread memory/compatibility anomaly during login | Set `AUTH_BCRYPT_WORKERS=false` | Falls back immediately to async `bcryptjs` on main thread |
| Valkey Streams adapter instability on Battle Socket.IO | Set `BATTLE_REDIS_ADAPTER=false` and `BATTLE_REDIS_CRITICAL=false` | Falls back to MongoDB Socket.IO adapter |
| Sentry noise or quota spike | Clear `SENTRY_DSN` (empty string) | `initSentry()` becomes a zero-overhead no-op |
| Durable BullMQ queue degradation | Set `USE_DURABLE_QUEUE=false` | Reverts scheduled maintenance to in-process interval scheduler |
| Aggressive overload shedding during burst | Set `USE_OVERLOAD_SHEDDING=false` | Disables optional-route 503 load shedding |

### 4.3 Safe Database Migration Policy
- **Expand → Backfill → Cutover → Contract:** Migrations `001`–`029` are strictly backward-compatible and additive (no collections or user data are dropped). **Never drop collections, documents, or security indexes as an application rollback shortcut.**
- **Security Rollback Boundary:** Never roll back to a pre-revocation or pre-confidential-mock API build that ignores `authSessions` revocation or exposes unpublished mock paper answer keys; prefer a forward fix or flag toggle.
- **Stale Migration Lock Recovery:** If a migration runner crashes mid-run, first verify no active `createIndexes` command is running in MongoDB Atlas (`db.currentOp()`), and only then remove the stale `{ _id: "migrations" }` document from `schemaMigrationLocks` before re-running `npm run db:migrate --workspace backend`.
