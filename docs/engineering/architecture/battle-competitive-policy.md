# Competitive battle policy v2

Only rooms created by the matchmaking transaction may be ranked. Private rooms,
friend challenges and rematches are casual. `BATTLE_RANKED_ENABLED=false`
disables Elo, competitive profile counters, season placement, ranked missions
and achievements, including settlement of rooms created before the switch.
Room policy is persisted at creation; it is never accepted from client input.
Legacy rooms without policy fields settle as casual. Existing historical Elo is
not rewritten by this release.

An accepted answer acknowledges only commitment. Opponent notifications contain
only a user ID, question index and answered flag. Current-round points and
correctness stay hidden in every public score projection, including reconnects,
until both players commit or the deadline resolves their unanswered choices.
One durable reveal carries selections, the answer key, scores and its expiry.
The deadline worker advances persisted reveals after a process restart.

MongoDB user leases share transactions with room/ticket creation and pairing.
The user ID is the lease's primary key. Cancellation and settlement release the
matching resource's leases, and expired/finished resources cannot strand users.
Existing live rooms/tickets are also checked during rolling upgrades. Before
rollout, drain legacy battles with the new-match switch disabled and reconcile
any users who already had multiple live rooms; this release does not arbitrarily
forfeit old games. New invitation codes use six cryptographically generated
characters. Four-digit codes remain accepted for existing rooms only. Social
and rematch rooms bind the intended opponent. Account-wide MongoDB counters
limit room creation and join attempts across sockets and application instances.

## Ranked question sets

`rankedEligible=true` is an explicit administrator certification, separate from
technical `battleEligible`. Certification also requires a canonical question ID,
question text or a diagram, four distinct choices for MCQ/MSQ (text or explicit
images), a valid key, an easy/medium/hard
difficulty, and a concept. Draft/rejected questions are excluded. Existing questions
are not automatically certified. Question writes recompute selection metadata.
The builder filters language and media capability, uses indexed bounded hash
scans (at most 300 metadata candidates per difficulty), and seed-orders candidates
using an HMAC of room, season and selection version. The secret uses
`BATTLE_SELECTION_SECRET` or the validated `JWT_SECRET` and must have at least
32 characters. Seeds remain private; public snapshots contain neither seed nor
future question IDs.

Ten-question sets contain 3 easy, 4 medium and 3 hard questions. Other supported
counts use the same proportions. Each concept is capped at 40% (rounded up),
and exam/year groups are spread when available. The last 100 ranked questions
reserved for each player are excluded together; if needed, history exclusion
relaxes to 50, 20 and then zero while difficulty and concept limits remain.
Only a complete certified set may start a ranked match. Insufficient pools close
the waiting room, release leases, and explain the failure. The selected IDs,
seed, blueprint, history window and version are persisted with the room;
settled matches retain selected IDs and version for review. This is reproducible
sampling from bounded candidate pools, not uniform sampling of the entire bank.
Difficulty is curator supplied; empirical item calibration requires collected
item statistics and is not fabricated by this implementation.

## Rollout commands

Run from `backend`, with the intended database configuration:

1. `npm run db:migrate` applies migrations 019 and 020 (leases, limits, history,
   indexes and the durable matchmaking coordinator).
2. `node scripts/backfill-battle-metadata.js` previews derived metadata changes.
3. `node scripts/backfill-battle-metadata.js --apply` applies the guarded backfill.
4. Curate/certify enough questions through the existing admin question write API;
   certification must include difficulty, concept and language. Backfill preserves
   explicit certification, and never promotes unreviewed questions.
5. Exercise SSC and IIT JAM matchmaking, cancellation, reconnect and settlement
   in staging before enabling ranked matchmaking for users.

The local regression suite uses an isolated MongoDB replica set and real socket
clients. Passing it does not apply production migrations, certify production
questions or prove deployment/load behavior.

## Answer contract and media

`game:answer` includes `code`, `questionIndex`, and exactly one answer variant:

