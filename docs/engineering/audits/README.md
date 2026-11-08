# Central Engineering Audit Index

This document is the **single source of truth** for all security, backend, frontend, performance, and reliability audits in the Meow Guru repository. It distinguishes verified remediations from open findings and staging/production release gates so developers never confuse historical reports with the current repository state.

---

## 1. Current Audit Posture Summary

| Audit Domain | Latest Audit Date | Latest Audited / Remediation Commit | Current Verified Status | Open Findings / Pending Gates |
| :--- | :--- | :--- | :--- | ---: |
| **Security** | 2026-11-07 | Base `0a1621de` → Fixed `08363405` (plus `9c9eb3ec`) | **0 open findings from the reviewed audit scope** (`VULN-01`–`VULN-10` + 3 dependency CVEs verified with regression suites) | **0** *(within reviewed scope)* |
| **Backend** | 2026-10-07 | `95e907e3` (Redis A–C), `5d47b48e` (Battle matrix) | All 21 Redis correctness/hardening/resilience priorities verified in local disposable Mongo/Redis fault suites | **3** *(staging/load gates & design risk)* |
| **Frontend** | 2026-10-22 | `ce6cfa3d`, `22d12ba9`, `6740e0ab`, `9c9eb3ec` | 32-route light/dark contrast & overflow checks, responsive mock/result layouts, and 180 KB gzipped quiz bundle budgets passing | **1** *(mobile quiz resume TBT)* |
| **Performance** | 2026-10-21 | `331d261f`, `5021c661`, `3ff7a80b` | Request-flow Batches A–D (`F2`–`F17`) implemented and verified locally; Lighthouse TBT (<200ms on 5/6 routes) and CLS (<0.1) passing | **5** *(mobile LCP >2.5s, cold startup, SSR, live Atlas/F1)* |
| **Reliability** | 2026-10-21 | `331d261f`, `83043cf6`, `020bc838`, `2f159279` | CI split quality gates, Azure B1 Always On full runtime (`4b2d13cd`), and local replica-set/socket recovery verified | **5** *(staging load, OTLP alerts, canary slot, Android & Battle launch checklists)* |

> [!IMPORTANT]
> **Scope Note on Security Status:** "0 open findings from the reviewed audit scope" applies specifically to the 10 application/CI vulnerabilities (`VULN-01` through `VULN-10`) audited on baseline `0a1621de` and the 3 dependency advisories patched on `3ff7a80b` → `9c9eb3ec`. It is not a blanket claim that the entire application or cloud environment has zero vulnerabilities.

---

## 2. Security Audits

###Active Reports
- [2026-11-07 Zero-Regression P0, P1 & P2 Security Hardening Audit](./security/2026-11-07-zero-regression-hardening-audit.md)
- [2026-11-07 Security Hardening Project Plan & Milestone Matrix](./security/2026-11-07-security-hardening-project-plan.md)

### Archived Evidence
- [2026-10-08 CI Security & Quiz Bundle Fix](./archive/2026-10-08-ci-security-and-bundle-fix.md)

### Finding Ledger — Security

