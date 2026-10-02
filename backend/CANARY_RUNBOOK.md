# Canary and database rollout

The current checked-in deployment selects quiz-only mode. Queue activation and extra workers require deliberate settings; they are not enabled by these changes.

Azure staging slots require Standard, Premium or Isolated plans. Confirm the actual plan before using slot commands. Do not provision extra Web Apps or upgrade a plan just to satisfy this example. [Azure slot documentation](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots).

For an existing supported plan with a protected canary slot:

1. Build the locked artifact and pass the complete CI quality gate, including real Redis tests.
2. Apply additive migrations `013-idempotency` and `014-feed-keysets`; verify migration readiness and the compound feed indexes before traffic routing. Never remove fields/indexes in the same release that switches reads.
3. Deploy the exact reviewed artifact to the canary slot. Verify its `/health` releaseId/environment and run the authenticated synthetic quiz lifecycle in the isolated staging database first.
4. Configure canary slot settings for the production database before traffic routing; never send real users to a staging database. Keep migrations compatible with both releases. Preserve the previous production artifact and settings.
5. Route 5% traffic to the canary. Collect at least five minutes and 100 requests, including answer and session-create traffic. Record `requests`, `errors`, `getP95Ms`, `answerP95Ms`, `createP95Ms`, `ready`, `releaseMatches`, exact `releaseId`, `windowSeconds` and ISO `collectedAt` in a JSON observation artifact. Observations must be no older than two minutes. Missing signals mean rollback.
6. Run `node backend/scripts/evaluate-canary.js observations.json decision.json`. On failure, reset canary routing to zero immediately; retain the observation and decision artifacts. On success, promote by slot swap and reset routing, then repeat release readiness and the authenticated synthetic lifecycle. The opt-in workflow automates routing, evaluation, swap and release-readiness rollback for existing slots; synthetic lifecycle verification remains an operator step until scoped synthetic credentials are configured. Rollback verifies the serving release before swapping, so a failed original swap cannot accidentally promote the canary.

The production push workflow is retained until a supported slot and monitoring source exist. Activating a slot workflow requires the protected `backend-canary` environment and measured observation generation. No local command here changes cloud traffic.

Feature rollout settings: `USE_COMPACT_TRAINING_HISTORY` plus `_PERCENT` supports stable per-user 0/1/10/50/100 percent cohorts. `USE_DURABLE_QUEUE`, `USE_OVERLOAD_SHEDDING`, `OTEL_ENABLED` and `NEXT_PUBLIC_OFFLINE_TRAINING` are off until their associated checks pass. Disable a flag to restore the prior path. Queue enablement requires Redis with persistence and `maxmemory-policy=noeviction`; cache eviction Redis is unsuitable for durable jobs. A separate logical DB does not change an instance's eviction policy.

Set `QUEUE_REDIS_URL` to the persistent queue instance; caches/limits/coordination continue using `REDIS_URL`. Falling back to that cache endpoint requires `QUEUE_REDIS_ALLOW_SHARED=true`. On either path startup checks CONFIG GET and INFO persistence before creating schedules/workers, rejects eviction policies and disabled/unhealthy persistence, and fails closed if inspection is denied. Ensure the queue ACL permits those read-only checks. Managed Redis requiring another verification mechanism needs a provider-specific adapter before activation. A passing startup check does not replace restart/worker-crash recovery drills. Snapshot persistence can lose changes since the latest snapshot; choose AOF/backups to meet the required RPO.

Dedicated Atlas tier, backups/PITR, autoscaling, termination protection and region alignment remain measurement-dependent operational steps. Compare sustained C1–C100 latency, pool wait, CPU/memory, database round trips and restore tests before spending or moving production. Keep correctness-sensitive reads on the primary; secondary reads must prove revision/causal consistency before being enabled. Do not shard or introduce microservices for this rollout.

Expand → deploy compatible code → dry-run backfill → apply in a controlled window → verify reconciled counts → enable cohort reads → retain rollback window → contract in a separate future release. Learner-state rebuilds also populate compact dashboard evidence; old records continue using full history safely.
