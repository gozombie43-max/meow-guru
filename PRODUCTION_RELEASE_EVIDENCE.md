# Live release evidence — 2026-09-10 IST

Checks ran on 2026-09-09 at approximately 18:38–18:42 UTC (2026-09-10 00:08–00:12 IST). These are actual remote results from the existing production environment. No staging environment was found or supplied. This is not a staging pass or a 9/10 certification.

## Results

| Gate | Result | Evidence and limitation |
| --- | --- | --- |
| Deployed health | PASS for reachability | `/live`, `/health`, `/api/health` returned HTTP 200 and `ok:true`. Initial durations 1,311 / 517 / 115 ms. These are individual observations, not latency percentiles. |
| Release identity | BLOCKED | Azure `RELEASE_ID` is `120a83078a233ba9502e4041cf4e732a186a018a`, before the local readiness changes. Deployed health omits release identity; the strengthened expected-release check fails closed on that omission. |
| Live AI text | PASS for direct provider | Actual production-configured o4-mini call returned exactly `READY`, 3,394 ms, maximum 128 completion tokens. One small billable call. This does not exercise an authenticated deployed tutor or attachment journey. |
| Live storage read | PASS for direct provider | Actual B2 bucket list plus 64-byte range GET succeeded, 5,691 ms. No object names/content, keys or credentials recorded. No object uploaded, changed or deleted. Application upload/resolver and attachment cleanup remain untested remotely. |
| Atlas connectivity | PASS | Read-only ping and migration metadata query succeeded in 4,052 ms after explicitly configuring public DNS resolvers for this local process. The initial local DNS attempt failed; no database outage is inferred. |
| Required migration | FAIL | Applied versions are `001-existing-indexes`, `002-runtime`, `003-production-hardening`. `004-readiness` is absent. No production migration was attempted. |
| Full application mode | FAIL for full-suite validation | `/api/health` reports `quiz-only`; settings confirm `QUIZ_ONLY_MODE=true`, `PROCESS_ROLE=api`, `RUN_EMBEDDED_WORKERS=false`. This cannot validate the full worker/battle scope. |
| Hosting baseline | MISMATCH | Current plan is F1 Free; Always On is false; WebSockets are enabled. Earlier documentation described B1 with embedded workers. Live discovery supersedes that historical description. No plan/settings changes were made. |
| Hosted CI | PASS for old deployed revision only | Latest completed Continuous Verification run for `120a8307` reports success. Local readiness modifications have not been pushed or run through hosted CI. |
| Staging load | BLOCKED | Only `quizguru-backend` exists in the active subscription; its slot list is empty. No staging URLs/test account were supplied. No production load was generated. |
| Alert delivery | BLOCKED | Action-group list is empty; case-insensitive resource inventory found no Insights/OperationalInsights monitoring resources in the active subscription. No destination or external monitoring account was supplied. No test notification was sent. |
| Backup restore | BLOCKED | No staging backup source, isolated restore target, Atlas backup-management access or recovery-time objective was supplied. Azure inventory found no RecoveryServices/DataProtection resources; that does not establish whether Atlas-managed backups exist. No database was restored or overwritten. |

## Reproduction

`backend/scripts/verify-release.js` uses `RELEASE_CHECK_URL` and optional `EXPECTED_RELEASE_ID`; it reports all health checks and exits nonzero on failure or a requested release mismatch. Use the exact deployed readiness revision for final acceptance, not the old revision above.

`backend/scripts/verify-integrations.js` requires `LIVE_INTEGRATION_CHECK=1` and provider/database environment settings. It does not load `.env` implicitly. `LIVE_CHECK_ONLY` can select `ai-text`, `storage-read`, or `database-readiness`. Missing migration 004 exits nonzero even when database connectivity succeeds. Credentials for this execution were read from Azure settings into process memory and never printed or persisted. The script prints only safe result metadata. Local ignored logs: `live-integrations.tmp.log`, `live-database.tmp.log`, `live-release.tmp.log`.

## Inputs needed to finish the outstanding gates

- An isolated staging frontend/backend running the readiness changes, with test credentials and a representative dataset; or a selected hosting plan/resource target for creating that environment. The current Free plan has no staging slot configured.
- A staging backup/snapshot source and a distinct empty restore target, plus the expected recovery-time/data-loss budgets. A drill must verify data, indexes, migrations and application behavior after recovery.
- The actual monitoring system and test alert destination. Trigger and recovery delivery must be observed; an alert-rule definition alone is insufficient evidence.

Once these exist: migrate and deploy the coordinated release to staging, verify identity/mode and authenticated journeys, run bounded representative load with agreed budgets, exercise text/attachment/storage/battle recovery through the application, restore the staging backup into the separate target and verify it, then trigger and observe the test alert and recovery notification. Record measured outcomes; do not substitute local synthetic tests for these environment gates.
