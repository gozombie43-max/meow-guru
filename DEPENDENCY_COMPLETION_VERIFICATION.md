# Dependency completion verification

## TypeScript tooling follow-up - 2026-09-26

The TypeScript compiler remains at the latest stable 7.0.2. Upgraded `typescript-eslint` and its parser, plugin and supporting packages from 8.68.0 to 8.70.1, declared at the monorepo root so they resolve the compatible compiler API. The navigation browser fixture now invokes the TypeScript 7 CLI through `execFile`, with generated JavaScript in Playwright's managed output directory. Removed the frontend's direct `@typescript/typescript6` dependency and `transpileModule` import.

Full removal of the TypeScript 6 tooling API is blocked upstream: current stable `typescript-eslint@8.70.1` declares TypeScript `>=4.8.4 <6.1.0` and explicitly rejects TypeScript 7.0 at runtime. Keep the root compatibility alias for this parser. Microsoft documents the side-by-side arrangement pending the new API; replacing the alias with TypeScript 7 would break linting. No prerelease compiler or forced peer override was introduced. See [Microsoft's TypeScript 7 guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0).

Follow-up logs: `D:/codex-typescript-tooling-20260926/`. Typecheck, full frontend lint, contracts build, production Next build, all eight isolated navigation browser tests and the installed dependency-tree check passed. A fresh `npm ci --workspace frontend --include-workspace-root=false` and its full dependency-tree check also passed, with zero audit vulnerabilities. A lint probe confirmed that explicit `any` and missing image alt text still produce violations. The original migration results below remain the earlier verification snapshot.

## Original migration verification

Verified locally on 2026-09-26 with Node 22.23.2 and npm 10.9.8. This pass continued the existing migration work, added a real Sentry SDK transport regression test, and completed the checks below. No commit or deployment was performed. Logs are retained in `D:/codex-dependency-completion-20260926/`.

## Installed versions

Firebase Admin 14.5.0, express-rate-limit 8.7.0, Sentry Next.js 11.0.0, TypeScript 7.0.2 workspace compilers, ESLint 10.11.0 workspace CLIs, globals 17.12.0, Vitest/coverage-v8 5.0.2, and jsdom 30.1.1. Direct Node types remain 22.20.4.

TypeScript 6 remains deliberately available for tools using its JavaScript compiler API; it does not replace the TypeScript 7 workspace compilers. The ESLint compatibility adapter remains necessary for older plugins, whose peer dependencies also retain ESLint 9. These bridges passed local checks, but do not imply upstream plugin support for the newer compiler API or ESLint runtime.

## Captured results

| Check | Result |
| --- | --- |
| Clean full lockfile installation | Passed in a separate directory: `npm ci --ignore-scripts`, then `npm rebuild` with lifecycle scripts enabled |
| Clean dependency tree | `npm ls --all` passed |
| Frontend-only CI installation | `npm ci --workspace frontend --include-workspace-root=false` and its full dependency-tree check passed |
| CI compiler resolution | Parser resolves TypeScript 6.0.3 with `createProgram`; frontend `tsc` reports 7.0.2 |
| Installation audits | Zero vulnerabilities for both clean installation modes |
| `npm run check` | Passed: typecheck, frontend/backend lint, 356 frontend tests and 457 backend tests |
| Final frontend coverage | 76 files / 357 tests passed, including the added real Sentry SDK test; existing thresholds passed |
| Final backend coverage | 67 files / 457 tests passed; existing thresholds passed |
| Coverage source inventory | All 220 frontend baseline files retained, plus `lib/monitoring-options.ts`; all 78 backend baseline files retained |
| Contracts declaration build | Passed |
| Backend dependency resolution and startup without optional credentials | Passed |
| Production Next build | Passed, 802 generated pages; local fixture API and disabled Sentry upload credentials/DSNs |
| Entry JavaScript budgets | Passed without changing limits |
| Interface/design contract | Passed, light and dark at 320, 390, 768, 1366 and 1440 pixels |
| Full browser suite | 38 passed, including desktop/mobile assessment, training, quiz and optional application navigation flows |
| Local training load | Section, adaptive and mission at concurrency 1 and 5 passed with zero failed learners or request errors |

Frontend aggregate line coverage was 41.40%; backend was 76.77%. The configured per-file thresholds passed. No threshold was relaxed. An earlier overlapping frontend coverage run hit a 5-second word-list test timeout; the fresh full coverage run succeeded. The working tree also contains a test improvement that counts mounted articles without costly visibility calculations, retaining the 40/80/120 DOM-size assertions.

`frontend/lib/monitoring.integration.test.ts` uses the installed Sentry 11 SDK with an in-memory transport. It verifies exception processing, stack frames, event identity, release/environment labels, and flush completion. No event is sent externally. Existing monitoring unit tests separately cover lazy initialization, disabled DSNs, retries, client capture, router transitions, server/edge hooks, and proxy matching.

## Remaining remote release checks

Vercel preview behavior, authenticated source-map upload, source-mapped errors arriving in the remote Sentry project, production sampling/alerts, Linux deployment artifact execution and live push delivery were not verified in this pass. Lighthouse was not rerun. Local browser performance checks and disposable-Mongo load results do not establish production capacity or real-device behavior.
