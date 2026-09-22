# Training performance verification and rollout

Verified against repository base `388ee38` on 2026-09-22. The source-level hotspots in the supplied audit were present. Its numerical scores and deployment capacity estimates are not benchmarks and were not independently established here.

## Implemented

| Audit finding | Change |
| --- | --- |
| Full action responses | The frontend requests `?response=delta`. Active responses carry a base revision, changed answers and current public state. Question IDs are sent only on reorder; recovery content is sent only when inserted. Completion and legacy callers receive full snapshots. |
| Full clone and Mongo rewrite | Transitions copy mutable containers and the current answer. Mongo writes changed fields, increments revisions and appends events. Adaptive order is a separate `questionOrder` array; recovery content is appended once. All repository session readers restore logical order. Completion learning remains transactional. |
| No realistic training load harness | `npm run test:load:training` creates an isolated local replica set, seeds 3,500 questions and uses real authentication and production rate-limit middleware. Section learners perform dashboard/create/sequential visits and answers/finish/dashboard; adaptive and mission scenarios measure exam-wide session creation. CI runs stages 1 and 5 for all three scenarios and fails if active answer or visit deltas reach 2 KB. Defaults are 1/5/10/25/50. |
| Regex candidate filters and full candidate content | A gated path uses exact canonical exam memberships and subjects, persisted eligibility and compact ranking metadata. Only selected questions and the bounded gauntlet reserve are hydrated. Exam memberships are arrays to preserve combined CGL/CHSL labels. Topic display values and legacy topic aliases remain supported. |
| Duplicate limiter writes | `TRAINING_LOCAL_INGRESS=true` substitutes a process-local IP guard for the global Mongo counter on training routes. The authenticated durable training quota remains. The default retains the existing distributed global quota. |
| Full historical sessions and rebuilding skills | History reads project only learning and result evidence. Durable state becomes authoritative only when its per-user/exam meta row is `version: 1, status: ready`; otherwise compatibility replay remains. |
| Every dashboard writes a profile | Removed the unused synchronous `userSkillProfile` snapshot write. Expired-session finalization still writes transactionally when needed. |
| Repeated catalog aggregation | A database/exam-scoped cache coalesces concurrent reads, expires after five minutes, drops failures, and invalidates on application question writes. Other instances and external imports see changes within the TTL. |
| Whole page ticks every second | Only the clock and pace components tick. A deadline timer controls expiration and automatic finish. Tests cover stable parent renders, server skew, pending saves and error suppression. |
| Runtime metrics disabled in quiz mode | Runtime metrics now start in quiz-only mode too, at the existing 30-second interval. A total session-create timer includes history, durable state, exposure, selection, hydration and insertion. |
| Broad exposure lookup and small write/index issues | Exposure reads filter candidate IDs. Mistake review updates use `bulkWrite`. Migrations 008 and 009 add canonical subject and exam-wide candidate indexes plus the completed mock-attempt index; local explain tests cover subject and no-subject paths. |

New question metadata is maintained by normal single/bulk writes, edits, approved variants, mock-bank imports and the standalone uploader. Imports that bypass these writers require the backfill before indexed selection is used.

## Rollout

The backend release `4eaec1c` deployed successfully. The deployment workflow applied migrations `008-training-performance` and `009-training-exam-wide-candidates` before release. On 2026-09-22, the production metadata backfill scanned and updated 21,434 questions with zero conflicts; a second dry run found zero remaining candidates. `TRAINING_INDEXED_QUESTIONS=true` and `TRAINING_LOCAL_INGRESS=true` are enabled on the single App Service instance, which was restarted and returned healthy readiness checks.

The backfill preserves question text, options, keys, and display taxonomy. Future external importers that bypass the normal writers still require the same backfill verification before indexed selection is relied on.

