# Redis rollout

## Delivery plan and gates

| Stage | Local state | Required verification before production enablement |
| --- | --- | --- |
| Rate limits and question metadata | Implemented | Redis smoke check, 429 headers, question-write revision checks, outage fallback |
| Auth session second-level cache | Implemented | Two API instances: logout, role change, suspension, subscriber disconnect, 30-second maximum stale window |
| Training and progress caches | Implemented | Indexed and legacy pool parity, immediate post-write dashboard/progress reads, latency and memory under realistic load |
| Battle transport and worker coordination | Implemented behind `BATTLE_REDIS_ADAPTER` | Two API instances plus external worker, recovery, Redis interruption, ingress affinity |
| Live activation | Local endpoint configured; smoke passed on 2026-10-01 | Stage traffic, compare p50/p95 and Redis/Mongo operations, then set production secrets |

Complete each verification gate in this order. Keep `BATTLE_REDIS_ADAPTER` unset while `QUIZ_ONLY_MODE=true` or while API and worker processes use different Socket.IO adapters.

## Implemented scope

When `REDIS_URL` is configured, production global, auth, AI, training, agent, and upload limiters use one atomic Redis counter per bucket with a 15-minute fixed window. A Redis connection or command failure falls back to the existing MongoDB store. Question counts and saved topic snapshots use Redis as a 120-second read cache after the existing local cache. The shared training catalog has a five-minute Redis cache after its existing process-local cache. MongoDB remains the source of truth and is used when Redis is absent or unavailable. No frontend connection to Redis is needed.

Additional cache stages now use Redis for a 15-second session second-level cache, shared indexed training candidate lists, a five-second training dashboard, and a ten-second user topic-progress cache. Session invalidations are published to API instances; local session entries expire after 15 seconds. A Redis hit near expiry can extend an undelivered invalidation's exposure to about 30 seconds. Candidate lists exclude user history and keep MongoDB ObjectIds through Extended JSON. Final session selection, learner state, answers, and results stay in MongoDB.

Battle keeps MongoDB tickets and transactional pairing. Redis coordinates matchmaking passes across workers. `BATTLE_REDIS_ADAPTER=true` switches both API and external worker Socket.IO processes to the Redis Streams adapter; the default remains the MongoDB adapter. Redis Streams preserves the existing connection-recovery feature, which the plain Redis Pub/Sub adapter does not support. Configure the same adapter setting on every active Battle process. The production workflow currently sets `QUIZ_ONLY_MODE=true`, so Battle is not active there.

The current `TRAINING_LOCAL_INGRESS` override still bypasses the distributed global limiter for training requests. Keep it disabled unless the existing load-run behavior is intended.

## Configuration and deployment

1. Provision a Redis endpoint reachable from the backend. Use a TLS `rediss://` URL and store it as the backend `REDIS_URL` secret. Do not put the URL in source, logs, or a frontend environment variable.
2. Set `REDIS_NAMESPACE` to a unique value for each environment sharing the Redis service. Without it, the code derives a namespace from the MongoDB connection and database. Use the same namespace on every API instance of one deployment.
3. Deploy the backend with the locked workspace dependencies. Redis is optional: leaving `REDIS_URL` unset retains MongoDB rate limits and MongoDB/local question caches.
4. Run `npm run test:redis:smoke` from `backend` in staging. It passed against the configured endpoint locally on 2026-10-01; repeat it from the deployed backend network. Exercise auth/global limiters, session logout and admin role/status changes across two API instances, training creation and dashboard refresh, topic progress after an answer, and cross-instance Battle events if Battle is enabled. Check 429 headers, new revision totals, and p50/p95 latency before expanding traffic.
5. To roll back, remove `REDIS_URL` and restart the backend. MongoDB rate limiting remains in place. Redis keys expire; no data migration or key deletion is needed.

Redis and MongoDB maintain separate limiter counters. During an outage or recovery within a window, the effective count can restart in the other backend. Both paths remain distributed, but strict continuity across a backend switch is not guaranteed. Test this failure mode in staging before relying on Redis for a tighter abuse budget.

## Boundaries and follow-up verification

The question revision still reads MongoDB on each lookup. That preserves immediate visibility of revisions written by other workers and out-of-band imports. Changing it requires a reliable shared invalidation contract and a test for cross-instance writes.

Training candidate caching activates only with `TRAINING_INDEXED_QUESTIONS=true`. Legacy full-document pools still use MongoDB directly. Dashboard and progress caches have short TTLs so an out-of-band database write or Redis invalidation failure remains bounded. Cross-instance session revocation is prompt when Pub/Sub is healthy and otherwise bounded by about 30 seconds of combined local/shared cache lifetime. Confirm those bounds with an authenticated two-instance staging test before treating them as production guarantees.

Battle's MongoDB queue remains authoritative; replacing it with a Redis sorted set would change ordering and recovery semantics when the index is incomplete. The Redis pass lock reduces duplicate scans without changing transactional pairing. The durable MongoDB job queue stays unchanged. Do not enable the Battle adapter during a mixed Mongo/Redis adapter rollout. Test multi-instance event delivery, recovery, Redis interruption, and sticky-session ingress before enabling it.
