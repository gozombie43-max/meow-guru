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
| Full historical sessions and rebuilding skills | History reads project only learning and result evidence. When recent history is fully marked `learningApplied`, durable skills are primary. Legacy histories still replay projected metadata for compatibility; this change does not discard or destructively rebuild historical learning. |
| Every dashboard writes a profile | Removed the unused synchronous `userSkillProfile` snapshot write. Expired-session finalization still writes transactionally when needed. |
| Repeated catalog aggregation | A database/exam-scoped cache coalesces concurrent reads, expires after five minutes, drops failures, and invalidates on application question writes. Other instances and external imports see changes within the TTL. |
| Whole page ticks every second | Only the clock and pace components tick. A deadline timer controls expiration and automatic finish. Tests cover stable parent renders, server skew, pending saves and error suppression. |
| Runtime metrics disabled in quiz mode | Runtime metrics now start in quiz-only mode too, at the existing 30-second interval. A total session-create timer includes history, durable state, exposure, selection, hydration and insertion. |
| Broad exposure lookup and small write/index issues | Exposure reads filter candidate IDs. Mistake review updates use `bulkWrite`. Migrations 008 and 009 add canonical subject and exam-wide candidate indexes plus the completed mock-attempt index; local explain tests cover subject and no-subject paths. |

New question metadata is maintained by normal single/bulk writes, edits, approved variants, mock-bank imports and the standalone uploader. Imports that bypass these writers require the backfill before indexed selection is used.

## Rollout

The backend release `b832c5b` deployed successfully. The deployment workflow applied migrations `008-training-performance` and `009-training-exam-wide-candidates` before release. On 2026-09-22, the production metadata backfill scanned and updated 21,434 questions with zero conflicts; a second dry run found zero remaining candidates. `TRAINING_INDEXED_QUESTIONS=true` and `TRAINING_LOCAL_INGRESS=true` are enabled on the single App Service instance, which was restarted and returned healthy readiness checks.

The backfill preserves question text, options, keys, and display taxonomy. Future external importers that bypass the normal writers still require the same backfill verification before indexed selection is relied on.

An Azure/Atlas load test and an authenticated production training-session exercise have not been run. The supplied harness has no remote-target option and always owns a disposable local database, so its results do not establish Azure or Atlas capacity.

Session persistence now separates physical question content from logical order. All updated repository readers understand both old sessions and the new `questionOrder` field. A backend downgrade must first restore physical arrays to the saved logical order; an older backend does not understand the new field. Frontend rollback remains supported by full action responses.

## Durable learner-state follow-up

Durable learner state currently becomes primary when the bounded recent-history window is fully marked `learningApplied` and durable skill rows exist. Because history is limited to 50 sessions, that moving-window inference can eventually omit older sessions that predate durable accounting. Replace it with an explicit per-user, per-exam migration marker such as `learnerStateVersion: 1` or `durableStateBackfilledThrough`, written by a deterministic backfill before durable state is treated as authoritative.

## Local evidence

The detailed load report is [training-load-results.json](training-load-results.json). Each stage reports p50/p95/p99, errors and response sizes separately for dashboard, creation, answers, visits and completion. It is a short synthetic burst using one session per learner, no think time, local MongoDB, and 20 questions per session. Authentication uses generated test accounts and the normal session issuer; password-login throughput is not measured. These results do not establish sustained capacity, large-history performance, network latency or Azure/Atlas limits.

Validation results and the final load table are recorded below after the final checks.
