**API and worker deployment**

This release has three independently supervised processes. Run them from `backend` with the same Mongo database and the existing application configuration:

| Process | Command | Purpose |
| --- | --- | --- |
| API | `npm run start:api` (also `npm start`) | HTTP and Socket.IO; no scheduled maintenance timers or tutor OCR |
| Maintenance | `npm run start:worker` | Existing eight scheduled workers, notification publishing, battle state relay |
| Attachments | `npm run start:attachments` | One tutor attachment job at a time; isolated child process per attempt |

Do not deploy just the API. Its former embedded maintenance workers have been removed. The two worker processes must run continuously under a supervisor that restarts failures. By default, worker entry points do not open HTTP listeners. Setting `WORKER_HTTP_HEALTH=true` enables `/` and `/live` health responses on `PORT`, allowing each process to run as a supervised Linux Web App.

`Dockerfile.worker` is a container definition for worker hosting without ingress. Build from the backend directory with `docker build -f Dockerfile.worker --build-arg RELEASE_ID=<git-sha> -t meow-worker:<git-sha> .`. The default command runs maintenance; override it with `npm run start:attachments` for the second service. Supply secrets at runtime, never in the image. The image build itself has not been run as part of local source validation.

**Release order**

1. Back up the database and inventory existing `/uploads` references. Keep the current application and files available for rollback.
2. Run `npm run db:migrate` against the target database. This creates all existing indexes plus runtime indexes and records completed versions. It is safe to rerun; existing index definitions are reconciled. An incompatible index or a failed build fails the command. No application startup creates indexes.
3. Deploy both worker roles from the same revision, with `RELEASE_ID` set to that revision's full commit SHA. Keep the old API online while confirming the new workers. Existing durable claims and idempotent settlement support a controlled overlap; monitor notification worker health and battle lag during the transition.
4. Run `node scripts/check-workers.js` with `RELEASE_ID` set. It requires nonexpired maintenance and attachment heartbeats for that revision.
5. Deploy the API and the coordinated frontend release. The frontend handles HTTP 202 attachment submissions. Older attachment clients expecting an immediate reply need this frontend update. Text-only tutor chat keeps its synchronous response contract.
6. Check `/live`, `/health`, and `/api/health`; the latter two require a successful database ping and the required migration versions. Validate upload/read across replicas, two-player battles, reconnects, notifications, and an attachment result.

The Azure API workflow now requires its own build/tests and blocking secret/dependency scans, runs migrations, deploys `quizguru-maint-ede848e3` and `quizguru-attach-ede848e3`, then checks their release heartbeats before deploying the API. Provision these two Linux Node 22 Web Apps once on the existing API App Service plan and grant the workflow identity Website Contributor on each site. The sites share the B1 plan's CPU and memory but do not add another App Service plan. After Azure OIDC login, the workflow uses a `MONGODB_URI` GitHub Actions secret when configured and otherwise reads the existing setting from `quizguru-backend` without printing it. It copies the API's Web App settings to both worker sites, adds their startup commands and health listener, and defaults `MONGODB_DB` to `quizDB`. Branch protection must require the relevant workflow checks separately.

Migration concurrency uses an exclusive lock without automatic expiry: an index build can outlive a process or a short lease. If a runner crashes, first confirm no runner or index operation remains active, then have an operator remove only the stale `_id: "migrations"` document from `schemaMigrationLocks`. Do not clear the lock merely because a deployment is slow.

**Question data and storage cutovers**

- Run `npm run db:normalize` for a dry run. Review `scanned`, `candidates`, `matched`, `modified`, and `conflicted`. Apply with `npm run db:normalize -- --apply`, then verify with `npm run db:normalize -- --verify`. A verification with outstanding candidates or a pass with conflicts exits nonzero. Reapply conflicts after reviewing concurrent edits.
- Keep `QUESTIONS_NORMALIZED_KEYS` disabled until verification succeeds and representative old/new results agree. Canonical session/count/metadata queries use normalized keys when enabled. Existing legacy offset clients retain their contract; `/api/questions?pagination=cursor&topic=...&limit=50` provides a bounded canonical listing with `nextCursor` and `hasMore`. Invalid cursors return 400. The cursor listing deliberately uses canonical topics; use the legacy route for cross-field fallback lookup during transition.
- New generic question/option/solution image uploads use B2 and stable resolver URLs. Run `npm run db:migrate-images` on the machine containing the old backend `uploads` directory for an inventory, then `npm run db:migrate-images -- --apply` to copy and verify bytes before conditionally changing stored references. Missing files and concurrent edits are reported. The script never deletes source files. Review documents containing unusual absolute legacy URLs separately; the migration targets relative `/uploads/...` references.
- Keep `/uploads` serving old images until migration coverage is confirmed. New stored URLs use the existing `/api/upload/image/:id` resolver and private B2 signed redirects. Set `BACKEND_PUBLIC_URL` consistently with the existing deployment.
- Production question LRU reads/writes are disabled. Public counts/meta/session responses retain their existing bounded HTTP cache headers. This trades extra database work for consistent application-instance reads; measure load before adding a shared cache or extending CDN TTLs.

