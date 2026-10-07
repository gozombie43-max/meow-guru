# Redis hardening — Phase B

Implements priorities 8–16 in the supplied recommendation. Phase A remains intact. No Redis provider configuration, production data, deployment, commit, or push was performed.

| Priority | Implemented behavior | Evidence |
| --- | --- | --- |
| 8. Lock fencing | Every distributed cache lease has a UUID owner and an increasing per-key fence. Lua verifies both atomically before publishing. Renewals and releases require the same owner. Fence metadata expires after the cache lifetime plus two lease periods, so distinct keys do not leave permanent fence rows. A builder with an absent or uncertain lease returns source data without publishing, even if Redis recovers during its build. | Real Redis rejects an old builder after another owner publishes, including when fence metadata resets and the numeric token is reused; recovery during failed/unknown lease acquisition never produces an unfenced write. |
| 9. Stampede handling | Bounded in-flight coalescing covers shared cache reads, counts, snapshots, progress, full dashboard reads, authorization, notifications, and cacheable legacy pages. Distributed lock polling has a 250ms budget by default (100ms for progress), then reads Mongo without publishing over the active lease. Redis operations retain their separate one-second timeouts. Pending maps retain no settled result/error and admit at most 256 distinct keys. | 100 concurrent reads share one build; real Redis busy-lock fallback succeeds without overwriting the owner; existing two-cache-instance tests still pass. |
| 10. Canonical keys | Validate and whitelist each question query family, remove ignored parameters, normalize effective limits/flags and aliases, sort keys and session filter lists, and hash shared page/count identities. Preserve exact topic/normalized exam/concept semantics and subject-dependent facets. Reject malformed pagination before cache access. Existing issued cursor fingerprints remain accepted. | Equivalent reordered queries share results; unrelated tracking parameters create no new cache keys; invalid scalar/filter/pagination shapes fail with 400; pagination/alias/facet integration tests. |
| 11. Shared freshness | Shared entries carry absolute fresh/stale deadlines; L1 retains the remaining deadline. Cursor/session pages and catalogs use one tiered local layer. Snapshot cache deadlines also respect the persisted snapshot's one-hour maximum age. Authorization and notification copies preserve their existing absolute expiry. | Near-expiry real Redis warming cannot extend L1 freshness; negative-cache and source-deadline regressions; authorization deadline tests. |
| 12. Outage rate policy | Global/quiz and training traffic retain the normal local emergency allowance. Auth, AI, agent, and upload limits retain a conservative default 0.5 outage multiplier. Shared fixed-window counts remain authoritative after recovery. | Separate availability/conservative tests, boundary/recovery tests and production limiter HTTP tests. |
| 13. Namespace | Production-mode Redis startup requires an explicit environment-qualified namespace. Staging requires its own staging namespace. Explicit identity is independent of Mongo URI spelling. All normal API/worker startup validators enforce this requirement. | Missing, ambiguous, development and cross-environment namespaces fail validation without exposing credentials. |
| 14. Value limits | JSON values are limited to 512KiB; EJSON training candidates to 2MiB. Preflight limits strings, arrays and object traversal before serialization; UTF-8 size is checked after encoding and before decoding shared payloads. Serialization errors/oversized values return source data uncached. L1 and in-flight structures have size/cardinality limits. | Oversized/circular values bypass storage, oversized shared reads become misses, ObjectIds survive EJSON, and oversized tiered results are not retained. |
| 15. Circuit breaker | Five command failures within ten seconds open the optional Redis command circuit for fifteen seconds. Connection failure opens it immediately. One half-open probe checks recovery; concurrent requests use source/local fallback. Subscriber reconnection remains independent. | Deterministic timeout, cooldown, single-probe and recovery tests; bounded connection retry tests. |
| 16. Version reconciliation | Notification counts read durable global/user revisions instead of five-minute Redis revision pointers. Notification creation, receipts and read-all state commit with their revision in a Mongo transaction. Reads retry overlapping mutations and respect the next notification expiry. Global and user scopes are distinct, including an owner named `all`. | Two independent module/connection instances with every Pub/Sub event dropped and simulated Redis outage; real Mongo transaction rollback for all three mutation types; expiration and coalescing tests. |

Cache penetration controls are deliberately bounded: five-second negative caching for empty question pages/counts, typed/length-limited filters, finite L1 capacity, expiring shared values/fences, and bounded pending work. A stream of distinct valid missing topics can still cause Mongo reads; local emergency limits and heavy-query admission remain necessary.

Health exposes `redisCircuit` alongside Redis/subscriber status. New metrics track circuit state, command timeouts, fallback calls, oversized encodings, and serialized value sizes. Metric labels contain neither cache keys nor learner IDs. These metrics are not a provider memory/latency benchmark.

## Configuration before rollout

