# Azure B1 runtime

`quizguru-backend` uses the existing single-instance Linux Basic B1 plan.

- Azure Always On: enabled.
- Startup command: `npm --workspace backend start`.
- `PROCESS_ROLE=api`, `QUIZ_ONLY_MODE=false`, `RUN_EMBEDDED_WORKERS=true`.
- `RUN_CONCEPT_GROUPING_WORKER=true` remains a fallback; embedded maintenance owns grouping in full mode, so its standalone health entry is correctly `disabled`.
- The embedded registry runs battle maintenance, concept grouping, notification scheduling/reminders and note cleanup. Attachment processing and the battle outbox run in the same API deployment.
- Preserve the existing MongoDB/Redis configuration. `USE_DURABLE_QUEUE` and the Redis Streams battle adapter are separate optional architectures, not prerequisites for full mode. The current runtime uses Mongo-backed jobs and the Mongo Socket.IO adapter.

The deployment workflow preserves Always On/full mode and requires healthy battle/workers, protected battle and AI endpoints, and a Socket.IO handshake before declaring success.

## Verification on 2026-10-12

Live Azure configuration and `/health` confirmed B1, Always On, full mode, healthy MongoDB, Redis, battle and embedded workers on release `4b2d13cd7e1e88046173599a3d63a2ff48f56f52`. The Socket.IO polling handshake succeeded; the protected battle capability route returned 401 without credentials. No production user account was used for an authenticated battle or login test.

Local checks: 9 process-role/optional-service/battle-worker tests and 13 session restoration/auth recovery tests passed. Workflow YAML parsed successfully.

Always On removes idle unloading; it does not guarantee instantaneous authentication or eliminate deployment restarts. Existing HttpOnly-cookie session restoration starts during frontend hydration and still verifies the session with the backend. Expired or revoked sessions require login.

The Azure settings were applied live. The workflow edits are part of this local change and take effect in GitHub Actions after pushing; the old remote workflow still restores quiz-only mode if run before that update is published.
