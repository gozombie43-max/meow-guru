# Staging activation and release gates

Companion to [the verified plan](../PERFORMANCE_RELIABILITY_PLAN.md). Repository implementation and local fixtures do not activate monitoring, establish Atlas capacity, prove Android recovery or approve production rollout. Keep each result tied to the exact deployed release ID, environment, artifact digest, flags and collection time.

## 1. Deploy and measure the isolated candidate

Use `main_quizguru-backend-staging.yml` to package locked dependencies and deploy the candidate to the isolated staging app/database. Verify `/live`, `/health`, `environment=staging`, `state=ready`, the expected `releaseId` and required migrations. Preserve the resulting artifact; do not rebuild it for production promotion. Reject a target attesting production even if its hostname looks like staging.

Use the templates in [observability](observability/README.md) to activate OTLP traces, authenticated per-instance Prometheus scrapes, the Grafana dashboard, external HTTP probes and Alertmanager. Restrict collector ingress and mount secrets outside Git. Confirm spans named `training.create.history`, `learner_state`, `pool`, `due`, `exposure`, `selection`, `hydration`, `insert` and `invalidation`. Verify a controlled test alert is actually received and resolved at the intended operator destination. Retain screenshots/queries and delivery timestamps. Templates alone are not a passing activation result.

Dispatch `training-staging-load.yml` with `concurrency=1`, then 5, then 10. Proceed to 25, 50 and 100 only after the preceding stage passes. The workflow validates the isolated Atlas cluster/database and cleans up its synthetic users. Save each report and corresponding traces/scrapes. Repeat cold and warm measurements: cold means the isolated candidate cache is empty, warm means populated for the same catalog filters. Never flush production Redis. A process restart alone empties L1 but does not empty shared Redis; explicitly document what was cleared.

For every stage require zero errors/failed lifecycles, dashboard p95 ≤300 ms, create p95 ≤800 ms and answer p95 ≤350 ms. Also record Mongo pool waiters, query and Redis p95, event-loop p99, RSS/CPU and payload sizes throughout a sustained observation window. Short bursts establish a diagnostic baseline only. Stop at the first breach; the highest passing stage is the capacity boundary. Do not buy an Atlas tier or change admission thresholds without identifying the saturated resource.

## 2. Redis and worker recovery

Provision two staging API instances and a supervised worker. Record successful question loads, saved answers, training revision changes, progress, rate limiting and health. Stop only the isolated cache Redis while normal synthetic traffic continues. Verify Mongo stays authoritative, critical operations succeed or reconcile safely, Redis health is degraded and processes stay alive. Restore Redis and verify reconnect, repopulation, cross-instance invalidation and no stale/corrupt result. Preserve a timeline, request IDs and dependency metrics.

Set `QUEUE_REDIS_URL` to a separate persistent Redis with `maxmemory-policy=noeviction`; configure backups/AOF to the required RPO. `QUEUE_REDIS_ALLOW_SHARED=true` permits an explicit fallback to `REDIS_URL`, but the startup inspection must still pass. Enable `USE_DURABLE_QUEUE=true` only on the staging worker after inspection and the cache restart drill. Kill that worker during a claimed task, let another worker recover the stalled job, and verify exactly one authoritative durable result, expected retries, preserved trace context and recovered health. Do not infer process-crash recovery from the existing thrown-exception retry test. Disable the flag and restore the previous scheduler path if the gate fails.

## 3. Admission and data/read rollouts

Enable `USE_OVERLOAD_SHEDDING=true` in staging and saturate optional AI/OCR/PDF work and Mongo pool wait conditions. Verify optional requests receive `503` plus `Retry-After`, while question reads, answers, finish and progress remain usable. Derive RSS/event-loop/pool thresholds from the measured onset of degradation, below collapse. Local route-isolation tests cover policy; this drill covers actual saturation.

For compact history use stable user cohorts 0 → 1 → 10 → 50 → 100%. At each stage compare the same learners' visible dashboard evidence against the full-history path, errors, bytes read/payload size and p95. Legacy or unreconstructed learner state must retain its full-history fallback. Do not add a learner-state cache or shrink selection pools unless stage traces justify it and revision/selection parity is demonstrated.

Keep normal/admin/topic question browsing on `pagination=cursor`. Compatibility offsets are logged; offsets above 1000 return a cursor-migration error. Review legacy logs before removing the remaining shallow path. The disposable `test:benchmark:pagination` harness compares existing indexes, first/deep/sorted/filtered/reverse/last pages at 10K/50K/100K; it validates returned IDs and records timing and examined documents/keys. Last-page navigation still does an exact count, so it is intentionally reported separately from a simple cursor seek.

