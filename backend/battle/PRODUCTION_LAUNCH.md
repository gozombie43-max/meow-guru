# Meow Battle Production Launch

## Automated and database gates
- [x] Unit/Battle tests green
- [ ] Replica-set concurrency and multi-instance tests green
- [ ] Production indexes validated with an Atlas-safe index check
- [ ] Atlas backups enabled and restore runbook verified

## Azure and operations
- [ ] WebSockets, Always On, HTTPS, health checks, and Mongo adapter verified
- [ ] Graceful SIGTERM/reconnect drill passed
- [ ] Integrity and Competitive Health dashboards reviewed
- [ ] Stale rooms, queue tickets, and settlement backlog are zero

## Rollout and rollback
- [ ] Internal allowlist tested
- [ ] 5%, 10%, 25%, 50%, and 100% rollout stages observed
- [ ] New-match, matchmaking, ranked, mission, and reward switches tested
- [ ] Existing rooms can resume, answer, and settle while new matches are disabled
- [ ] 20/100-player load stages pass with no duplicate scoring or settlement

## Executable release checks

Run from `backend`:

```powershell
npm test -- battle auth/__tests__/socketPrincipal.test.js auth/__tests__/sessions.race.test.js
npm run test:battle:load
npm run check:battle:readiness
```

The first two commands use isolated test databases. The readiness command reads
the configured database and never creates indexes or repairs records. Apply
migrations 019/020 and run the guarded battle metadata backfill before rollout;
see [COMPETITIVE_POLICY.md](COMPETITIVE_POLICY.md).

The automated suite covers server replacement/reconnect, persisted reveals,
answer secrecy, all JAM answer kinds, 20/100 real socket clients on two local
instances, and duplicate-safe settlement. Keep the deployment checklist above
open until evidence comes from the actual target environment. The local burst
tests do not measure Internet latency, Atlas limits, sustained traffic, actual
process SIGTERM or Azure deployment behavior.

For each rollout stage, record the release ID, allowlist/percentage, test-account
count, connection/reconnect failures, answer/reveal latency percentiles, Mongo
pool waits, degraded coordinator metric and settlement backlog. Disable new
matches first during rollback so existing rooms can drain; the ranked switch
also disables Elo and competitive progression for unsettled matches.

Verify backups in Atlas, restore a snapshot into an isolated target and check
room/match uniqueness plus sample settled answer logs before recording the restore
gate. Run an Azure deployment with active test-account battles, reconnect within
the deployment grace window, and verify one settlement per room. Observe 20 and
100 simultaneous players under sustained remote traffic before increasing rollout.
