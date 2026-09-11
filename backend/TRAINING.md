# Training replacement

`/play` now owns the eight training modes and the Train Me / Play / Mock / Review / Analytics hierarchy. The old adaptive frontend redirects to `/play`; the old `/api/adaptive-quiz` endpoint returns 410 and its implementation has been removed. Existing mock, battle, ordinary quiz and authentication contracts remain separate.

## Runtime setup

Run `npm run db:migrate` from `backend` before releasing this version. Migration `005-training` adds unique session/daily-mission IDs, history indexes, variant-review indexes and exam retrieval indexes. Startup migration checks require it. No migration or remote database write was run during implementation.

Use the existing MongoDB Atlas connection and authenticated Axios client. Session actions use server time, account ownership and optimistic revisions. Conflicting writes return 409; clients reload the saved session. Expired sessions finalize on their next read/action. Completed sessions are immutable except for learner taxonomy and optional diagnostic suggestions. No active-session answer keys or explanations are sent to the browser.

## Question contract

Training uses questions from `questions`, not random samples or generated answer keys. Supply:

- A safe unique string `id`, `question` (or `questionText`), 2–6 text/object options, and a resolvable `correctAnswer` (index, option ID, letter or exact text).
- `exam`, `examName`, or `exams`, using `ssc-cgl`, `ssc-chsl` or `cat` (case and spaces are accepted).
- `subject`, `topic` (legacy `questionTopic` is accepted), optional `subtopic`, `concepts`, `difficulty` (1–5 or easy/medium/hard/extreme/nightmare), `expectedTime` in seconds, `sourceType`, `year`, `shift`, `discrimination`.
- Generated questions must have `sourceType: ai-generated` and `validationStatus: validated`. A structurally valid answer key is not proof of mathematical correctness; bank content still requires editorial validation.

Missing expected time uses a disclosed 60-second baseline. Targets become personalized after five topic attempts. Candidate retrieval is bounded to 2,000 matching documents, then deterministically ranked by weakness, difficulty fit, recency, due review, PYQ preference and topic distribution. The previous three sessions are excluded from new practice; due-review retrieval is separate. Missing exam metadata produces an actionable empty state, not unrelated filler questions. Nightmare requires hard-or-higher content.

## Session behavior

- Adaptive adjusts the next difficulty using the latest answer/confidence. Challenge probes harder questions with an easier check every fifth question. Both use validated bank content, including reviewed generated variants when available.
- Sprint has 5/10/15-minute clocks, forward-only progression and pace metrics. Training points include difficulty, speed and streak; skipped questions reduce Sprint points, separate from academic marks.
- Pressure allows save/clear/revisit and grants 70% of target solving time. Results flag expensive wrong answers, untouched easy questions, revisits and final-clock accuracy.
- Section and Gauntlet require a subject mapped to the existing exam/tier config. Configured positive/negative marks apply. Full-section requests fail if the bank cannot satisfy the exact count. Section permits revisits; Gauntlet groups topic blocks with increasing difficulty inside each block and can insert up to three easier recovery blocks from its validated reserve. Recovery uses the existing session clock.
- Nightmare uses hard questions, 85% of target time and no in-test explanations. Survival starts with three lives; wrong/skip costs one life and two consecutive slow solves cost another. Keys remain hidden until completion. Personal best currently means correct answers per run.
- Other practice uses +1 / −0.25 / 0. These clocks are practice clocks, not representations of a complete official paper.
- Daily Mission is one persistent session per user/exam/calendar day in Asia/Kolkata, with available weak-area, pace, due-review, English-PYQ and mixed blocks. Concurrent starts resume the same mission. Missing blocks are omitted rather than invented.

## Learning and review

The latest 200 completed sessions are the current learning window. `userSkillProfile` is a rebuildable snapshot materialized when the dashboard loads; session documents remain authoritative. Review intervals are 1/3/7/21/60 days, reset by wrong, uncertain or slow performance. Correct guesses receive reduced mastery credit. Taxonomy is learner-editable. The current review reconstruction shares the 200-session window; an all-time incremental review ledger is not implemented.

Readiness appears after 30 recorded answers. Weights: accuracy 20%, confidence-adjusted mastery 20%, speed 15%, catalog-topic coverage 10%, difficulty 10%, recent mock performance 10%, consistency 10%, negative marking 5%. Missing mock evidence contributes zero. This is explicitly a provisional practice estimate, not a calibrated exam pass probability or percentile. Coverage uses the available catalog, not a certified complete syllabus. Topic, subtopic and concept profiles are recorded when metadata exists; official tier-specific calibration remains future work.

## AI boundary

`POST /api/training/sessions/:id/diagnosis` optionally suggests up to five mistake categories using the existing AI provider. Structured validation restricts question IDs and categories. Suggestions never change scoring; students explicitly adopt/correct them. Provider errors preserve saved results.

Admin-only curation endpoints:

1. `POST /api/training-curation/variants` with `{seedId, exam}` retrieves a validated seed and generates a structured draft into `trainingQuestionVariants`.
2. `GET /api/training-curation/variants` lists pending drafts.
3. `POST /api/training-curation/variants/:id/review` accepts `{decision: "approve" | "reject", verifiedAnswer, verificationNotes}`. Approval requires an independently verified option index and substantive review notes. A Mongo transaction publishes the reviewed question and marks the draft validated together. Rejection never publishes it.

The curation API requires the existing AI credentials and Mongo replica-set transactions. No live AI calls were made during implementation. There is no curation UI yet. Challenge/Nightmare do not generate unreviewed questions during a student session; their briefing makes that distinction explicit.

## PYQ boundary and remaining advanced features

The Mock area lists complete published fixed PYQ papers, with year/shift filtering and previous-attempt scores, and opens the existing mock instructions/engine. That engine's existing timing policy still applies. Exact official sectional-timing fidelity across every CGL/CHSL/CAT paper version has not been implemented or certified here. The linked CGL reference in the brief is the **2024** scheme, not a verified 2026 policy: https://ssc.gov.in/api/attachment/uploads/masterData/Syllabus/CGL-syllabus-169635-.pdf.

Automatic prerequisite-remediation blocks, live generated variants, all-time skill/review aggregates, personal-history percentiles and calibrated readiness-gain predictions are not implemented. The UI does not report these as measured capabilities. They require additional policy/data/model work beyond the functional shared-engine replacement.

## Local verification

Training engine, ownership/revision/timeout integration, mission deduplication, sectional marking, diagnosis validation and quarantined-variant tests use local fixtures or ephemeral MongoDB. Browser QA exercises eight modes, setup, answering, reload/resume and finish at 390px/1440px in both themes with intercepted API fixtures. Browser evidence is not a live Atlas/AI/deployment test. Preview artifacts are in the ignored `test-results/training` folder.
