# Meow Guru — Zero-Regression P0, P1 & P2 Security Hardening Report

**Branch**: `security/zero-regression-hardening`  
**Base Commit (`main`)**: `0a1621de`  
**Scope**: All 10 Identified Security Vulnerabilities (`P0`: `VULN-01`–`04`, `P1`: `VULN-05`–`08`, `P2`: `VULN-09`–`10`)  
**Policy**: Zero-Regression Security Hardening (100% preservation of existing API contracts, database schemas, and user workflows)

---

## Executive Summary

| ID | Phase | Vulnerability | Root Cause | Fix Summary | Regression Test Suite | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **VULN-01** | P0-1 | Public Answer-Key, Solution & Ingestion Metadata Exposure | Public question read endpoints returned raw MongoDB records with `correctAnswer`, `solution`, `translations.*.solution`, and internal ingestion hashes. | Enforced deep allowlist DTO projection (`toPublicQuestionDTO`) with recursive translation scrubbing across public question read routes while preserving privileged `/export`, `/answer`, and admin review flows. | `backend/tests/security/vuln01-question-exposure.regression.test.js` (+ 3 challenger suites, 81 tests) | **VERIFIED** |
| **VULN-02** | P0-2 | Access-Code Gate Bypass & Secret Confusion | `frontend/proxy.ts` checked only cookie existence (`!accessSession?.value`); `accessCodes.js` shared `JWT_SECRET` with a static fallback string. | Implemented synchronous constant-time HMAC-SHA256 verification and 24h expiration checks in `frontend/proxy.ts` and `backend/routes/accessCodes.js`, isolated `SESSION_SECRET` from `JWT_SECRET`, and guarded `decodeURIComponent` against malformed URI crashes. | `frontend/proxy.test.ts`, `frontend/proxy-adversarial.challenger.test.ts`, `backend/tests/security/vuln02-access-code.regression.test.js` (115 tests) | **VERIFIED** |
| **VULN-03** | P0-3 | PDF Upload Memory Exhaustion, Rate-Limit Exemption & Stored HTML/XSS | `globalLimiter` skipped all `/api/pdfs` methods (`POST` included); Multer buffered up to 60 × 100 MB (6 GB) in RAM; `.html`/`.htm` uploads were allowed without `%PDF-` magic-byte checks. | Scoped `globalLimiter` skip to `GET /api/pdfs*`, attached `uploadLimiter` to `POST /api/pdfs`, bounded Multer to 20 MB / 10 files, removed `.html`/`.htm`, added `verifyPdfMagicBytes` (`%PDF-`) and active HTML/XSS payload scanning, and set `ResponseContentType` / `ResponseContentDisposition` on presigned stream URLs. | `backend/tests/security/vuln03-pdf-upload.regression.test.js`, `backend/middleware/__tests__/rateLimiter.test.js` (13 tests) | **VERIFIED** |
| **VULN-04** | P0-4 | AI Quota Bypass, Unbounded Prompt Input & Unhandled `TypeError` on `POST /api/ai/explain` | `/api/ai/explain` omitted `reserveTutorUsage`, had no upper bound on `question` or `options`, and evaluated `options?.join` outside `try/catch`. | Enforced `question` (1–4000 chars, returning 400/413) and `options` array bounds (max 10 strings <= 1000 chars), called `reserveTutorUsage(userId, ...)` prior to `chatComplete`, and propagated HTTP 429 quota exhaustion messages cleanly. | `backend/tests/security/vuln04-ai-quota.regression.test.js` (7 tests) | **VERIFIED** |
| **VULN-05** | P1-1 | Post-Login Open Redirect | `frontend/app/(auth)/login/page.tsx` passed `searchParams.get('redirect')` directly to `router.replace()` without validating that it is a safe internal relative route. | Applied `sanitizeInternalRedirect` (checking `startsWith('/')`, rejecting `//` and `/\`) to `searchParams.get('redirect') ?? searchParams.get('next')`. | `frontend/app/(auth)/login/vuln05-open-redirect.regression.test.tsx` (7 tests) | **VERIFIED** |
| **VULN-06** | P1-2 | Arbitrary B2 Object Key Proxy & Unbounded `sharp` Image Decoding | `serveImage` decoded any `base64url` string into a B2 `Key` without prefix/path-traversal validation; `imageQuestionController.js` passed raw buffers to `sharp(buffer)` without `limitInputPixels` or format/dimension verification. | Enforced `SAFE_IMAGE_KEY_REGEX` (`question-images/`, `solution-images/`, `notes/images/`) and rejected `..` segments in `serveImage`; replaced raw `sharp(buffer)` with `decodeAndCompressImage` (max 6000px per side, 25MP, non-animated JPG/PNG/WebP); removed `image/gif` from `backend/middleware/upload.js`. | `backend/tests/security/vuln06-image-upload.regression.test.js` (6 tests) | **VERIFIED** |
| **VULN-07** | P1-3 | Mass Assignment & Unsanitized Fields in Notes & MockTest `sectionTimers` | `POST /api/notes` and `PUT /api/notes/:id` spread `...req.body` into note documents; `GET /api/notes/:id` returned raw note documents leaking `ownerUserId`; `autosaveAttempt` persisted unvalidated `sectionTimers` objects. | Added `pickAllowedNoteFields` allowlist and stripped `ownerUserId` in `sanitizeNote` (including `GET /api/notes/:id`); added `sanitizeSectionTimers` (plain object, `<= 20` non-`$` keys `<= 64` chars, finite numbers `[0, 86400]`) in `mockTestController.js`. | `backend/tests/security/vuln07-mass-assignment.regression.test.js` (3 tests) | **VERIFIED** |
| **VULN-08** | P1-4 | Battle Socket.IO CORS, Per-User Rate Limits, Rematch Replay & Invite Lock | `socketCorsOrigins` included `localhost` in production; rate-limit timers were per-socket instead of per-user; `rematchToken` (`jti`) was replayable; `room:invite` locked `allowedOpponentUserId` before confirming push delivery. | Excluded `localhost` origins when `NODE_ENV === 'production'`; tracked cooldowns per `userId` across sockets; tracked consumed `rematchToken` `jti` claims; reserved `allowedOpponentUserId` only after confirming push delivery. | `backend/tests/security/vuln08-battle-socket.regression.test.js` (4 tests) | **VERIFIED** |
| **VULN-09** | P2-1 | Non-Enforced CSP, Password/Avatar Schema Gaps, Array Query Type Confusion & Raw 500 Error Leakage | `next.config.ts` emitted only `Content-Security-Policy-Report-Only`; `loginSchema` lacked `.max()`; `registerSchema` lacked the 72-byte UTF-8 check; `profilePatchSchema.avatar` accepted arbitrary strings; `adminUsers.controller.js` assumed query params were strings and leaked `err.message` on `500` responses. | Added enforced `Content-Security-Policy` in `next.config.ts`; added `.max(128)` to `loginSchema`, 72-byte UTF-8 check to `registerSchema`, and `SAFE_AVATAR_REGEX` to `profilePatchSchema`; guarded string query types and redacted production `500` errors in `adminUsers.controller.js`. | `backend/tests/security/vuln09-hardening.regression.test.js` (5 tests) | **VERIFIED** |
| **VULN-10** | P2-2 | CI/CD Hardening Gaps: Missing Branch Guard on Production `workflow_dispatch`, Unpinned Container Tag & Partial `npm audit` | `main_quizguru-backend.yml` allowed `workflow_dispatch` without a `refs/heads/main` guard; `ci-verify.yml` pulled `prom/prometheus:v3.5.0` without an immutable `@sha256` digest and skipped root/`@meow/contracts` in `npm audit`. | Added `if: github.ref == 'refs/heads/main'` and shell ref check to `main_quizguru-backend.yml`; pinned `prom/prometheus:v3.5.0@sha256:63805ebb...` and added `@meow/contracts` + root `npm audit --omit=dev --audit-level=high` in `ci-verify.yml`. | `backend/tests/security/vuln10-cicd-hardening.regression.test.js` (3 tests) | **VERIFIED** |

---

## Detailed Vulnerability Remediation Reports (Phase 6: P2)

### 9. VULN-09: Enforced CSP, Auth Schema Bounds, Array Query Type Guards & Production 500 Redaction

- **Original Vulnerability & Reproduction**:
  - `frontend/next.config.ts` only configured `Content-Security-Policy-Report-Only` without an enforced `Content-Security-Policy` header.
  - `contracts/auth.js`: `loginSchema.password` had no `.max()` bound (permitting multi-kilobyte bcrypt DoS inputs), `registerSchema.password` lacked the 72-byte UTF-8 limit enforced in `resetPasswordSchema` (resulting in silent bcrypt truncation past 72 bytes), and `profilePatchSchema.avatar` accepted arbitrary strings up to 150,000 characters without restricting schemes (`javascript:`, `data:text/html`, `data:image/svg+xml`) or CSS injection characters.
  - `backend/controllers/adminUsers.controller.js`: `getUsers` called `search.trim()` and `sort.startsWith('-')` without checking `typeof === 'string'`, throwing a `TypeError` (`500`) when array query parameters (`?search[]=a`) were supplied, and echoed raw `err.message` on `500` errors in production.
  - Reproduced in `backend/tests/security/vuln09-hardening.regression.test.js` (`5/5` assertions failed on unpatched code).
- **Files Changed**:
  - `frontend/next.config.ts`
  - `frontend/lib/security/csp.ts`
  - `contracts/auth.js`
  - `backend/controllers/adminUsers.controller.js`
- **Fix Implemented**:
  - Configured enforced `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin` in `frontend/next.config.ts`, and included `${backendOrigin}` in `img-src` and `ws:` when `backendOrigin` is `http:` in `frontend/lib/security/csp.ts`.
  - Added `.max(128)` to `loginSchema.password`, `.refine(password => new TextEncoder().encode(password).byteLength <= 72)` to `registerSchema.password`, and `SAFE_AVATAR_REGEX` (`https://`, `/...`, or `data:image/(png|jpeg|jpg|webp|gif);base64,...`) to `profilePatchSchema.avatar`.
  - Guarded `typeof search === 'string'`, `typeof status === 'string'`, `typeof role === 'string'`, `typeof push === 'string'`, and `typeof sort === 'string'` in `getUsers`, and added `sendControllerError` to redact `500` error messages in production.
- **Compatibility & Remaining Limitations**:
  - All 39 tests in `backend/schemas/__tests__/auth.contract.test.js`, 7 tests in `adminUsers.controller.*.test.js`, and `frontend/lib/security/csp.test.ts` pass without modification.

---

### 10. VULN-10: CI/CD Workflow Integrity Hardening

- **Original Vulnerability & Reproduction**:
  - `.github/workflows/main_quizguru-backend.yml` exposed `workflow_dispatch:` without asserting `GITHUB_REF == 'refs/heads/main'`.
  - `.github/workflows/ci-verify.yml` pulled `prom/prometheus:v3.5.0` by mutable tag rather than an immutable `@sha256` digest, and audited only `backend` and `frontend` workspaces while omitting `@meow/contracts` and root dependencies.
  - Reproduced in `backend/tests/security/vuln10-cicd-hardening.regression.test.js` (`3/3` assertions failed on unpatched code).
- **Files Changed**:
  - `.github/workflows/main_quizguru-backend.yml`
  - `.github/workflows/ci-verify.yml`
- **Fix Implemented**:
  - Added `if: github.ref == 'refs/heads/main'` and an explicit shell guard step (`[ "$GITHUB_REF" = "refs/heads/main" ]`) to `build` in `.github/workflows/main_quizguru-backend.yml`.
  - Pinned `prom/prometheus:v3.5.0@sha256:63805ebb8d2b3920190daf1cb14a60871b16fd38bed42b857a3182bc621f4996` and added `npm audit --workspace @meow/contracts --audit-level=high` and `npm audit --omit=dev --audit-level=high` to `security-and-vulnerability-scan` in `.github/workflows/ci-verify.yml`.
- **Compatibility & Remaining Limitations**:
  - Verified against `node --test scripts/ci-policy.test.mjs scripts/ci-gate.test.mjs` (`12/12` tests passing).

---

## Rollback Procedure

All fixes are isolated on branch `security/zero-regression-hardening` and structured by milestone.
To roll back either the entire hardening branch or an individual milestone:

```bash
# Full rollback to baseline main (0a1621de):
git checkout main

# Or revert a specific vulnerability commit on security/zero-regression-hardening:
git revert <commit-sha>
```