The remote probe now supports controlled authenticated staging/production lifecycle measurement without weakening the local harness safety boundary. It requires an exact expected hostname, a repeated production-host confirmation for production, dedicated synthetic credentials and a new JSON report file. It verifies `/api/health` before login and requires its server-attested environment to match the requested target; the report records deployed release ID, environment, readiness state and service mode. An optional expected release ID fails a mismatched deployment. Production defaults to one synthetic learner and rejects concurrent runs without an explicit override; staging is the appropriate target for concurrency testing.

### Production C1 evidence

On 2026-09-22, the authenticated production lifecycle probe was run three times against Azure App Service + MongoDB Atlas on release `be02aa9a815b8b8c726004b9afa1dd4f70afd0dd`. Each run used one synthetic learner, one 10-question lifecycle, and zero concurrency beyond that single learner. All three runs completed with zero errors and all investigation thresholds passed.

| Operation | Run 1 | Run 2 | Run 3 | Worst observed | Investigation threshold |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dashboard p95 | 615.39 ms | 380.03 ms | 358.65 ms | 615.39 ms | 750 ms |
| Create | 685.89 ms | 587.35 ms | 510.58 ms | 685.89 ms | 1500 ms |
| Answer p95 | 314.89 ms | 276.91 ms | 276.95 ms | 314.89 ms | 400 ms |
| Visit p95 | 333.98 ms | 268.51 ms | 277.81 ms | 333.98 ms | 400 ms |
| Finish | 363.03 ms | 314.33 ms | 323.70 ms | 363.03 ms | 1000 ms |

Interactive answer and visit responses remained compact at roughly 755-759 bytes on average. Dashboard payloads grew from roughly 24.5 KB average in the first run to 30.9 KB average in the third run as the synthetic account accumulated history; latency still stayed below the investigation threshold. This should be monitored as history grows, but it is not currently a measured defect.

These measurements validate production C1 correctness and baseline latency only. They do not establish production C5/C10 capacity, sustained throughput, autoscaling behavior, multi-instance correctness, or Atlas saturation limits. Higher-concurrency validation belongs in staging/non-production with a separate database and should not be run against the Azure F1 production instance.

Session persistence now separates physical question content from logical order. All updated repository readers understand both old sessions and the new `questionOrder` field. A backend downgrade must first restore physical arrays to the saved logical order; an older backend does not understand the new field. Frontend rollback remains supported by full action responses.

## Durable learner-state migration

Migration 010 adds `trainingLearnerStateMeta`. It replaces the bounded recent-history authority heuristic with a per-user/exam `{ version: 1, status: 'ready' }` marker. The separate `npm run db:training-state-backfill` command is inspection-only by default; its `--apply` mode replays every completed session in chronological order through the same learner-state reducer used by live completion, replaces skills/reviews/exposures transactionally, and records the source counts and final session. `completionEpoch` prevents a backfill from committing over a concurrent completion: the pair is retried when the epoch changes.

Training actions now emit both `training.action.commit.duration_ms` for the durable write and `training.action.duration_ms` for the complete application action, with action type, mode and delta-response information. The former `training.learning.commit.duration_ms` remains for compatibility.

The learner-state backfill is a separate production operation and is not considered complete without recorded production evidence. On 2026-09-22, the Atlas target configured for this backend was inspected, rebuilt with `--apply`, then inspected again. It contained two completed user/exam pairs; both reported `version: 1, status: 'ready'`, with zero non-ready pairs and zero stored-source-count mismatches. The source evidence totaled 29 completed sessions and 47 attempts before and after the rebuild. Pairs that are absent, pending, failed, or whose source counts change require investigation or a rerun before the migration is closed.

## Local evidence

The detailed load report is [training-load-results.json](training-load-results.json). Each stage reports p50/p95/p99, errors and response sizes separately for dashboard, creation, answers, visits and completion. It is a short synthetic burst using one session per learner, no think time, local MongoDB, and 20 questions per session. Authentication uses generated test accounts and the normal session issuer; password-login throughput is not measured. These results do not establish sustained capacity, large-history performance, network latency or Azure/Atlas limits.

Validation results and the final load table are recorded below after the final checks.
