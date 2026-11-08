# Battle Production Test Matrix

## Scoring
- [x] Correct answer scores once; duplicate, stale, future, and late answers are rejected.
- [x] Answer-versus-timeout race has exactly one final answer log (replica-set integration).

## Reconnect and settlement
- [x] Resume snapshots preserve persisted room state and settlement is duplicate-safe by room code.
- [x] Reconnect-versus-forfeit race and real Mongo transaction settlement race.

## Matchmaking and progression
- [x] Rating-window expansion has unit coverage.
- [x] Concurrent pair claim, mission claim, and cosmetic claim tests against a Mongo replica set.
- [x] Season rollover is idempotent.

## Multi-instance and deployment
- [x] Cross-instance user-room broadcasts with Mongo adapter.
- [ ] SIGTERM under active-battle load and restart/resume drill.

## Production gates
- [x] No duplicate score, settlement, XP claim, or reward claim under replica-set tests.
- [x] Cross-instance delivery acceptance test passes.
- [ ] Staged socket load test and deployment-drain exercise pass.