| Finding ID | Severity | Audit Date | Audited Commit | Summary | Status | Remediation Commit | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `VULN-01` | **Critical (P0)** | 2026-11-07 | `0a1621de` | Public question read endpoints leaked `correctAnswer`, `solution`, `translations.*.solution`, and ingestion hashes | **Verified** | `08363405` | `backend/tests/security/vuln01-question-exposure.regression.test.js` (81 tests) |
| `VULN-02` | **Critical (P0)** | 2026-11-07 | `0a1621de` | Access-code gate (`frontend/proxy.ts`) checked cookie presence without HMAC signature/expiry; shared `JWT_SECRET` fallback | **Verified** | `08363405` | `frontend/proxy.test.ts`, `backend/tests/security/vuln02-access-code.regression.test.js` (115 tests) |
| `VULN-03` | **Critical (P0)** | 2026-11-07 | `0a1621de` | `POST /api/pdfs` exempted from rate limiter, buffered up to 6 GB in RAM, and allowed `.html` without `%PDF-` magic-byte checks | **Verified** | `08363405` | `backend/tests/security/vuln03-pdf-upload.regression.test.js` (13 tests) |
| `VULN-04` | **Critical (P0)** | 2026-11-07 | `0a1621de` | `POST /api/ai/explain` bypassed `reserveTutorUsage` quota, lacked prompt/options bounds, and threw unhandled `TypeError` | **Verified** | `08363405` | `backend/tests/security/vuln04-ai-quota.regression.test.js` (7 tests) |
| `VULN-05` | **High (P1)** | 2026-11-07 | `0a1621de` | Post-login open redirect via unsanitized `redirect`/`next` query parameter in `frontend/app/(auth)/login/page.tsx` | **Verified** | `08363405` | `frontend/app/(auth)/login/vuln05-open-redirect.regression.test.tsx` (7 tests) |
| `VULN-06` | **High (P1)** | 2026-11-07 | `0a1621de` | Arbitrary B2 object key proxy in `serveImage` and unbounded `sharp` pixel decoding in `imageQuestionController.js` | **Verified** | `08363405` | `backend/tests/security/vuln06-image-upload.regression.test.js` (6 tests) |
| `VULN-07` | **High (P1)** | 2026-11-07 | `0a1621de` | Mass assignment & `ownerUserId` leak in `/api/notes`; unvalidated `sectionTimers` in `mockTestController.js` | **Verified** | `08363405` | `backend/tests/security/vuln07-mass-assignment.regression.test.js` (3 tests) |
| `VULN-08` | **High (P1)** | 2026-11-07 | `0a1621de` | Battle Socket.IO allowed `localhost` CORS in production, per-socket rate limits, replayable `rematchToken`, premature opponent lock | **Verified** | `08363405` | `backend/tests/security/vuln08-battle-socket.regression.test.js` (4 tests) |
| `VULN-09` | **Medium (P2)** | 2026-11-07 | `0a1621de` | Report-only CSP, unbounded `loginSchema.password`, missing 72-byte UTF-8 check on `registerSchema`, array query type confusion & raw 500 errors | **Verified** | `08363405` | `backend/tests/security/vuln09-hardening.regression.test.js` (5 tests) |
| `VULN-10` | **Medium (P2)** | 2026-11-07 | `0a1621de` | Missing `refs/heads/main` guard on production `workflow_dispatch`, unpinned Prometheus image tag, and partial workspace `npm audit` | **Verified** | `08363405` | `backend/tests/security/vuln10-cicd-hardening.regression.test.js` (3 tests) |
| `DEP-CVE-01` | **High** | 2026-10-08 | `3ff7a80b` | Next.js (`GHSA-3w37-wq28-93x7`), KaTeX (`GHSA-238p-pmpm-9mq7`), and `shell-quote` (`GHSA-pqg4-j6r4-53mv`) dependency advisories | **Verified** | `9c9eb3ec` | `npm audit --audit-level=high` across root, `frontend`, `backend`, and `@meow/contracts` (0 vulnerabilities) |

---

## 3. Performance Audits

### Active Reports
- [2026-10-21 Lighthouse & Render-Path Performance Audit](./performance/2026-10-21-lighthouse-and-render-path-audit.md)
- [2026-10-08 Request-Flow Baseline Audit (`F1`–`F17`)](./performance/2026-10-08-request-flow-audit.md)
- [2026-10-08 Request-Flow Remaining Work & Authorization Probes](./performance/2026-10-08-request-flow-remaining-and-auth-probes.md)

### Archived Evidence
- [2026-10-08 Request-Flow Batch A (`F6`, `F8`, `F12`, `F15`)](./archive/2026-10-08-request-flow-batch-a.md)
- [2026-10-08 Request-Flow Batch B (`F2`, `F3`, `F7`, `F16`)](./archive/2026-10-08-request-flow-batch-b.md)
- [2026-10-08 Request-Flow Batch C (`F4`, `F5`, `F9`, `F17`)](./archive/2026-10-08-request-flow-batch-c.md)
- [2026-10-08 Request-Flow Batch D (`F4`, `F10`–`F14`)](./archive/2026-10-08-request-flow-batch-d.md)
- [2026-10-08 Request-Flow Local Latency Check](./archive/2026-10-08-request-flow-latency-check.md)

### Finding Ledger — Performance

