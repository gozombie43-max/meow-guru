# 1,000+ user application readiness

This document defines the application-side scale profile for Meow. It does not claim that the current Azure F1 runtime can serve 1,000 concurrent users. Capacity is accepted only after the staged load gates pass on the intended paid runtime and Atlas tier.

## Already scale-safe

- Vercel serves the Next.js frontend and static assets; middleware performs only route/cookie checks and does not call MongoDB or the backend.
- API retries are bounded and mutation retries require idempotency.
- Redis is shared for rate limits, cache coordination and invalidation; MongoDB remains authoritative.
- MongoDB connections are pooled and bounded per API instance.
- Versioned migrations block readiness when required indexes are missing.
- Quiz/training writes use idempotency/revision controls and bounded request bodies.
- Optional AI/enrichment work can be shed without rejecting quiz/auth/progress traffic.

## Runtime profile

Start with these values on a paid API runtime, then tune only from measured pool wait, CPU, memory and Atlas connection headroom:

```text
MONGODB_MAX_POOL_SIZE=30
MONGODB_MIN_POOL_SIZE=0
MONGODB_MAX_CONNECTING=4
MONGODB_WAIT_QUEUE_TIMEOUT_MS=5000
MONGODB_MAX_IDLE_TIME_MS=60000

USE_OVERLOAD_SHEDDING=true
OVERLOAD_EVENT_LOOP_MS=200
OVERLOAD_RSS_MB=768

GLOBAL_RATE_LIMIT_MAX=5000
AUTH_INGRESS_RATE_LIMIT_MAX=2000
AUTH_CREDENTIAL_RATE_LIMIT_MAX=20
TRAINING_INGRESS_RATE_LIMIT_MAX=5000
TRAINING_RATE_LIMIT_MAX=1500
```

When multiple API instances are active and Redis is provisioned as a required shared dependency, also set:

```text
REQUIRE_REDIS_FOR_READINESS=true
```

Do not enable that flag until the deployed Redis endpoint has passed the repository Redis smoke/recovery checks; otherwise healthy API instances will deliberately fail readiness.

## MongoDB connection budget

The maximum application connection budget is approximately:

```text
API instance count × MONGODB_MAX_POOL_SIZE
+ workers
+ migrations/admin/monitoring connections
```

For example, four API instances at the default pool size can consume up to about 120 API connections. Keep material Atlas headroom above that; do not increase the pool simply because concurrency increases. Pool wait and query latency are the signals to tune against.

## Required indexes for the hot quiz path

Migration `015-progress-scale-indexes` makes these indexes deployment prerequisites:

- `userQuestionProgress { userId, questionId }` unique
- `userQuestionProgress { userId, topic }`
- `userTopicProgress { userId, topic }` unique

This protects answer writes, duplicate prevention and topic-progress reads when user volume grows.

## Load gates

Use the staging workflow progressively and stop at the first failed level:

```text
C25 → C50 → C100 → C250 → C500 → C1000
```

The C1000 probe is staging-only. Production probes retain their small safety cap.

Each actor authenticates once and runs a real training lifecycle: dashboard, session creation, visits, answers, finish and dashboard refresh.

Acceptance remains:

- zero request errors
- dashboard p95 <= 300 ms
- session creation p95 <= 800 ms
- answer p95 <= 350 ms
- no Mongo pool exhaustion
- no sustained event-loop or memory pressure
- Redis remains healthy
- Atlas connection/CPU/cache headroom remains acceptable

Also use the read-only API load probe for high-fanout question/session reads; it supports up to 100,000 requests and C1000.

## Moving to Azure B1 or another paid Node host

The application code should not require a redesign. The infrastructure checklist is:

1. Enable an always-on Node process.
2. Run at least two API instances before claiming high availability.
3. Route health checks to `/health`.
4. Keep all instances on the same Redis namespace and MongoDB database.
5. Apply migrations before routing traffic to the new release.
6. Enable `USE_OVERLOAD_SHEDDING=true`.
7. After Redis recovery validation, enable `REQUIRE_REDIS_FOR_READINESS=true`.
8. Run C25 through C1000 on the production-like staging environment.
9. Tune instance count and Mongo pool size from measured data, not registered-user count.

No microservices, Kubernetes, sharding or second database are required for this target.
