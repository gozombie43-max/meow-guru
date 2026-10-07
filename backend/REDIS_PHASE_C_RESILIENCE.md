# Redis operational resilience — Phase C

Phase C implementation and disposable local fault testing follow [Phase A](REDIS_CORRECTNESS_REMEDIATION.md) and [Phase B](REDIS_PHASE_B_HARDENING.md). Real deployed staging/provider failover remains a release gate. No production Redis, Atlas data, deployment configuration, or infrastructure topology was changed.

## Implemented behavior

| Priority | Implementation | Local evidence |
| --- | --- | --- |
| 17. Long-lived progress revisions | Already implemented in Phase A: non-expiring Mongo counters advance in the same transaction as quiz/training progress. Redis holds values selected by those counters. | Two actual API processes keep progress correct during Redis loss. An RDB snapshot restores the old progress entry with a deliberately extended valid deadline; a newly started third API still returns current Mongo progress. Existing transactional progress tests cover rollback and delayed reads. |
| 18. Optional startup isolation | The Mongo-ready API listens before starting advisory cache subscribers, Battle, and embedded workers. Partial starts are cleaned up. Optional failures and runtime degradation have separate health states. Battle HTTP admission returns 503 while its configured adapter is unavailable. Explicit critical flags retain startup failure and readiness barriers. | Actual entry-point tests start full-mode APIs with both cache and queue Redis offline: health and quiz session reads succeed, Battle returns 503. Each critical flag separately makes startup exit 1. A live Battle adapter disconnect degrades optional health while quiz reads succeed; a critical API reports 503 readiness with Mongo still healthy, then recovers. |
| 19. Queue admission | Atomic Lua snapshots/reservations count waiting, paused, prioritized, and delayed jobs across producers. Hash owner IDs into expiring fixed-window quota keys. Validate tasks, deduplication keys, delay, priority and owner; coalesce concurrent duplicates; use bounded native BullMQ deduplication and reject jobs past their ready-age SLA. | Two real BullMQ producers contend with 100 requests against a three-job waiting cap and a two-job delayed cap. Existing-job retries do not consume another owner quota. Unit tests cover HTTP-style error codes, duplicate coalescing and ready-age rejection. |
| 20. Queue/cache isolation | Preserve distinct cache and queue URLs and add a distinct queue namespace. Reject same host/port sharing unless explicitly allowed, even with different database numbers, TLS schemes or ACL accounts. Preserve noeviction and healthy enabled persistence checks. | Shared-server/different-database rejection, separate namespace/TLS tests, existing eviction and persistence rejection tests, and fault tests using two separate owned Redis servers. No provider resource was provisioned. |
| 21. Failure/recovery suite | Add a controlled executable-based suite with actual API processes, disposable Mongo replica set, owned Redis processes and real BullMQ workers. Add CI steps to run it separately from the service Redis tests. | Quiz answer/retry, dashboard availability, stale snapshot recovery, cross-process logout/role removal, subscriber replacement, cache flush, Q241 window resume, startup and runtime optional failures, worker death, and queue reconnect. Existing real Redis tests cover shared rate-window rollover and cache fencing, including genuine lease expiry. |

The standalone maintenance worker keeps its durable queue as a readiness dependency. Quiz-only maintenance excludes Battle pollers and schedules. The Battle outbox starts only with a ready Battle participant. Existing callback signatures are preserved: queue handlers receive no injected Date/generator argument.

## Queue policy and rollout configuration

Defaults are limits, not capacity estimates for a provider:

| Setting | Default | Purpose |
| --- | --- | --- |
| `QUEUE_MAX_WAITING_JOBS` | 20,000 | Immediate-job admission, including paused and prioritized jobs |
| `QUEUE_MAX_DELAYED_JOBS` | 5,000 | Delayed-job admission |
| `QUEUE_OWNER_MAX_ENQUEUES` | 100 | New enqueue admissions per owner/window |
| `QUEUE_OWNER_WINDOW_MS` | 60,000 | Fixed window chosen using Redis server time |
| `QUEUE_DEDUPE_WINDOW_MS` | 3,600,000 | Native deduplication TTL; retained jobs can extend effective deduplication |
| `QUEUE_MAX_READY_AGE_MS` | 1,800,000 | Maximum age after the original delay becomes eligible; old jobs fail without futile retries |
| `BATTLE_REDIS_CRITICAL` | false | Explicit Battle startup/readiness dependency |
| `EMBEDDED_WORKERS_CRITICAL` | false | Explicit embedded-worker startup/readiness dependency |

