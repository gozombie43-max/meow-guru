# Project: Meow Guru Zero-Regression Security Hardening

## Architecture
Meow Guru is an npm workspaces monorepo containing:
- `contracts/` (`@meow/contracts`): Shared Zod schemas, TypeScript types, and DTO contracts.
- `backend/`: Node.js Express 5 ESM backend with domain services, repositories, middleware, and routes.
- `frontend/`: Next.js 16.4.2 Turbopack web application with Edge/Node middleware (`proxy.ts`), React features, and API clients.

The security hardening targets all 10 vulnerabilities (`P0`: `VULN-01` to `VULN-04`, `P1`: `VULN-05` to `VULN-08`, and `P2`: `VULN-09` to `VULN-10`) on an isolated branch `security/zero-regression-hardening`, maintaining strict 100% backward compatibility and zero regressions across all existing tests.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Branch Isolation | Establish `security/zero-regression-hardening` branch from `origin/main` / `main` and verify baseline | M0 | ORIGINAL_REQUEST §R1 |
| 2 | VULN-01 Exploit Reproduction | Automated regression test demonstrating public answer-key, solution, and ingestion metadata leak | M1 | ORIGINAL_REQUEST §R1, R3 |
| 3 | VULN-01 Question DTO Redaction | Public question read endpoints omit answer keys, solutions, and ingestion metadata (`toPublicQuestionDTO`) | M1 | ORIGINAL_REQUEST §R1, R2 |
| 4 | VULN-01 Privileged & Exam Workflows | Authenticated exam submission (`/answer`) and privileged review/export retain complete question records | M1 | ORIGINAL_REQUEST §R2 |
| 5 | VULN-02 Exploit Reproduction | Automated regression test demonstrating access gate bypass via dummy unverified cookie presence | M2 | ORIGINAL_REQUEST §R1, R3 |
| 6 | VULN-02 Access Gate Cryptographic Verification | Enforce HMAC-SHA256 signature and expiration verification in `proxy.ts` on `access_session` cookie | M2 | ORIGINAL_REQUEST §R1, R2 |
| 7 | VULN-02 Secret Isolation | Isolate `SESSION_SECRET` from `JWT_SECRET` and prevent hardcoded secret misuse | M2 | ORIGINAL_REQUEST §R1, R2 |
| 8 | VULN-03 Exploit Reproduction | Automated regression test demonstrating rate-limit bypass, unbounded upload buffering, and stored HTML/XSS | M3 | ORIGINAL_REQUEST §R1, R3 |
| 9 | VULN-03 Rate Limiter & Memory Bounds | Scope `/api/pdfs` rate limit skip to GET only, attach `uploadLimiter`, limit multer memory buffer to <=20 MB / <=10 files | M3 | ORIGINAL_REQUEST §R1, R2 |
| 10 | VULN-03 Document Validation & Anti-XSS | Disallow `.html`/`.htm`, enforce `%PDF-` magic bytes, scan for HTML/script tags, enforce `application/pdf` Content-Type | M3 | ORIGINAL_REQUEST §R1, R2 |
| 11 | VULN-04 Exploit Reproduction | Automated regression test demonstrating quota bypass, unbounded prompt input, and unhandled errors on `/api/ai/explain` | M4 | ORIGINAL_REQUEST §R1, R3 |
| 12 | VULN-04 AI Quota Reservation | Call `reserveTutorUsage(userId, input)` before AI invocation to enforce daily token and request limits | M4 | ORIGINAL_REQUEST §R1, R2 |
| 13 | VULN-04 Prompt Bounds & Error Handling | Enforce character limits on `question` (1-4000) and `options` array, handle errors gracefully with 400/413/429/502 | M4 | ORIGINAL_REQUEST §R1, R2 |
| 14 | VULN-05 Post-Login Open Redirect Prevention | Enforce `sanitizeInternalRedirect` on `searchParams.get('redirect') ?? searchParams.get('next')` in `frontend/app/(auth)/login/page.tsx` | Phase 5 | PHASE_5 §VULN-05 |
| 15 | VULN-06 B2 Image Key Traversal & Validated `sharp` Decoding | Enforce `SAFE_IMAGE_KEY_REGEX` in `serveImage`, verify `decodeAndCompressImage` (`limitInputPixels`, max 6000px/25MP) in `imageQuestionController.js`, and remove `image/gif` from `upload.js` | Phase 5 | PHASE_5 §VULN-06 |
| 16 | VULN-07 Mass Assignment & Unsanitized Fields | Enforce field allowlisting (`pickAllowedNoteFields`) and strip `ownerUserId` in `notes.routes.js`; sanitize `sectionTimers` in `mockTestController.js` | Phase 5 | PHASE_5 §VULN-07 |
| 17 | VULN-08 Battle Socket.IO Hardening | Exclude `localhost` origins in production CORS, enforce per-user cooldowns across sockets, prevent `rematchToken` replay, and reserve room opponent only after push delivery | Phase 5 | PHASE_5 §VULN-08 |
| 18 | VULN-09 Enforced CSP, Auth Schema Bounds, Query Type Guards & 500 Error Redaction | Enforce `Content-Security-Policy` in `next.config.ts`, bound `loginSchema.password` (`<=128`), `registerSchema.password` (`<=72` UTF-8 bytes), and `profilePatchSchema.avatar`, guard array query params and redact `500` errors in `adminUsers.controller.js` | Phase 6 | PHASE_6 §VULN-09 |
| 19 | VULN-10 CI/CD Workflow Integrity Hardening | Enforce `refs/heads/main` guard in `main_quizguru-backend.yml`, pin `prom/prometheus:v3.5.0@sha256:...` digest, and audit `@meow/contracts` + root dependencies in `ci-verify.yml` | Phase 6 | PHASE_6 §VULN-10 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Branch Setup & Baseline Verification | Create isolated branch `security/zero-regression-hardening` from `origin/main` and verify clean working tree | none | DONE |
| M1 | VULN-01 Question Leak Remediation | Reproduce exploit, implement public DTO redaction, preserve privileged/exam workflows, add dedicated regression test | M0 | DONE |
| M2 | VULN-02 Access-Code Gate Hardening | Reproduce bypass, implement HMAC verification & secret isolation in `proxy.ts` and `accessCodes.js`, add dedicated test | M1 | DONE |
| M3 | VULN-03 PDF Upload Hardening | Reproduce exploit, enforce rate limiting, bound upload buffering, disallow HTML, verify PDF magic bytes, add dedicated test | M2 | DONE |
| M4 | VULN-04 AI Tutor Quota & Input Hardening | Reproduce exploit, enforce `reserveTutorUsage`, input validation on prompt and options, add dedicated test | M3 | DONE |
| Phase 5 | VULN-05 to VULN-08 P1 Application Hardening | Reproduce and remediate open redirect (`VULN-05`), B2 image key & `sharp` bounds (`VULN-06`), mass assignment (`VULN-07`), and Battle Socket.IO flaws (`VULN-08`) | M4 | DONE |
| Phase 6 | VULN-09 to VULN-10 P2 Defense-in-Depth & CI/CD Hardening | Reproduce and remediate CSP/Auth/Admin hardening (`VULN-09`) and CI/CD workflow integrity (`VULN-10`) | Phase 5 | DONE |

## Dedicated Regression Tests
- `backend/tests/security/vuln01-question-exposure.regression.test.js` (+ 3 challenger suites)
- `frontend/proxy.test.ts`, `frontend/proxy-adversarial.challenger.test.ts`, `backend/tests/security/vuln02-access-code.regression.test.js`, `backend/tests/security/vuln02-adversarial-challenge.test.js`
- `backend/tests/security/vuln03-pdf-upload.regression.test.js`
- `backend/tests/security/vuln04-ai-quota.regression.test.js`
- `frontend/app/(auth)/login/vuln05-open-redirect.regression.test.tsx`
- `backend/tests/security/vuln06-image-upload.regression.test.js`
- `backend/tests/security/vuln07-mass-assignment.regression.test.js`
- `backend/tests/security/vuln08-battle-socket.regression.test.js`
- `backend/tests/security/vuln09-hardening.regression.test.js`
- `backend/tests/security/vuln10-cicd-hardening.regression.test.js`
