# Request-flow remediation — Batch B

Implemented locally on 2026-10-08, on top of the uncommitted Batch A changes and checkout `8a65e94d`. Scope follows the supplied Batch B: scoped AI-chat persistence, one idempotent quiz-answer command, completed concept-group caching, and mock catalog projection. [The original audit](REQUEST_FLOW_AUDIT.md) retains the pre-change baseline; [Batch A](REQUEST_FLOW_BATCH_A.md) records its separate startup changes.

## Updated flows

### Quiz answers: F2

```text
Before:
Submit -> local grading
       -> PATCH users/me/progress
       -> POST questions/:id/answer
       -> 600 ms PATCH users/me/recent-quizzes

After:
Submit -> immediate local grading
       -> shared answer/checkpoint queue
       -> browser -> Next /backend-api rewrite -> Express POST /api/questions/answer
            Idempotency-Key = stable submissionId; payload stays fixed on retries
            -> existing JWT/session validation and rate limiting
            -> Mongo completed-response lookup
               HIT: replay response; no question/progress/history mutation
               MISS: one Mongo transaction, sequential operations
                 reserve submission key
                 -> resolve/project source question by session anchor or canonical UID
                 -> read history storage format
                 -> question progress + conditional topic progress/durable revision
                 -> scoped resume entry (or bounded embedded history)
                 -> concept counters + owner/history revision fence
                 -> store completed response -> COMMIT
            -> advisory Redis progress invalidation, when progress changes
       -> matching 600 ms resume checkpoint: no HTTP request

Select / Next / Finish / leave:
       -> existing coalesced checkpoint saver, ordered after pending answers
       -> PATCH users/me/recent-quizzes only for changed state
```

The frontend's two immediate answer writes become one atomic command that also saves its resume state. Local grading remains immediate. The command derives correctness and concept counters from the source question; the browser and server share correct-answer precedence. It supports numeric, letter, text, and image-option answers. Literal Mongo field operations preserve concept labels containing dots or dollar signs without turning them into nested paths.

The submission reservation, business effects, and response commit together. Lost responses replay the same result; concurrent duplicate submissions count once; changed input with the same key returns 409. Keys are scoped to the authenticated owner, retained using the existing 24-hour idempotency TTL index, and require a matching header/body ID. Separate submissions can legitimately count another attempt; solved/mastered totals retain their existing first-attempt/first-correct semantics. Mongo transaction retries and bounded unique-key recovery preserve these rules under contention.

Session anchors support older bank rows without stored canonical UIDs, including reused legacy IDs. Unanchored ambiguous IDs still return 409. The existing migrations are reused; no live backfill or index deployment was performed.

One saver coordinates answer commands and checkpoints for each quiz and auth-session identity. Equivalent snapshots skip the delayed PATCH; later checkpoints send changed answers/results only. It orders writes, skips superseded checkpoints, preserves the exact pending command after uncertain responses, and aborts pending transport on logout/session changes. Same-session token refresh retains the saver. Large restored histories use bounded request deltas to preserve older server data and allow the next answer to commit.

Navigation/selection/completion checkpoints remain intentional requests. Legacy endpoints remain compatible with older clients; their optional, separate idempotency middleware is not the new command's atomic protocol. Failed commands remain retryable in the current saver, and existing local resume storage remains in place; this change does not introduce a durable offline command outbox across reloads. Idempotency guarantees are bounded by record retention.

Sources: [command contract](contracts/progress.js), [answer route](backend/routes/questionRoutes.js), [transaction service](backend/services/quizAnswerService.js), [progress transaction helper](backend/repositories/questionProgressRepository.js), [resume persistence](backend/repositories/userHistoryRepository.js), [shared answer normalization](contracts/questions.js), [answer lifecycle](frontend/features/quiz/hooks/useQuizAnswerLifecycle.ts), [save queue/deltas](frontend/features/quiz/model/resumeDelta.ts).

### AI-chat histories: F7

```text
List -> browser -> Next rewrite -> Express GET users/me/ai-chats -> existing auth
     -> Mongo owner/storage projection
        migrated: <=30 aiConversations metadata rows; ZERO aiMessages reads
        legacy: Mongo computes summaries; message bodies do not reach Node

Detail -> GET users/me/ai-chats/id -> existing auth -> owner/storage projection
       migrated -> snapshot transaction: owner check -> ONE conversation
                  -> <=80 messages for THAT owner/conversation
       legacy   -> Mongo projects only the selected conversation

Append -> POST users/me/ai-chats/id/messages -> existing auth -> storage check
       migrated -> transaction:
          owner check -> ONE conversation's revision/count
          -> normal append: insert ONLY new messages at absolute sequence positions
          -> trim messages outside retained 80 -> update metadata
          -> prune excluded chat IDs beyond 30 -> owner revision fence -> COMMIT
          retry: read ONLY its retained sequence range; compare before acknowledging
       legacy -> existing bounded embedded-history CAS

Delete -> owner check -> delete THAT conversation/messages -> owner fence
PUT    -> replace THAT conversation intentionally; other message bodies are unread
```

The migrated list no longer hydrates up to 2,400 messages and discards them. Detail reads no longer hydrate unrelated conversations. Normal appends do not read old message bodies or delete/reinsert the retained window. They retain unchanged Mongo message identities. Matching retries acknowledge the current revision, mismatched/stale/evicted batches return 409, and transaction snapshots keep detail metadata/messages consistent.