Production/staging require an environment-qualified `QUEUE_REDIS_NAMESPACE`, or a valid `REDIS_NAMESPACE` fallback. Set the same queue URL, namespace, policy and worker budgets on all participants. Keep provider TLS `rediss://` URLs. Namespaces must identify the application, environment and logical database. `.env.example` documents the new settings; durable queue and embedded workers remain disabled by default there.

Queue admission rejects backlog/durability failure with `statusCode: 503`, owner quota with `429`, and malformed work with `400`. The helper currently has no application HTTP enqueue caller; a future caller must derive `ownerId` from the authenticated server-side identity. Background work defaults to the fixed `system` owner. Queue task registries are limited to 16 known task names. Production periodic jobs use native schedulers rather than a stream of arbitrary enqueue IDs.

Producers have a two-second command timeout, no offline queue, no automatic resend of unfulfilled commands and one retry per request. Initial connection failure fails activation promptly; an established producer reconnects with bounded jitter. Workers retain BullMQ's required unlimited connection retries. Close events revoke durability admission immediately. Reconnect must reverify policy/persistence and reapply concurrency/scheduler metadata before new admission; a 30-second timer also detects provider policy drift. This timer adds four policy/status requests per interval, independent of learner traffic.

Failed optional startup requires process restart after the dependency is repaired. Successfully started subscribers, Battle clients and queue producers use their own reconnect paths. Cache-subscriber lifecycle initialization is distinct from actual subscription state: consult `cacheInvalidationSubscriber` and Redis health as well as `optionalServices`.

Coordinate the rollout with Phase A/B. Explicitly setting a new queue namespace creates a different queue; it does not move old jobs. Drain/reconcile old queues and schedulers before switching. Enqueue IDs now include task, deduplication key and owner. Earlier producers must not continue producing concurrently under the previous identity policy.

## VERIFIED BUG — addressed

- Awaiting optional Battle/embedded Redis startup before opening the listener could prevent a healthy Mongo quiz API from starting. Real entry-point tests now reproduce healthy quiz startup with those dependencies offline.
- Optional service health previously described configured workers rather than runtime availability. Health now reports initialization failure and provider degradation separately; explicit critical readiness is enforced without misreporting Mongo as offline.
- Reconnection after an older queue snapshot could leave lost scheduler/global concurrency metadata unreconciled. Producer recovery restores its bounded configuration before accepting new work; a real restart from an empty pre-queue snapshot covers this path.
- Quiz-only maintenance could still include Battle schedules, and outbox startup could occur without a ready Battle participant. These paths now follow mode/service readiness.

## DESIGN RISK

- Admission reservations and BullMQ insertion are separate commands. Reservations expire after 30 seconds, and producer commands are bounded/no-resend; an uncertain server execution lasting beyond the lease is still not an absolute transactional capacity guarantee. Admission controls optional enqueue traffic. Periodic scheduler production, direct `queue.add` callers, delayed-job promotion, and jobs becoming pending again after failure can bypass or change the admission snapshot. Active jobs are excluded. Do not describe this as a hard cap on every BullMQ state.
- Native deduplication does not make handler side effects exactly once. The worker-crash fixture commits a Mongo effect idempotently, dies before acknowledgement, and proves that a replacement executes again with one effect. Existing reminder workers use atomic at-most-once claims and may omit a push after a crash; scheduled pushes leave ambiguous processing failures for review. Provider sends, external deletes and AI billing still need handler-specific recovery tests.
- Healthy enabled RDB/AOF is a configuration/status check, not zero-loss durability. RDB may lose work since the last snapshot; AOF guarantees depend on fsync/provider replication. Metadata reconciliation restores settings, not lost historical jobs. Alert on failed persistence, memory exhaustion, oldest ready job, waiting/delayed counts, retained failures and dead-letter work. This change exposes/configures admission and SLA checks; it does not provision dashboards or provider alerts.
- A provider policy change can precede the next 30-second check. Workers already executing when Redis fails cannot roll back external side effects. Draining an offline worker may reach the existing process shutdown deadline.
- Same-host checks cannot discover DNS aliases/proxies pointing to the same physical server. Distinct URLs/namespaces/databases do not prove memory or eviction isolation. Multi-key Lua assumes standalone Redis; Redis Cluster hash-slot behavior remains unproven.
- Outage rate quotas remain local to each API; Pub/Sub remains advisory. Durable Mongo revisions/authorization protect learner progress and sessions. Question content retains its Phase B refresh/snapshot bounds, and writes outside the application revision protocol remain a consistency risk.
- Retained BullMQ jobs/events have existing age/count limits; pruning is activity-driven. Old scheduler names from previous releases require operational reconciliation. Measure queue memory under realistic retained failures, stalled work and distinct deduplication keys.