| Finding ID | Severity | Audit Date | Audited Commit | Summary | Status | Remediation Commit | Verification Evidence / Next Steps |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PERF-LCP-01` | **High** | 2026-10-21 | `331d261f` | Mobile Lighthouse median LCP exceeds 2,500ms target across 6 audited routes (`/login` 3,077ms, `/mathematics` 3,904ms, `/play` 3,444ms, `/play/session/*` 3,525–3,641ms, `/quiz?resume=1` 3,770–3,892ms, `/mock-test/*/attempt` 3,676–3,738ms); LHCI remains in `warn` mode | **Open** | Partial in `331d261f` (Math image transfer reduced 86%) | Documented in [2026-10-21 Lighthouse Audit](./performance/2026-10-21-lighthouse-and-render-path-audit.md); requires shortening first-question/attempt render path before switching LHCI to `error`. |
| `PERF-SSR-01` | **Medium** | 2026-10-21 | `331d261f` | Private question SSR is unimplemented because browser auth exchanges an `HttpOnly` refresh cookie that rotates on use | **Open** | — | Requires a verified server-readable session design and safe data handoff ([2026-10-21 Lighthouse Audit §Render-path](./performance/2026-10-21-lighthouse-and-render-path-audit.md)). |
| `PERF-STARTUP-01` | **Medium** | 2026-10-08 | `8a65e94d` / `3ff7a80b` | Cold Next.js process startup to first `/play` response headers measured 1,180–1,224ms (median 1,183ms) against 800ms benchmark target (warm headers: 18–27ms) | **Open** | — | Documented in [2026-10-08 Latency Check](./archive/2026-10-08-request-flow-latency-check.md); reproducible via `npm run test:performance:startup`. |
| `PERF-F1-01` | **High** | 2026-10-08 | `8a65e94d` / `5021c661` | Every distinct protected authorization burst performs 2 MongoDB reads (`authSessions` + `users`) on L1 hit and 4 on L1 miss to enforce immediate revocation/role correctness | **Open** *(Instrumented)* | `5021c661` (Prometheus histograms & `test:probe:authorization` added) | Requires replica-aggregated command QPS and Atlas Namespace Insights p95 measurement before altering auth caching ([Remaining Work §F1](./performance/2026-10-08-request-flow-remaining-and-auth-probes.md)). |
| `PERF-ATLAS-01` | **Medium** | 2026-10-08 | `9c9eb3ec` / `5021c661` | Production before/after browser waterfalls, live release catalog initialization (`F5`), pending concept-group frequency (`F3`), and deployed migration `018` verification (`F16`) | **Open** *(Pending Env)* | `5021c661` (Capture & compare scripts ready) | Pending production/staging URLs, dedicated synthetic account, and replica log export ([Remaining Work](./performance/2026-10-08-request-flow-remaining-and-auth-probes.md)). |
| `PERF-F2-F17` | **High → Low** | 2026-10-08 | `8a65e94d` | 16 request-flow inefficiencies (`F2` atomic quiz answer command, `F3` concept-group cache & status polling, `F4` public/private progress split, `F5` catalog prewarm/SWR, `F6` Firebase session reuse, `F7` scoped AI-chat queries, `F8`/`F12` training startup & deadline cache, `F9` parallel backend reads, `F10` abortable mock queries, `F11` single profile retry budget, `F13` demand-driven solution translation, `F14` guarded prefetch, `F15` single-POST mock start, `F16` projected read-only mock catalog, `F17` unblocked public quiz reads) | **Verified** *(Local)* | `3ff7a80b`, `5021c661` | 123 backend test files (732 tests), 108 frontend test files (507 tests), and 18 desktop/mobile Playwright request-flow E2E tests passing. |

---

## 4. Backend Audits

### Active Reports
- [2026-10-07 Redis Operational Resilience — Phase C Audit](./backend/2026-10-07-redis-phase-c-resilience-audit.md)
- [2026-09-08 Battle Production Test Matrix](./backend/2026-09-08-battle-production-test-matrix.md)

### Archived Evidence
- [2026-10-07 Redis Correctness Remediation — Phase A](./archive/2026-10-07-redis-phase-a-correctness-remediation.md)
- [2026-10-07 Redis Hardening — Phase B](./archive/2026-10-07-redis-phase-b-hardening.md)

### Finding Ledger — Backend

| Finding ID | Severity | Audit Date | Audited Commit | Summary | Status | Remediation Commit | Verification Evidence / Next Steps |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REDIS-P1-P21` | **High** | 2026-10-07 | `95e907e3` | 21 Redis audit items across Phase A (session/progress revision checks, subscriber reconnect, Lua fixed-window rate limits, snapshot TTL), Phase B (UUID lock fencing, stampede coalescing, canonical keys, circuit breaker, transactional notification revisions), and Phase C (optional startup isolation, BullMQ Lua admission quotas, queue/cache host isolation, multi-process fault suite) | **Verified** *(Local + CI)* | `95e907e3` | 120 backend test files (702 tests, 0 skipped) with `REDIS_TEST_URL` and `REDIS_FAULT_TEST_BIN` (Redis 7.4.3) passing. |
| `REDIS-STG-01` | **High** | 2026-10-07 | `95e907e3` | Deployed two-instance staging verification of Redis outage/recovery, provider failover/RPO, cross-instance session revocation during subscriber loss, and worker kill/recovery | **Open** *(Staging Gate)* | — | Required before enabling `USE_DURABLE_QUEUE=true` in production ([Redis Phase C §Staging Test Required](./backend/2026-10-07-redis-phase-c-resilience-audit.md)). |
| `REDIS-DR-01` | **Medium** | 2026-10-07 | `95e907e3` | Outage rate-limit quotas are local per API instance; multi-key Lua scripts assume standalone Redis (Redis Cluster cross-slot behavior is unsupported); BullMQ deduplication requires idempotent handlers | **Accepted Risk / Design Constraint** | `95e907e3` | Documented in [Redis Phase C §Design Risk](./backend/2026-10-07-redis-phase-c-resilience-audit.md). |
| `BATTLE-TM-01` | **Medium** | 2026-09-08 | `5d47b48e` / `83043cf6` | Battle production test matrix open environment gates: SIGTERM under active-battle load/restart drill and staged remote socket load test | **Open** *(Staging Gate)* | Local 20/100-player burst tests added in `83043cf6` | Tracked in [Battle Test Matrix](./backend/2026-09-08-battle-production-test-matrix.md) and [Battle Launch Checklist](./reliability/2026-10-15-battle-production-launch-checklist.md). |

