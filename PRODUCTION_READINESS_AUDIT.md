# Meow production-readiness baseline — 2026-09-09

Audited base: `120a8307`, with local changes across frontend, backend, MongoDB, AI Tutor, Quiz Engine and Test Engine. This records repository and local-runtime evidence, not a claim that every line was reviewed or that production is certified.

**The identified high-impact code defects have been addressed locally. A defensible 9/10 production rating still requires staging and operational evidence.** On 2026-09-10 IST, live health, a direct AI text call, B2 range read and Atlas migration inspection were performed; see [actual release evidence](PRODUCTION_RELEASE_EVIDENCE.md). The deployed revision predates these fixes, migration 004 is absent, and current hosting is F1 Free in quiz-only mode with embedded workers disabled. No deployment, production migration, restore, notification or production load was performed. Android/Kotlin remains untouched.

## Severity ranking and resolutions

P1 means high impact on confidentiality, correctness, availability or recovery; P2 means material hardening/performance work. No verified P0 exploit was established.

| Finding | Severity | Implemented resolution |
| --- | --- | --- |
| Stateless logout, process-local revocation, reusable refresh tokens, stale account status | P1 | Mongo-backed sessions; atomic refresh rotation and replay revocation; fresh status/role checks; logout/replay disconnect session sockets. Ten-second replay grace returns the same rotated cookie for concurrent tabs/lost responses. Cross-tab browser refresh uses Web Locks where available. |
| Public slot and active-attempt answer/solution disclosure | P1 | Public slot summaries and explicit active-question allowlist. Completed practice review remains available. |
| Confidential exam questions published into practice bank | P1 | Explicit confidential fixed-paper mode; no bank publication; reject existing public question IDs and confidential-to-practice downgrade. Completed confidential attempts never expose answer keys or review and allow only one attempt per user/paper. Previously published content cannot become secret retroactively; use new unpublished content. |
| Incorrect grading for letter/text/object keys | P1 | Shared answer normalization at grading and practice review serialization; valid key checks before start/upload. |
| Attempts stranded by a crashed submitter or concurrent grading/save | P1 | Atomic revision-checked publication of results, idempotent concurrent submission and recovery of legacy submitting attempts. |
| Autosave/timer reset, hidden-tab expiry, repeated failed submission | P1 | Stable autosave; elapsed-time countdown; server deadline checks; serialized revision-aware saves; visible conflict/reload, load retry and submit retry; bounded automatic expiry submission. |
| Invalid papers, duplicate section allocation and duplicate starts | P1 | Validate IDs/options/keys; allocate each question once; confidential papers require exact section counts and explicit total-time policy; start idempotency and unique single-attempt index. Partial open practice remains supported. |
| Unbounded public reads and repeated page counts | P1/P2 | Legacy reads capped at 5,000; image reads at 100; practice at 100/300 candidates. Subsequent cursor pages skip totals; bounded count execution; count/cache/fallback correctness repaired. |
| Token-purpose confusion and production loopback limiter bypass | P2 | Explicit access/refresh purposes with HS256 verification; loopback exemption restricted to development. |
| Per-process/token AI quotas and unbounded provider concurrency | P2 | Authenticated shared user quotas; Mongo per-user admission leases across frontend/backend generation paths; polling excluded from generation quota; bounded provider concurrency and circuit breaker. |
| Slow/hanging provider and database resource acquisition | P2 | Provider timeout 45 seconds, no SDK retry, empty-reply failure, sanitized errors; bounded Mongo pool and wait/connect times; indexed user identity lookup. |
| Seven moderate dependency vulnerabilities | P2 | Updated qs and compatible transitive uuid overrides in workspace and standalone backend locks; both production audits now zero. |
| Missing authenticated assessment browser coverage | P2 | Production Next server plus real local HTTP/Mongo fixture, desktop/mobile answer-save/reload/submit/confidentiality/overflow checks, integrated into CI. |

## Policy and architecture boundaries

Confidential assessments currently enforce **total exam time**, not independent section deadlines. They require complete fixed papers, permit one attempt, and provide results without answer review or retakes. The admin upload control and attempt UI describe this policy. This is not a proctoring or question-content anti-copying system. Shared/reused content can already be known to candidates even when IDs differ.