## STAGING TEST REQUIRED

| Scenario on the deployed topology | Required observation |
| --- | --- |
| Cache network loss/kill during authenticated quiz and training writes | Answer/resume/completion remain usable; record API latency, Mongo fallback/pool load, circuit and local quotas on both instances |
| Provider restart, restore and failover | Current learner progress, training dashboard and revocation remain authoritative; verify RPO, reconnect timing and no replay of old admin roles |
| Logout/role removal on API A during subscriber loss | API B rejects the old session/permissions, including a signed-in browser and concurrent requests |
| Rate-window rollover and clock skew | Both deployed APIs use the same Redis window while healthy; measure boundary bursts and per-instance outage allowances |
| Slow builder beyond lease TTL and cold-cache load | Late owner cannot publish over the winner; observe Mongo rebuild load and lock waiter budgets |
| Resume Q241 in the browser | One initial window request; correct question/anchor and subsequent navigation |
| Worker kill before/after each real handler's effect | Recovery honors handler-specific idempotent or at-most-once semantics; no duplicate reward/push/delete and no silently stuck work |
| Queue/cache memory pressure and policy/persistence drift | Cache eviction does not affect queue Redis; rejected queue admissions remain bounded; alerts and persistence recovery match the chosen provider guarantees |
| Healthy/full-mode shutdown and release rollback | Pending startup and active workers drain within budget; no mixed namespaces/protocols or orphaned schedulers |

Run disruptive tests only against an explicitly isolated staging target with a documented restore/rollback procedure. The local executable suite is not a command to stop configured provider Redis.

## Verification

Focused checks passed 36 configuration/queue/lifecycle/adapter tests. Six real Redis regression files passed 32 tests. The strengthened operational suite passed all five fault scenarios against disposable Redis 7.4.3 and Mongo replica sets. Final complete-suite validation passed **120 files / 702 tests, zero skipped**, with both `REDIS_TEST_URL` and `REDIS_FAULT_TEST_BIN` enabled. `npm run test:coverage` exited zero in 233.24 seconds and met every configured global/per-file threshold: statements 75.03%, branches 66.78%, functions 70.51%, lines 78.01%.

Backend `npm run lint`, `npm run build` (typecheck plus runtime-boundary checks), and `git -c core.safecrlf=false diff --check` passed against the final source. The CI workflow parsed with the installed YAML parser; GitHub Actions itself was not run. Final evidence is retained at `C:\Users\91906\AppData\Local\Temp\redis-remediation-test-E8eZZ3\coverage.log` and `result.json`. Real Redis focused evidence is at `redis-remediation-test-c26dIy\focused.log` under the same temp directory. Earlier fixture failures were corrected and superseded by these passing results.

All test-owned API/worker and Redis children stopped through the test cleanup/harness. A listener check confirmed the final harness Redis port 56585 was closed, and process inspection found no remaining owned API/crash-worker/harness processes. Mongo databases and all fault targets were disposable local fixtures.

To reproduce the controlled faults: set `REDIS_FAULT_TEST_BIN` to a local `redis-server` executable and run `npm test -- infrastructure/__tests__/redisOperational.integration.test.js` from `backend`. It allocates loopback ports/temp directories, starts actual API/worker children, and stops owned processes. It never kills `REDIS_URL` or `REDIS_TEST_URL`. For the complete suite also provide `REDIS_TEST_URL` pointing to disposable Redis with noeviction and healthy enabled persistence. CI separates this from a Redis 7.4 service on host port 16379 so the fault executable never targets the service.

GitHub Actions, authenticated browser behavior, real deployed two-instance staging, provider failover, and production rollout were not run here. The Phase A–C changes are included in the requested local commit; no push or deployment was performed.