Older separated rows numbered each retained window from zero. Their first append upgrades positions in place, using a temporary negative range to avoid collisions with the existing unique position index. Subsequent appends use absolute positions. Generic replacement/migration writes mark their position convention explicitly. Retention remains 30 chats and 80 messages each; metadata pruning uses existing owner/update-order indexes. Owner revision writes preserve concurrency/account-deletion fencing, and legacy CAS now also fences a storage-format transition.

Embedded histories still require bounded array mutation for writes. No automatic migration is enabled. Format checks and transaction owner checks remain correctness work; the main benefit is avoiding unrelated message hydration and repeated message replacement.

Sources: [scoped repository](backend/repositories/aiChatRepository.js), [controllers](backend/controllers/userController.js), [summary representation](backend/services/userHistory.js), [legacy CAS](backend/repositories/userRepository.js), [position convention](backend/repositories/userHistoryRepository.js), [existing indexes](backend/migrations/017-user-history.js).

### Concept-group metadata: F3

```text
Quiz metadata -> browser -> Next rewrite -> Express GET questions/meta
             -> existing public metadata tiered cache
             -> completed grouping cache, keyed by version/scope/concepts fingerprint
                HIT: ZERO grouping Mongo reads/upserts
                MISS: one Mongo grouping read
                  completed -> cache result for <=5 minutes
                  pending/failed -> report current status; no redundant upsert
                  missing -> upsert queued job once -> read its stored state

Pending polling -> same metadata endpoint -> one fresh grouping status read
```

Completed grouping data is immutable for its fingerprint. Its local cache is isolated per Mongo database, bounded to 200 entries/10 MiB with a 1 MiB entry limit, and registered with shared local-cache clearing. Concurrent same-fingerprint reads share one in-flight promise; pending reads have a capacity bound. Completed requests no longer upsert existing records or re-read them on each warm metadata hit. Polling and queued-job semantics remain unchanged; changed concepts/scope/version produce a different fingerprint.

Source: [grouping repository](backend/repositories/conceptGroupRepository.js).

### Mock catalog: F16

```text
Exam catalog -> browser -> Next rewrite -> Express GET mocktest/E/slots
             -> Mongo match exam + sort order
             -> compute fixed-paper count / hasFixedPaper inside Mongo
             -> project OUT fixedQuestions and internal fields
             -> compact rows reach Express -> catalog JSON

Empty catalog -> existing default-slot seeding -> same compact catalog query
```

Fixed-paper arrays no longer cross the Mongo driver into Express merely to be discarded. Counts/flags remain correct for fixed, empty, and dynamic papers. Mongo still reads its source documents and computes array lengths; this is not a covered-index claim or measured disk-I/O reduction. Empty-catalog seeding and full-paper detail/start reads retain their existing behavior.

Sources: [catalog query](backend/services/mock/mockSlotService.js), [summary compatibility](backend/services/mock/mockModel.js).

## Expected impact

Qualitative estimates; local tests prove behavior/query scope, not production latency or throughput.

| Flow | Avoidable user-visible latency | Avoidable server load addressed |
|---|---|---|
| Quiz answers | Low foreground; grading already local | High recurring load: one command replaces answer fanout and an equivalent history checkpoint |
| Large AI-chat history | Medium/high when opening/selecting chat | High: no list message hydration, scoped detail reads, incremental append writes |
| Warm quiz metadata | Low/medium | High across repeated metadata reads: grouping Mongo work falls from upsert+read to zero |
| Mock catalogs | Medium for large fixed papers | Medium/high payload and Node memory reduction; query count remains one on a populated catalog |

The original F1 authorization guards still apply to protected requests. Redis remains optional cache/coordination, with Mongo authoritative for progress and command outcomes. Batch C/D cold-path, retry-budget, public-auth-gate, and translation changes remain separate work.

## Validation

- Frontend full suite: **103 files / 482 tests passed**, followed by final focused quiz checks: **4 files / 16 tests passed**, including the added long-history case.
- Backend full suite: **117 files / 709 tests passed; 4 files / 16 tests skipped**, followed by final focused checks: **3 files / 59 tests passed**, including the additional generic-list compatibility check.
- Frontend typecheck/full lint, contracts declaration build/typecheck, and backend build/typecheck/runtime-boundary checks/full lint passed.
- Final production frontend build passed. Browser rerun: **6 desktop/mobile tests passed** (`npx playwright test e2e/remaining-performance.spec.ts`, Microsoft Edge).
- The new backend integration file passed **20 tests** against a disposable Mongo replica set with the real existing history/progress indexes. It checks query scope, retained-row identities, sequence/window migration, concurrency, account deletion, history-format transition, generic-list compatibility, owner isolation, canonical identities, lost-response replay, atomic rollback, completed-group reuse, and actual Mongo catalog projection.
- `git diff --check` passed. No live database changes, commits, pushes, or deployments were performed.

Browser verification uses the production Next build and local Express/Mongo fixtures. It deliberately commits an answer and discards its first HTTP response, then checks stable payload/key replay, exactly one counted attempt, persisted resume grading, and zero equivalent delayed history PATCHes. It also covers deep question resume and migrated chat appends/reconnects. Fixture traffic is routed to loopback; this does not establish production request counts, Atlas execution plans, or measured latency improvements.