---

## 5. Frontend Audits

### Active Reports
- [Frontend Audits & Design System Index](./frontend/README.md)
- [2026-10-22 Frontend Theme, Responsive Layout & UI Verification Audit](./frontend/2026-10-22-frontend-theme-and-layout-audit.md)

### Archived Evidence
- [2026-08-18 KaTeX MathRenderer Memoization Note](./archive/2026-08-18-katex-mathrenderer-memoization-note.md)
- [2026-10-08 CI Security & Quiz Bundle Fix](./archive/2026-10-08-ci-security-and-bundle-fix.md)

### Finding Ledger — Frontend

| Finding ID | Severity | Audit Date | Audited Commit | Summary | Status | Remediation Commit | Verification Evidence / Next Steps |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FE-BUNDLE-01` | **High** | 2026-10-08 | `3ff7a80b` | 7 quiz route entry bundles exceeded the 180,000-byte gzip budget (~211 KB) due to importing `quizCorrectIndex` from `@meow/contracts/questions` (which pulled in Zod schemas) | **Verified** | `9c9eb3ec` | Extracted dependency-free `@meow/contracts/quiz-grading`; all 83 route entries pass `npm run check:performance` (~120.2–120.8 KB gzipped). |
| `FE-THEME-01` | **Medium** | 2026-10-22 | `6740e0ab` → `ce6cfa3d` | Light/dark theme parity, 4.5:1 neutral contrast, 44px touch targets, and zero horizontal overflow across 32 student/admin routes (320px, 390px, 768px, 1366px, 1440px) | **Verified** | `6740e0ab`, `22d12ba9`, `ce6cfa3d` | `npm run check:interface` and 144 multi-viewport Playwright fixture checks (0 page errors, 0 overflow, 0 contrast findings); see [Frontend Theme & Layout Audit](./frontend/2026-10-22-frontend-theme-and-layout-audit.md). |
| `FE-KATEX-01` | **Medium** | 2026-08-18 | `1a4fdd2a` | Repeated `katex.renderToString` execution on quiz option selection blocked the main thread | **Verified** | `1a4fdd2a` | Wrapped `MathRenderer` in `React.memo` ([Archived Note](./archive/2026-08-18-katex-mathrenderer-memoization-note.md)). |
| `FE-TBT-01` | **Low / Medium** | 2026-10-21 | `331d261f` | Mobile Lighthouse median Total Blocking Time (TBT) on `/mathematics/advance/algebra/quiz?resume=1` measured 228ms in the 3-run render-path follow-up (target: <=200ms; initial 6-route run was <200ms on all routes) | **Open** | — | Tracked alongside `PERF-LCP-01` in [2026-10-21 Lighthouse Audit](./performance/2026-10-21-lighthouse-and-render-path-audit.md). |

---

## 6. Reliability & Operational Audits

### Active Reports
- [2026-10-21 CI Verification & Production Deployment Audit](./reliability/2026-10-21-ci-verification-and-deployment-audit.md)
- [2026-10-15 Battle Production Launch Checklist](./reliability/2026-10-15-battle-production-launch-checklist.md)
- [Staging Reliability & Recovery Runbook](../runbooks/staging-reliability-and-recovery.md)

### Finding Ledger — Reliability

| Finding ID | Severity | Audit Date | Audited Commit | Summary | Status | Remediation Commit | Verification Evidence / Next Steps |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REL-CI-01` | **High** | 2026-10-21 | `331d261f` | Duplicate verification runs on backend push, serial E2E-before-Lighthouse bottleneck, and policy-routed Fast vs. Full Quality Gates | **Verified** | `331d261f`, `08363405` | `node --test scripts/ci-policy.test.mjs scripts/ci-gate.test.mjs` (13/13 passing), `actionlint` across all 7 workflows, desktop (129 passed) & mobile (134 passed) E2E suites. |
| `REL-B1-01` | **High** | 2026-10-12 | `4b2d13cd` / `020bc838` | Azure App Service F1 Free tier idle unloading and quiz-only mode prevented persistent Socket.IO and embedded workers | **Verified** | `020bc838` | Verified live on Azure Linux B1 (`Always On: true`, `QUIZ_ONLY_MODE=false`, `RUN_EMBEDDED_WORKERS=true`) in [Infrastructure](./../architecture/infrastructure.md). |
| `REL-P0-01` | **High** | 2026-10-03 | `2f159279` | External OTLP trace collector, per-instance Prometheus scraping, Grafana SLO dashboard, Blackbox HTTP probes, and Alertmanager receiver delivery verification | **Open** *(Ops Gate)* | Templates in `2f159279` | Templates exist in [`backend/observability/`](../../../backend/observability/README.md); live receiver activation & test alert timestamp required ([Staging Runbook §1](../runbooks/staging-reliability-and-recovery.md)). |
| `REL-P0-02` | **High** | 2026-10-03 | `2f159279` | Ordered staging load test stages (`C1` → `C5` → `C10` → `C25` → `C50` → `C100`) to establish sustained capacity boundary (`dashboard p95 <= 300ms`, `create p95 <= 800ms`, `answer p95 <= 350ms`) | **Open** *(Staging Gate)* | Workflow `training-staging-load.yml` ready | Run `training-staging-load.yml` against isolated staging environment ([Staging Runbook §1](../runbooks/staging-reliability-and-recovery.md)). |
| `REL-P1-01` | **Medium** | 2026-10-03 | `2f159279` | Physical Android WebView offline training kill/restart/reconnect and cross-account isolation acceptance test (`NEXT_PUBLIC_OFFLINE_TRAINING=true`) | **Open** *(Release Gate)* | — | Documented in [Staging Runbook §4](../runbooks/staging-reliability-and-recovery.md). |
| `REL-P1-02` | **Medium** | 2026-10-03 | `2f159279` | Provisioning of supported Azure canary slot (`backend-canary` environment) and isolated MongoDB backup/restore RTO/RPO drill | **Open** *(Ops Gate)* | `backend-canary-promotion.yml` ready | Documented in [Canary Rollout Runbook](../runbooks/canary-rollout.md) and [Staging Runbook §5](../runbooks/staging-reliability-and-recovery.md). |
| `REL-BATTLE-01` | **Medium** | 2026-10-15 | `83043cf6` | 12 open production launch checklist items for Ranked Battle v2 (Atlas index check, backup restore verification, SIGTERM drill, 5%→100% cohort rollout, 20/100-player remote load observation) | **Open** *(Launch Gate)* | Local suites passing (`83043cf6`) | Tracked in [Battle Production Launch Checklist](./reliability/2026-10-15-battle-production-launch-checklist.md). |