Open practice deliberately supports partial papers and completed answer review. Existing shared shells, cursor pagination, durable attachment jobs, battle recovery and migration architecture were retained. The access-code cookie presence check remains a navigation gate; backend authentication/authorization protects sensitive operations.

## Validation ledger

| Check | Current local result |
| --- | --- |
| Backend full suite | 46 files / 290 tests passed, including real Mongo replica-set and HTTP integration coverage |
| Frontend full check | TypeScript passed; 39 files / 174 tests passed; lint 0 errors / 103 warnings |
| Production build | Passed; 801 generated pages |
| Entry bundle budgets | Passed; largest measured quiz entry 229,528 bytes gzip / 260,000 limit; login 143,750 / 155,000 |
| Authenticated browser regression | 2 passed: desktop and mobile, real local API/database, final production build |
| Production dependency audits | Zero vulnerabilities for workspace and standalone backend lock |

Regression coverage includes durable sessions across connection restart, role/suspension checks, logout/replay/concurrent refresh, AI lease ownership and provider admission/circuit recovery, confidential publication/start/review restrictions, grading, save/submit races, start idempotency, client conflict and failure recovery. Browser coverage is specifically the assessment journey; it does not establish full browser coverage of every module. Storage/model calls in suites are isolated or mocked.

Local ignored `readiness-*.tmp.log` files hold execution output. No coverage percentage, Lighthouse score, live provider success or production capacity is implied.

## Remaining release gates, in priority order

| Priority | Evidence still required | Acceptance condition |
| --- | --- | --- |
| Release blocker | Coordinated staging migration and session rollout | Migration 004 succeeds; health reports required versions; existing users re-login; login/refresh/logout, roles and Socket.IO verified through real ingress |
| Release blocker | Atlas workload and resource limits | Representative dataset and concurrent authenticated/question/assessment traffic meet agreed latency, error, memory and connection budgets; inspect query plans before changing normalized-key flag |
| Release blocker | Backup/restore and rollback drill | Restore a staging backup, verify representative records and recovery time, exercise process drain/restart, record an operator-owned recovery procedure |
| Release blocker | External integrations and monitoring | Live AI text/attachment and storage smoke, battle reconnect, notification acceptance, alert delivery and failure recovery verified in staging |
| P2 | Frontend runtime performance and lint debt | Profile representative low-end devices; address measured costs and relevant lifecycle warnings; 103 existing warnings remain |
| P2 | Remaining legacy question consumers | Migrate consumers needing more than 5,000 results to cursor pagination; verify normalized-key backfill and production-sized fallback query plans |

No staging URL/test account was supplied during this continuation. The read-only `backend/scripts/verify-release.js` was run against the existing deployment: reachability passed, but expected-release verification failed because the old health response omits release identity. Direct live AI/storage checks passed and Atlas inspection confirmed migration 004 is absent. Hosted CI passed for the old deployed revision, not the local readiness changes. Staging load, full authenticated integration, alert and restore evidence remain blocked as detailed in `PRODUCTION_RELEASE_EVIDENCE.md`.

## Deployment and rollback

1. Back up the target database and run `npm run db:migrate` from backend before starting this release. New migration **004-readiness** creates session/lease TTL indexes, user identity lookup and attempt idempotency/confidential uniqueness indexes. Inspect any duplicate-index failure before proceeding; do not delete records to force migration success.
2. Deploy backend and frontend together. **Existing stateless tokens are rejected and users must sign in again.** Fresh authentication reads MongoDB; database outages fail protected requests closed. Session refresh has a fixed absolute expiry.
3. Publish confidential papers only from new unpublished content using the confidential upload setting. Existing practice papers are not silently converted. Validate a complete paper, total-time expiry, duplicate start, reload and results through staging ingress.
4. Verify health, authentication, browser journeys and external integrations, then record load/restore/alert evidence before asserting the production target.

Indexes and new collections are additive, but rollback is security-sensitive: an older application can ignore durable revocation or expose confidential papers. Do not serve confidential data through an old release. Use maintenance isolation or a forward fix, preserving data and backups; retain security-compatible readers if reverting unrelated changes. Do not drop session/attempt/lease collections as a rollback shortcut.