Set a namespace unique to the application, deployment environment **and logical database** on every API and worker, such as `meow:prod:quizDB` or `meow:staging:quizDB`. Keep existing TLS `rediss://` provider URLs. Do not reuse a namespace across distinct databases. Development/test retain the derived namespace fallback; a configured production Redis with no valid explicit namespace now refuses startup.

The cache protocol uses new tiered/page/count/notification prefixes. Old entries expire naturally. A coordinated rollout is required so earlier workers do not keep using the old behavior.

Notification mutations now require Mongo replica-set transactions, as do the Phase A quiz/training mutations. Verify deployment transaction support and sufficient Mongo read capacity before rollout. Durable revisions intentionally do not expire; cardinality follows owner/global scopes rather than requests or generations.

## Verification

Focused local checks passed 60 unit/integration tests for coalescing, authorization races, durable progress, notification transactions, and canonical queries. An isolated Redis 7.4.3 run passed 29 tests across correctness/reliability, mock submission, progress transactions, and learner-state rebuilding. Further pagination validation passed 22 tests. Backend lint, typecheck/runtime-boundary build, and whitespace checks passed.

The broad runs exposed missing transaction support in older notification route/push mocks; their fixtures now reflect the new persistence contract. Focused route/push verification passed 46 tests. Final review added unknown-lease recovery and full dashboard coalescing regressions; the final cache/training API focused run passed 59 tests. Training fixtures now clear local caches when replacing Mongo rows directly, reflecting their bypass of application invalidation events.

Final complete-suite validation passed **117 files / 687 tests, zero skipped**, with real Redis tests enabled through `REDIS_TEST_URL`. `npm run test:coverage` exited zero and met every configured global/per-file threshold: statements 75.1%, branches 66.84%, functions 70.54%, lines 78.09%. Backend `npm run lint`, `npm run build` (typecheck plus runtime-boundary checks), and `git -c core.safecrlf=false diff --check` passed against the final source.

Evidence is retained at `C:\Users\91906\AppData\Local\Temp\redis-remediation-test-wPgduQ\coverage.log` and `result.json`. The isolated real Redis focused run is retained at `redis-remediation-test-HzU3Fm\focused.log` under the same temp directory. Shared catalog/candidate fixtures now model an acquired lease; their focused verification passed four tests before the final full run.

Test Redis was disposable, bound to loopback, and stopped by the harness; a listener check confirmed the final server port was closed. Mongo integration tests used ephemeral databases/replica sets. Production Redis and Atlas were not used. Earlier broad runs identified fixture issues and were superseded by this passing run; one stale-fixture run was terminated along with its owned test descendants, and its harness cleaned up Redis.

## VERIFIED BUG — addressed

- A delayed lock owner could overwrite a newer cache build; an uncertain acquisition could also publish unfenced after recovery. Shared publication now requires the same live UUID owner and fence, checked atomically.
- A healthy Mongo source could be hidden behind the previous five-second cache-lock waiter failure. Waiters now return one coalesced source read after a bounded wait.
- Layer warming could extend accepted freshness, and ignored/reordered query parameters could fragment cache identity. Absolute deadlines and canonical query families remove these paths.
- Notification reconciliation could reuse five-minute Redis revision pointers after a missed event. Each sensitive read now obtains Mongo revisions; mutation and revision commit together.

## DESIGN RISK

- Outage quotas are local to each API instance. Availability policies avoid halving normal quiz allowances; they do not create a distributed quota while Redis is offline. Measure multi-instance abuse limits, clock skew, database fallback load, and real quiz completion during network loss.
- Cache fences protect publication on the installed standalone Redis client. Redis Cluster and cross-slot Lua behavior are not supported/proven by this change.
- Question revision pointers retain their existing ten-second refresh window. Missed events can delay question-content updates within that window. Learner progress, authorization and notifications use durable correctness checks instead. External writes that do not advance application revisions remain bounded by cache/snapshot age rather than immediate consistency.
- Fences expire and counters can reset after flush/restore. UUID owner checks still reject a displaced builder; Redis cache/persistence is not a durable source of learner progress or notification revisions.
- [Phase C](REDIS_PHASE_C_RESILIENCE.md) implements queue admission, optional startup isolation, topology validation and local outage/recovery tests. Actual provider eviction/persistence guarantees and deployed staging remain release gates. The optional cache command circuit does not govern BullMQ's separate durable client.

## STAGING TEST REQUIRED

- Verify provider topology, ACLs (including Lua/PING/TIME/expiry operations), TLS, reconnect, restart/restore and failover behavior.
- Exercise two deployed API instances through Redis outage/recovery while answering, resuming, loading progress/dashboard data, revoking sessions and marking notifications read. Measure local outage quota behavior and Mongo fallback load.
- Verify Mongo replica-set transaction support, production-shaped payload sizes/concurrency, clock synchronization and the coordinated namespace/protocol rollout.
- Exercise authenticated browser quiz flows, durable BullMQ eviction/persistence assumptions, and release/rollback procedures. Local tests prove the covered races and rollback paths; deployed provider behavior remains unverified.
