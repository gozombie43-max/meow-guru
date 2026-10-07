# Redis correctness remediation — Phase A

Scope: the seven verified bugs from the Redis audit, as prioritized in the supplied recommendation. Phase B hardening is recorded separately in [REDIS_PHASE_B_HARDENING.md](REDIS_PHASE_B_HARDENING.md). Phase C implementation/local fault evidence is recorded in [REDIS_PHASE_C_RESILIENCE.md](REDIS_PHASE_C_RESILIENCE.md); deployed staging gates remain outstanding. No deployment, production data migration, or Redis server configuration change was performed.

## Implemented behavior

| Finding | Change | Regression evidence |
| --- | --- | --- |
| An in-flight authorization read could repopulate a revoked session or removed role | Every authorization checks the active Mongo session and current account. Session/account revisions select a v2 shared key; a second durable read guards shared-cache waits. Cache entries retain an absolute expiry when copied to L1. | Logout and role-change overlaps; two module instances with missed events; account suspension; forced revocation; shared-to-local expiry. |
| Offline invalidation could preserve stale learner progress/dashboard epochs | Mongo counters select v2 keys. Source mutations and counters commit in the same transaction. Every cache hit rechecks the durable counter after its Redis read. Delayed builders write only their original generation. | Offline/missed-event cache tests; overlapping reads; real replica-set answer/training/mock commit and rollback tests. |
| General invalidation subscriber did not recover after failure | A dedicated bounded subscriber reconnects with jitter, retries startup/terminal failures, and clears advisory caches after connection gaps. `/health` exposes subscriber state, reconnect count, and last received event. | Unit startup/retry/shutdown tests and real Redis TCP disconnect/resubscription. |
| Previous local rate window overrode a new Redis window | Redis Lua uses server time and fixed window boundaries; local fallback uses matching boundaries. Healthy Redis counts are authoritative. Local observations reject older shared windows. v2 counter keys separate the previous rolling-window protocol. | Boundary/outage/recovery unit tests; real Redis rollover and two-store counter sharing. |
| Clearing question revisions could make an old promise resolve to itself | Clearing releases the pending pointer before the generation advances. The revision registration also has a durable module owner so garbage collection cannot remove it from the weak cache registry. | Concurrent clear/read regression and training candidate cache integration tests. |
| Persisted topic snapshots could survive indefinitely after external question writes | Snapshot reuse requires a valid generation and a generation timestamp younger than one hour. Operational normalization, training metadata, image migration, reset, staging sync and identity-remediation scripts retire the revision even after partial failure; image edits invalidate metadata. | Ancient same-revision snapshot regression; partial-import failure regression; existing publishing and snapshot integration tests. |
| Legacy question page cache omitted `includeTotal` | Cache identity includes its normalized boolean value. | A cached response without totals cannot satisfy a later request with totals. |

Dashboard generations cover session creation, active transitions, completion/abandonment, diagnosis, mistake/review updates, mock submission, and learner-state rebuilds. Topic generations advance only when solved/mastered totals change. Optimistic conflicts do not advance the generation.

Existing records need no backfill: absent revisions read as zero, and the first mutation creates the counter. Old Redis entries expire under their existing TTLs; they cannot satisfy v2 reads. Mongo revision rows deliberately have no TTL. Their cardinality follows learner scopes, rather than requests or generations.

## Verification

The focused unit/integration run passed 65 tests. Existing training API and mock-history integration tests passed 55 tests. Six additional real Mongo replica-set tests verified transactional progress generations and rollback on revision-write failure. The isolated Redis 7.4.3 run passed 25 tests across real Redis correctness/reliability, mock HTTP submission, progress transactions, and learner-state rebuilding. Its server was bound to loopback and stopped after the run; production Redis was not used.

The first broad run found an outdated standalone Mongo mock-test fixture and a weakly owned question revision registration. The mock fixture now uses a replica set, matching the new atomic submission contract; the registration has an exported module owner. Both focused reruns pass.

Final complete-suite validation passed **113 files / 644 tests, zero skipped**, with the real Redis tests enabled through `REDIS_TEST_URL`. `npm run test:coverage` exited zero: lines 77.99%, statements 74.78%, functions 69.78%, branches 66%; all configured global and per-file thresholds passed. Session authorization coverage was 99.15% lines and 92.2% branches. Backend `npm run lint`, `npm run build` (typecheck plus runtime-boundary checks), and `git -c core.safecrlf=false diff --check` passed.

Local test evidence is retained at `C:\Users\91906\AppData\Local\Temp\redis-remediation-test-YQln9x\coverage.log` and `result.json`; focused Redis evidence is at `redis-remediation-test-TxPHem\focused.log` under the same temp directory. Both disposable Redis processes stopped after their tests. The source Redis 7.4.3 Windows archive came from the redis-windows release and had SHA-256 `F6FE3DBBEA180672FE08CBA80759168EA68A51CD7EE4F097E1B8905A053D0AD1` (locally calculated).

To reproduce, run backend `npm run test:coverage` with `REDIS_URL` empty and `REDIS_TEST_URL` pointing to a **disposable** local/CI Redis server, followed by `npm run lint` and `npm run build`. The tests use independent namespaces and ephemeral Mongo replica sets. The subscriber test disconnects only its own uniquely named client. The existing CI Redis job now includes both correctness and reliability suites. GitHub Actions and staging were not run here.

## Remaining verification and tradeoffs

- Mongo replica-set transactions are now required for active training writes and mock submission, in addition to existing answer/completion transactions. Verify this on the staging deployment before rollout.
- Authorization performs two Mongo reads on an L1 hit and four on a shared-cache miss/hit before reuse. Progress cache hits perform two durable revision reads. Stage load tests must measure the added Mongo traffic, pool pressure, and latency.
- Fixed rate windows allow boundary bursts. Phase B applies endpoint-specific local outage allowances; distributed quotas during outages remain a staging/design limitation.
- Redis Pub/Sub remains advisory and cannot replay messages missed during an outage. Durable authorization/progress checks protect these sensitive reads. Question content still uses its existing ten-second revision refresh interval; the one-hour snapshot age is a recovery bound for untracked external changes.
- Bulk operational scripts do not become transactions. Their revision advances in `finally`, including partial failures. Identity remediation retains its existing maintenance write fence. Do not allow application writers during that maintenance rebuild.
- Phase B implements namespace enforcement, fenced cache publication, value/serialization limits, bounded penetration controls and endpoint-specific outage policy. Phase C implements optional startup isolation, queue admission/topology checks and disposable multi-process restart/restore tests. Provider configuration, failover and two deployed API-instance fault tests remain staging gates.
- A rolling deployment can retain old workers/API instances using the previous protocol. Staging must validate a coordinated rollout before claiming immediate invalidation across all instances.
