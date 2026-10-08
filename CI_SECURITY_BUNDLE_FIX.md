# CI security and quiz bundle fixes

Validated locally on 2026-10-08, based on checkout `3ff7a80b`, with Node 22.23.2 and npm 10.9.8 on Windows. The supplied CI failures were reproduced before the changes. Remote CI, Lighthouse, and production latency were not rerun.

## Dependency fixes

- Next, its ESLint plugin/config, and its platform packages now resolve to **16.3.8**. The existing safe Next lint directory-matcher override was moved to that plugin version and its compatibility checks passed. [Next release](https://github.com/vercel/next.js/releases/tag/v16.3.8), [security advisory](https://github.com/advisories/GHSA-3w37-wq28-93x7).
- Direct and transitive KaTeX consumers now resolve to **0.18.2**, the first patched release for the reported advisory. The root override covers `react-katex`, `rehype-katex`, and `micromark-extension-math`; upgrading to 0.19.0 was unnecessary. New tests exercise the actual React and Markdown wrappers and reject inherited `trust: true`. Existing math renderer tests also passed. [KaTeX advisory](https://github.com/advisories/GHSA-238p-pmpm-9mq7).
- A broader root audit also found the existing `concurrently` dependency on vulnerable `shell-quote@1.9.0`. A scoped override selects **1.11.0**. Ordinary quoting and concurrent command execution passed a local smoke check, and the advisory payload throws. [shell-quote advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv).

The root lockfile was repaired and stale workspace copies removed. No forced dependency downgrades or audit exclusions were used. Root, frontend, and backend audits each report **zero vulnerabilities**.

A final isolated install of the finished manifests and lockfile passed with `npm ci --no-audit --no-fund`, including lifecycle scripts. Its `npm ls --all` check passed and all three audits again reported zero vulnerabilities. Application checks below ran in the workspace after its own clean install; the isolated copy was used to verify dependency installation and resolution.

## Quiz bundle cause and fix

The browser imported `quizCorrectIndex` from `@meow/contracts/questions`, which also constructs Zod request schemas at module scope. That import brought schema validation into every quiz entry bundle.

The grading helper now has a dependency-free `@meow/contracts/quiz-grading` entry. The frontend uses that entry; the existing questions contract re-exports the helper for backend compatibility. Its implementation is identical to the previous version.

Contract declarations now emit into the ignored `contracts/build` directory before copying to their published locations. This prevents repeated builds from treating an existing sibling declaration as both input and output (`TS5055`). Two consecutive builds and contract typecheck passed.

The existing performance checker and budget file are unchanged. All **83 route entries** pass. The seven previously failing entries are below the existing **180,000-byte** gzip limit:

| Route | Supplied CI baseline, Linux | Patched local build, Windows |
|---|---:|---:|
| `/(app)/general-awareness/[topic]/[chapter]/quiz/page` | 211,960 | 120,662 |
| `/(app)/general-awareness/[topic]/quiz/page` | 211,960 | 120,662 |
| `/(app)/mathematics/[topic]/quiz/page` | 211,864 | 120,566 |
| `/(app)/mathematics/advance/[topic]/quiz/page` | 211,864 | 120,566 |
| `/(app)/mathematics/arithmetic/[topic]/quiz/page` | 211,864 | 120,566 |
| `/(app)/english/[topic]/quiz/page` | 211,669 | 120,369 |
| `/(app)/reasoning/[topic]/quiz/page` | 211,524 | 120,222 |

These are entry JavaScript sizes, not measured user-visible latency. Exact gzip sizes can vary across builds and platforms. The generated report is `frontend/.next/diagnostics/performance-budget.json`.

## Completed local application checks

```text
npm ls --all                                      valid installed tree
npm audit --workspace frontend --audit-level=high  zero vulnerabilities
npm audit --workspace backend --audit-level=high   zero vulnerabilities
npm audit --audit-level=high                       zero vulnerabilities
npm run check:lint-tooling --workspace frontend    7 tests passed
npm run typecheck --workspace @meow/contracts      passed
npm run build                                     contracts + backend + Next production build passed
frontend: npm run check                           typecheck + 107 files / 505 tests + lint passed
frontend: npm run check:performance               83 route entries passed
frontend: npm run check:interface                 passed
backend: npm test -- routes/__tests__/requestFlowBatchB.integration.test.js
                    services/__tests__/questionService.test.js
                                                   2 files / 54 tests passed
frontend: npm run test:e2e -- e2e/quiz-navigation.spec.ts
                             e2e/remaining-performance.spec.ts
                             e2e/assessment.spec.ts
                                                   26 tests passed
```

The focused browser run used the production frontend, Edge, mocked navigation responses, and an authenticated disposable local Mongo fixture for request-flow and assessment tests. It covered desktop/mobile quiz navigation, lazy math solution rendering, answer retries, resume, translation timing, mock assessment reload/submit, and existing progress/auth behavior. It did not call live AI providers or production services. Full coverage, the full browser suite, and remote CI were not rerun.