## 4. Physical Android acceptance

Build the staging frontend with `NEXT_PUBLIC_OFFLINE_TRAINING=true`. On the actual WebView start training, answer twice, disconnect data, leave one action pending, kill/restart the app, reconnect and reopen that session. Verify the same session/question/revision, reconciliation against server state, one replay of the pending idempotency key and no duplicate answer. Log out and sign in with another account; verify no recovery state crosses accounts. Save device/OS/WebView version and steps/results. Browser/jsdom tests are a prerequisite, not physical-device acceptance.

## 5. Canary and restore acceptance

Before replacing the normal production deployment, provision the supported Azure slot, protected `backend-canary` environment, compatible sticky app settings, observation URL/token and scoped synthetic lifecycle credentials described in [CANARY_RUNBOOK.md](CANARY_RUNBOOK.md). Deploy the already-tested artifact to the slot, verify release identity/readiness and an authenticated question/training lifecycle, then use `backend-canary-promotion.yml` for 5% traffic, observation, SLO evaluation and promotion/rollback. Confirm both promoted and restored release identities. Keep the present production path until those prerequisites and measurements exist.

Restore a backup into a separate database/environment; never restore over production for this drill. Record backup timestamp, restore start/end, recovered data timestamp, RTO and RPO. Run migrations/readiness and representative users/questions/progress/training checks on the restored app. Document failures and the recovery procedure before considering database scaling or topology changes.

## Work packages ready for issue creation

| Priority | Package | Closure evidence |
| --- | --- | --- |
| P0 | Measured `/play` and C10 creation | Repeated production-server browser gates, ranking parity and isolated load reports; fresh-process `/play` still 1.03–1.07 s locally, staging confirmation required. |
| P0 | Monitoring/receiver activation | OTLP spans, all-instance scrapes, dashboard, external probes and received/resolved test alert. |
| P0 | Sustained staging capacity | Ordered stage reports and system/dependency telemetry; explicit highest passing stage. |
| P1 | Redis and durable worker crash recovery | Stop/restore and worker-death timelines with authoritative correctness/reconciliation. |
| P1 | Offset retirement | Legacy usage evidence and migrated external callers before deleting compatibility. |
| P1 | Canary production path | Provisioned protected slot, same artifact, synthetic lifecycle, measured promotion and rollback. |
| P1 | Android offline recovery | Physical device replay/revision/account-isolation evidence. |
| P2 | Mongo restore drill | Restored lifecycle/readiness with measured RTO/RPO. |
| P2 | Conflicting PR triage | Compare each unique diff against current main; preserve useful changes and explicitly authorize remote closing/commenting. |

Live read-only GitHub verification on 2026-10-02 found conflicting open PRs #28/#27/#26/#10/#9/#8/#7 and zero open issues. No PR was closed, merged or commented on, and no issue was published during this implementation.

Read-only PR diff triage against current main:

| PR | Current comparison | Disposition before remote cleanup |
| --- | --- | --- |
| #28 mobile dark theme | Mobile chrome/CSS were substantially rewritten; some restrained theme ideas exist, but the added geometry/action parity checks remain candidates. | Preserve useful assertions and evaluate current design contract; do not apply old palette overrides wholesale. |
| #27 dedicated setup page | `/play/setup/[mode]` and its tests/styles already exist under the current implementation; its old `SessionSetupClient` addition is superseded. | Compare any unique interaction assertions; retain current page architecture. |
| #26 lint/browser repairs | Current result/header labels and E2E assertions differ; progress already has a label, and results use `Toggle details for question …`. | Preserve current passing contracts; evaluate unsaved-answer wording and any still-missing accessible controls separately. |
| #10 search normalization tests | Normalization moved from the controller into question service helpers, with existing tests for punctuation/null. | Port unique whitespace/numeric cases to the current helper if useful; do not restore the obsolete controller export. |
| #9 exam normalization tests | Current test file has four cases; this PR adds additional edge cases but also old dependency lockfile and deployment changes. | Preserve useful test-only cases after checking current expected behavior; exclude obsolete workflow/lockfile changes. |
| #8 dashboard semantics | The route moved to `(app)`; subject filter buttons still lack selected-state semantics. The PR adds roles without a complete keyboard/panel contract and includes generated logs/workflow edits. | Keep as a focused accessibility follow-up with a coherent interaction model; do not merge the stale bundle. |
| #7 Cosmos batching | Current mock-bank writes use MongoDB collections and metadata/revision contracts. Its Cosmos `items.bulk` path is incompatible. | Obsolete implementation; no reason to reintroduce it into the current backend. |
