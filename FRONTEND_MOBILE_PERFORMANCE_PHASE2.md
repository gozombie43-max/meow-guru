# Frontend mobile performance: remaining findings

Implemented locally on 2026-10-05 against `d13ab541`. This completes the implementation of findings **4 and 7–18**, the thirteen items left after [phase one](FRONTEND_MOBILE_PERFORMANCE_PHASE1.md). The [original audit](FRONTEND_MOBILE_PERFORMANCE_AUDIT.md) remains a historical snapshot. Verification results are also recorded in [phase-two evidence](FRONTEND_MOBILE_PERFORMANCE_PHASE2_EVIDENCE.json).

| Finding | Implemented behavior | Main code |
| --- | --- | --- |
| 4 — Duplicate KaTeX | Direct and Markdown rendering resolve to KaTeX 0.16.47 through compatible dependency ranges. Fractions, roots, matrices and untrusted links have regression coverage. | `frontend/package.json`, `package-lock.json`, `MathRenderer.test.tsx` |
| 7 — Auth/history payloads | `/users/me` uses a profile allowlist and recent-quiz summaries. Chat indexes contain counts/revisions instead of messages. Individual chat and resume details load on demand. | `backend/services/userHistory.js`, `userController.js`, `useAiChatHistory.ts`, `useQuizSessionLifecycle.ts` |
| 8 — Whole-chat persistence | Ordered message batches use a sequence and minimal `{saved, revision}` acknowledgement. Matching retries are idempotent; stale/conflicting writes return 409. Backend list mutations use compare-and-swap. Client queues serialize writes, preserve failed batches, retain 80 active messages, and keep history indexes small. Attachment recovery markers clear after acknowledgement. | `userHistory.js`, `userRepository.js`, `useAiChatHistory.ts`, AI-chat `page.tsx` |
| 9 — Resume waterfall | The first question request accepts a saved anchor/index and returns its aligned window. Auth restoration gates this request. Earlier questions are placeholders until navigation fetches their window; subsequent pages retain cursor pagination. Saved filters travel with the checkpoint. | `questionSessionService.js`, `useQuizSession.ts`, `useQuizFilters.ts`, `useQuizSessionLifecycle.ts` |
| 10 — Question payload | Mongo projection and an explicit quiz DTO retain rendering, scoring, image-region, diagram and vocabulary fields while excluding storage/training/internal metadata. `_id` is represented as a session anchor. | `backend/services/questions/quizQuestionDTO.js` |
| 11 — Growing checkpoints | Initial/reset checkpoints remain complete; subsequent saves contain changed answers, removed answers, new submissions and changed results. A 600 ms debounce and one in-flight request coalesce navigation changes. Local serialization is deferred. Hidden/page-exit/unmount paths flush the latest state, including completion. | `resumeDelta.ts`, `useQuizSync.ts`, `coalesced-save.ts`, `userHistory.js` |
| 12 — Mock countdown | A deadline-based leaf component owns the one-second tick and catches background elapsed time. Engine question rendering does not run for clock ticks. The closed mobile palette is not mounted. | `MockCountdown.tsx`, `MockTestEngine.tsx` |
| 13 — Mock autosave | Loaded state seeds the dirty check. Unchanged intervals make no save request; unsent snapshots collapse to the latest state. Revisions/conflict handling and awaited save-before-submit remain active. | `MockTestEngine.tsx`, `coalesced-save.ts` |
| 14 — Question images | Shared responsive Next Image rendering reserves the stored aspect ratio, or a stable contain frame for legacy records. Active question images have eager/high priority; other images remain lazy. Stable resolver URLs use same-origin optimization. New question uploads store actual dimensions; mass solution uploads store dimensions too. Mock/review images use the shared component. | `QuestionImage.tsx`, `RichContent.tsx`, question upload routes/controllers, mock views |
| 15 — PDF metadata | Only the active category loads initially. Pointer/focus intent can prefetch another tab, sharing its in-flight request with a subsequent click. Obsolete responses cannot replace the current tab. | Mathematics `formula-notes-page.tsx` |
| 16 — Reconnect reload | Ordinary offline/online cycles preserve the mounted page and allow cache revalidation. Actual chunk-load failures retain the guarded reload path. | `AppRecovery.tsx` |
| 17 — Attachment polling | Polling backs off from 1.5 seconds to 15 seconds, respects bounded Retry-After hints, pauses while hidden and resumes on visibility. Abort handling and the ten-minute deadline remain. | `frontend/lib/tutor-jobs.ts` |
| 18 — Iconify | Removed the unused global third-party loader. | `frontend/app/layout.tsx` |

## Verified locally

- Full frontend suite: **100 files, 448 tests passed**. Subsequent targeted verification of the final image resolver, mock rendering probe and chat changes: **3 files, 11 tests passed**.
- Full backend suite: **103 files, 600 tests passed**; one file/two optional Redis tests skipped.
- Frontend and backend lint pass with zero warnings. Frontend typecheck, backend build/runtime-boundary checks, contract generation, interface checks and production build pass.
- Production build generates **802 static pages** and passes the configured route JavaScript budgets. These budgets measure entry chunks, rather than all JavaScript eventually requested during an interaction.
- `npm ls katex --workspace frontend` reports one deduplicated KaTeX version. Frontend dependency audit reports zero vulnerabilities.
- **10 production-browser checks pass** across desktop and mobile: light/dark saved-chat restoration/deletion, authenticated mock resume/submission, direct late-quiz resume and incremental chat persistence/reconnect. Tests run against the disposable loopback Mongo/API fixture; tutor replies are simulated and no paid AI calls are made.
- The browser resume probe displays question 241 with **one question-session request**, then loads an earlier window only when question 1 is selected. The former audit fixture needed three serial question requests.
- Two conversational turns produce **four one-message writes** with sequences 1–4 and four minimal acknowledgements. Ordinary reconnect produces **zero document navigation requests** and preserves the visible conversation.
- A 40-second mock timer test records **zero unchanged autosaves and zero additional question-render calls**. A delta test with 240 existing results sends one new result instead of the complete result history. PDF/polling tests cover intent deduplication, obsolete responses, backoff and hidden-tab resume.

## Limits and rollout details

These are local implementation and disposable-fixture results. No push or deployment was performed as part of this phase. Real-device battery/heap behavior, production image bytes/CLS/LCP, long-session soak results and production API latency were not measured here. The original audit and phase-one timings are not new phase-two measurements.

Existing image documents have not been remotely backfilled; they use the reserved legacy frame until genuine dimensions are present. Unknown external image hosts preserve direct delivery for compatibility; the configured Azure host and stable same-origin resolver can use optimized variants. No question/solution content is cropped.

Resume-window indexes are bounded to 10,000. Anchors are checked against the selected filters; locating a valid anchor uses a count query, while ordinary cursor reads keep totals opt-in. Earlier windows load on navigation. Cursor pages already visited remain in SWR; this does not claim an indefinitely constant-memory question session. Existing index-based saved answers retain their established behavior if the question bank changes underneath a session.

The backend retains its established 80-message/30-chat limits. Earlier messages within the retained conversation remain available through the existing rendered message window; this change does not introduce an archive beyond that retention limit. Cross-tab sequence conflicts reject stale turns rather than silently replacing them.

Frontend and backend API changes need coordinated rollout: the new client requires chat-detail/append and quiz-detail/window endpoints. The legacy chat PUT endpoint remains available, but chat indexes now return summaries and write responses are minimal acknowledgements.
