# IIT JAM Physics mode

The sidebar and Profile switch use `study-guru:exam-mode` in browser storage. SSC is the default. The preference survives reloads and syncs across tabs; account-wide statistics remain shared. Existing pages and engines are reused.

## Content identifiers

- Exam and question subject: `iit-jam-physics`.
- Sections and mock configs: `contracts/jam.js`.
- Question and resource topics: `iit-jam-<section-slug>`, e.g. `iit-jam-mathematical-methods`.
- Route: `/subjects/iit-jam-physics/mathematical-methods`, with the shared `/quiz` engine.
- `/mock-test`, `/resource`, `/play`, `/battle`, `/ai-chat`, `/dashboard` and `/profile` follow the preference.
- Play uses the JAM single-choice bank with unpenalized practice scoring. Mixed answer types use the mock engine.

## Publishing

In the existing admin Mock Test & PYQ Studio select IIT JAM Physics or a section. Upload a complete fixed paper. Full syllabus is 180 minutes, 60 questions, 100 marks:

| sectionKey | questionType | Count | Correct | Incorrect deduction |
| --- | --- | --- | --- | --- |
| a1 | MCQ | 10 | 1 | 1/3 |
| a2 | MCQ | 20 | 2 | 2/3 |
| b | MSQ | 10 | 2 | 0 |
| c1 | NAT | 10 | 1 | 0 |
| c2 | NAT | 10 | 2 | 0 |

MSQ keys are arrays of option IDs/letters; all correct choices are required, with no partial credit. NAT keys are numbers or `{ "min": 1.2, "max": 1.3 }`. Bounds stay in the private key until completed review. Section practice configs use `iit-jam-physics-<section-slug>`, 20 MCQs, sectionKey `physics`, 30 minutes, +1/0 scoring.

JAM uploads normalize subject and topic identifiers. Only MCQs are copied to the shared single-choice bank; MSQ/NAT remain in their fixed paper. This change does not create real exam papers, books or questions. Empty catalogs reflect unpublished content.

Format source: https://jam2026.iitb.ac.in/Syllabus.html; Physics syllabus: https://jam2026.iitb.ac.in/files/syllabus_PH.pdf.

## Local verification

`JAM_MODE_FIXTURE=1` enables synthetic JAM data in `scripts/browser-fixture.js`, a disposable local MongoDB fixture that does not load environment files or connect to Atlas. `frontend/e2e/iit-jam-mode.spec.ts` checks switching, persistence, layouts and shared routes. Its mixed-paper API test requires this optional fixture. `JAM_UI_ORIGIN` can point cookie setup at an existing local UI server instead of the default port 3110.