```json
{ "type": "mcq", "selectedIndex": 0 }
{ "type": "msq", "selectedIndices": [0, 2] }
{ "type": "nat", "numericAnswer": -2.5 }
```

Legacy MCQ packets may omit `type`. MSQ rejects duplicates, empty selections and
out-of-range indices. NAT accepts finite JSON numbers, including zero and negative
values. Question storage retains `questionType: MCQ | MSQ | NAT`. `correctAnswer`
is an index/letter/text for MCQ, an array of keys for MSQ, and a number or inclusive
`{min,max}` range for NAT. A scalar NAT key may specify nonnegative
`numericTolerance` (legacy `tolerance` is also read). Malformed keys fail closed.

Correct answers score 10. MSQ uses exact matching by default, including JAM items.
Only an explicit administrator-supplied `partialCredit: true` enables subset
credit: floor(10 × selected correct choices / all correct choices). Any wrong
choice scores zero. The public question declares this scoring rule, without its
key. Answers, partial points and grading results are committed atomically and
hidden from opponents until the round closes. Reveals, reconnects, reviews and
settled answer logs retain each answer kind.

Public questions carry normalized `type`, `questionImage` and `optionImages`.
Legacy `optionAImage` through `optionDImage` and image objects on options are
projected into that array. Ranked clients support images; certification remains
explicit. Run the guarded metadata backfill again when enabling these formats.
Existing admin bulk/write paths preserve the new fields; the single-question
MCQ upload form remains a separate editor.

## Clocks and outcomes

Private/friend/rematch rooms are casual and unrated. Casual rounds default to
24 hours (`BATTLE_QUESTION_TIME_MS`); active-room retention extends beyond the
deadline. Ranked MCQ defaults to 20 seconds; MSQ/NAT default to 30 seconds.
`BATTLE_RANKED_MCQ_TIME_MS`, `BATTLE_RANKED_MSQ_TIME_MS`, and
`BATTLE_RANKED_NAT_TIME_MS` override these, with the legacy
`BATTLE_RANKED_QUESTION_TIME_MS` as a shared override, clamped to 5–120 seconds.
The initial question is delivered immediately after start. Deadlines and reveal
windows are server controlled and survive process restarts.

Scores decide the result first. Only a ranked score tie uses total server-recorded
response time; lower wins. Timeouts use the question's full duration, regardless
of worker delay. An exact score/time tie remains a draw. Incomplete legacy timing
logs cannot win a time tie-break. Casual score ties stay draws. Settlement, Elo,
notifications, reconnects and final UI share the same winner and outcome reason.

## Socket authorization and degraded coordination

Socket connection authentication verifies the JWT and authoritative Mongo session
and account state. Each connected socket retains a principal for at most 10
seconds, coalesces revalidation, checks token expiry on packets, and periodically
revalidates idle connections. Local logout/account changes and the existing
Redis eviction subscriber immediately invalidate/disconnect matching sockets.
In-flight validation is fenced against invalidation. Subscriber failure clears
socket validation windows; lost events are bounded by periodic Mongo checks.
Authority failures disconnect the socket. REST authorization remains unchanged.

Every matchmaking pass claims the same owner-fenced Mongo lease, even when Redis
works. Redis is an optional fast contention filter. Mongo failure cannot grant a
pass. Workers renew before each ticket and stop if ownership expires. Without
Redis they scan four tickets rather than 25 and wait at least five seconds plus
jitter between attempts. Dependency failures also back off. Monitor
`meow_battle_matchmaking_degraded` and
`meow_battle_matchmaking_lock_attempts_total{outcome=~"degraded|error|busy"}`.

`npm run check:battle:readiness` inspects index specifications (including unique
and TTL options) and backlog older than 60 seconds using reads only. It exits
nonzero for missing indexes or stale/unsettled work. `npm run test:battle:load`
executes isolated 20/100-player, two-instance socket burst tests covering all
answer types and duplicate settlement. These are local regression gates; Atlas
backup/restore, actual Azure SIGTERM/deployment recovery, staged rollout and
sustained remote load still need deployment-specific evidence.