**Tutor jobs and recovery**

Attachment submissions return `{ success, jobId, status }`. Poll `GET /api/ai/tutor-jobs/:id`; completed jobs return the existing `{ success, reply }` fields. `DELETE` cancels queued/running work. Both operations enforce the submitting user. `Idempotency-Key` is supported; reusing a key with different input returns 409. The chat client persists pending-job context per signed-in user in session storage and resumes polling after refresh.

Inputs are stored under `tutor-jobs/` in B2. Mongo holds the owner, object key, lease, attempt count and terminal result. Attempts have a 60-second renewable lease, a 120-second child-process deadline and a three-attempt limit. Each attachment worker processes one job at a time, independently of battle maintenance. Old lease owners cannot renew or commit results. Cancellation invalidates ownership; the worker stops the child on its next lease check. PDF/image processing limits apply inside the isolated process.

Terminal inputs are deleted by the attachment worker. Job documents/results expire after seven days. Configure a B2 lifecycle rule for the `tutor-jobs/` prefix to expire abandoned input objects after eight days, including staging uploads left by crashes. Do not apply that rule to permanent question images. External model requests can be repeated after an ambiguous crash; the queue guarantees fenced result storage, not exactly-once billing at the model provider.

Battle transitions carry an atomic pending-publication marker on their room document. Maintenance retries until an API acknowledges the relay. Connected clients refresh their persisted battle snapshot; reconnect also recovers from Mongo. This is at-least-once publication, so clients must continue treating snapshots idempotently. Socket.IO's Mongo adapter requires replica-set/change-stream support. If long-polling is enabled, configure ingress affinity as well.

**Limits, metrics and validation**

Ordinary JSON requests are limited to 256 KiB. Question bulk operations and mock-paper upload allow 10 MiB; notes and saved chat histories allow 2 MiB. Multipart routes retain explicit file limits; tutor uploads additionally bound fields and parts. Production rate limits use atomic Mongo counters and authenticated identity where available, otherwise normalized IP. Unsigned user cookies no longer select rate-limit buckets.

Pino emits request IDs, route duration/status, runtime memory and event-loop delay, Mongo latency/error aggregates, attachment job duration, queue depth/wait and worker health. Request bodies, query values and headers are not recorded by the new request logger. Existing domain console logging remains for incremental conversion. Ship stdout to the environment's log/metrics collector and configure alerts there.

Bulk question writes use batches of 500 and preserve aggregate `inserted`, `failed`, and `total`, with an added per-row `results` array. For idempotent ingestion, supply a stable `Idempotency-Key` for the identical ordered request body. `inserted` retains its compatibility meaning of successfully accepted rows, including previously accepted rows on an idempotent retry. Unknown network outcomes are reported as unknown rather than assumed failures; retry them with the same import key. Imports without a key preserve duplicate-ID retry behavior.

Run `npm test` from backend (the command now limits Vitest to two workers). Replica-set coverage includes migration replay/conflicts/concurrency, backfill modes/nulls/concurrent edits, 10,000-row import/retry, keyset pages and query-plan bounds, queue ownership/recovery, shared rate limits and a separate realtime worker with two API instances. Storage/cloud calls are mocked in local tests; perform B2 and AI smoke checks in staging before release.

Use `LOAD_BASE_URL`, optional `LOAD_PATH`, `LOAD_REQUESTS`, `LOAD_CONCURRENCY`, and `LOAD_P95_MS` with `npm run test:load` against an explicit local/staging target. It performs read-only requests and fails on HTTP errors or the p95 budget. Set a representative dataset and workload before interpreting the result as capacity evidence. Production load, ingress affinity, external monitoring, worker hosting, live data migration and restore drills require environment validation.

Frontend production builds now require `API_URL` or `AZURE_BACKEND_URL`; configure it before building. Notes use the centralized HTTP base, and Monaco loads through a dynamic component. Authentication cleanup uses a lightweight socket lifecycle registry, keeping the Socket.IO client out of the login and registration entry bundles. Existing OGL/Konva lazy-loading boundaries remain. Run frontend typecheck, tests, lint, build and entry bundle-budget checks from `frontend`.

Local validation recorded on 2026-09-09: backend 36 test files / 255 tests passed; frontend 37 test files / 167 tests passed, followed by the affected authentication/tutor tests after the socket import change. Frontend typecheck, lint, production build (801 pages), and entry bundle budgets passed. A real local Sharp/Tesseract smoke check recognized a generated arithmetic image using the bundled English model. Backend audit passed the high/critical threshold with seven moderate findings remaining; frontend audit reported no vulnerabilities. Workflow YAML parsing and `git diff --check` passed. These checks do not establish staging capacity or production readiness. Docker build, live B2/model calls, production migrations, hosted workers, external alerts, and the actual Gitleaks workflow execution remain unverified.

Rollback is additive: restore the previous API/reader release, stop the new worker roles when returning to an API with embedded workers, retain indexes and data fields, and preserve old files until the migration is accepted. Do not drop runtime collections or permanent storage objects as an application rollback shortcut.
