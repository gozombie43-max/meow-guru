# Bilingual Mock / PYQ papers

Upload a complete paper JSON in **Admin → Mock Tests → Paper Payload**. The
`@meow/contracts/exam-paper` contract validates the same payload on the frontend
and backend. The paper supplies the exam, tier, type, marks, ordered sections,
English/Bengali content and optional section durations. It does not require
topic-practice metadata or precomputed totals.

The authenticated admin endpoint `POST /api/mocktest/admin/upload-paper?examMode=ssc`
accepts `{ "slot": { "id": "paper-id", "title": "Paper title" }, "paper": ... }`.
Slot display/access settings such as `isFree`, `order` and `assessmentMode` remain
optional. A raw paper payload is also accepted; its slot ID/title are generated.
The exam, tier and test type always come from the validated paper.

Native papers are stored in the mock catalog and never inserted into the topic
practice bank. Existing flat question arrays and legacy exam configurations
continue through their original paths.

Section durations are minutes. A paper with section timing runs sequentially:
Save & Next at the end of a section finishes and locks it; expiry saves current
progress and starts the next section. Timers use server timestamps and continue
across refreshes or background time. A final expiry save has a two-second network
margin; subsequent writes cannot edit locked sections. The final section's
expiry submits the attempt. A section without a duration is untimed; a paper
without durations has no invented global deadline.

Answers persist as A/B/C/D. Language changes display supplied text directly and
preserve navigation, answers and review states. Server autosave and a revision
checked browser draft support resume. Solutions and answer keys are withheld
from active responses and catalog metadata. They become available in completed
practice review; confidential assessments retain their no-review policy.

`skillTest` metadata is retained separately from MCQs. This change does not add a
typing or DEST player.
