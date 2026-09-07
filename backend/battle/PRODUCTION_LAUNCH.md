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
