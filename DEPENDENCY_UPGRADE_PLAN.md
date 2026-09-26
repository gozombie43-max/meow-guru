# Dependency migration and verification

Migration date: 2026-09-26. Local changes only; no commit or deployment. Existing application work was preserved in a separate source snapshot before installation.

## Resolved versions

| Package | Final version | Scope |
| --- | --- | --- |
| firebase-admin | 14.5.0 | Backend |
| express-rate-limit | 8.7.0 | Backend; manifest and resolution aligned |
| @sentry/nextjs | 11.0.0 | Frontend |
| typescript | 7.0.2 | Frontend and contracts compiler |
| eslint | 10.11.0 | Both workspace lint commands |
| globals | 17.12.0 | Backend |
| vitest / @vitest/coverage-v8 | 5.0.2 / 5.0.2 | Both test workspaces |
| jsdom | 30.1.1 | Frontend test environment |
| @types/node | 22.20.4 | Frontend direct dependency; Node 22 retained |

Firebase Admin 14.5.0 and jsdom 30.1.1 were the current stable versions verified during this migration. The root Node requirement is now `>=22.22.2 <23`, matching jsdom 30's Node 22 minimum. Local verification uses Node 22.23.2. CI already requests the current Node 22 release.

## Compatibility migrations

### TypeScript and ESLint

The frontend typecheck, Next build, and contracts declaration build use TypeScript 7.0.2. Tools that call the old JavaScript compiler API use Microsoft's supported side-by-side `@typescript/typescript6` package: the root `typescript` alias supplies the API to typescript-eslint, and the navigation browser fixture imports the API package explicitly for `transpileModule`. The adapter package version is 6.0.2 and its underlying API reports 6.0.3. It does not replace the workspace TypeScript 7 compilers.

Both workspace ESLint CLIs are 10.11.0. `@eslint/compat` wraps the existing Next, React, import, and accessibility configurations for context APIs removed in ESLint 10. Existing rules remain enabled. A direct rule probe confirmed that missing image alt text, missing React keys, and explicit TypeScript `any` still produce violations. npm retains ESLint 9 transitively for older plugin peer declarations. No `--force` or `--legacy-peer-deps` installation was used.

The emitted contracts declarations were regenerated with TypeScript 7; changes are declaration formatting and ordering, with the existing exported contracts retained.

### Vitest and jsdom

- Register jest-dom matchers explicitly against the frontend's Vitest instance, avoiding the automatic adapter's assumption that Vitest is hoisted beside it. Augment Vitest 5's matcher interface.
- Initialize the Azure client mock in test setup because Vitest 5 clears mock call history before each test.
- Explicitly retain nine shared application modules in frontend coverage. Vitest 5 strictly applies `coverage.include` to imported modules, which initially removed these files from the report. No coverage thresholds were reduced.
- Make the battle-worker test clock deterministic and assert score/reveal emissions, removing millisecond-dependent coverage.
- Count all mounted word-list articles for the DOM-size regression, including hidden articles, avoiding unnecessary jsdom visibility computations while preserving the 40/80/120 render limits.

### Firebase and rate limiting

Repair the stale Firebase resolution and update its Google Cloud dependencies through npm. The application uses Admin app/messaging APIs and does not call the changed topic-subscription methods. Generated local credentials verified SDK initialization without contacting Firebase.

Add real Express/express-rate-limit HTTP coverage for production limits, 429 responses, retry headers, trusted proxy addresses, IPv4 normalization, and IPv6 subnet grouping. Existing Mongo store tests continue to cover persistence. No real push notification was sent.

### Sentry 11

Share an explicit data-collection policy across browser, Node, and edge initialization: retain restrictions on user information, cookies, request bodies, sensitive header/query names, AI inputs/outputs, database data, queues, and GraphQL contents. Replay masking and sampling remain unchanged.

Exclude `/monitoring` and its subtree from the access proxy; `/monitoring-other` remains protected. Tests cover the actual Next matcher, concurrent/lazy initialization, disabled DSNs, retry after initialization failure, client capture, router transitions, and server/edge request instrumentation. The real Sentry 11 SDK captured and flushed an error using an in-memory transport, with no external event delivery.

### Browser baseline repairs

The original browser fixture refreshed every user into the `browser-lighthouse` identity. It now uses the real auth refresh route, preserving each fixture session. Performance tests use the correct fixture owner and isolate mock-test attempts. The training loading assertion targets its heading, avoiding a collision with Next's accessibility announcer. The full 38-test browser baseline passed after these repairs, before the dependency migration.

## Verification

All local acceptance gates passed. Final coverage, typecheck, lint, build, bundle and interface checks were run in the clean installation, isolated from other processes using the shared workspace.

| Gate | Result |
| --- | --- |
| Frontend coverage | 76 files, 357 tests passed; 41.40% line coverage |
| Backend coverage | 67 files, 457 tests passed; 76.77% line coverage |
| Coverage inventory | All 220 frontend baseline modules retained, plus the new monitoring policy; all 78 backend modules retained |
| Typecheck and lint | TypeScript 7 and both ESLint 10 workspace checks passed |
| Production build | Clean Turbopack build passed, including typechecking and 802 generated pages |
| Entry JavaScript budgets | Passed without increasing limits |
| Interface/design contract | Passed in light/dark themes at 320, 390, 768, 1366 and 1440 pixels |
| Full browser suite | 38 passed; completed shared-workspace run reviewed from its captured log |
| Root check | Typecheck, lint and full tests passed in the captured shared-workspace run |

Frontend coverage improved from 41.25% to 41.40%; backend coverage exactly matches its 76.77% baseline. Existing per-file thresholds remain unchanged. The final test inventory includes the concurrently added `monitoring.integration.test.ts`, which also verifies real Sentry stack frames, event identity, release/environment labels and flush completion with a local transport.

Additional completed checks:

- Clean `npm ci` in a separate Windows source copy; no invalid dependency or peer errors from `npm ls --all`. Sharp's installer leaves two optional WASM packages marked extraneous, also seen in the existing installation.
- TypeScript 7 frontend typecheck and contracts declaration build.
- ESLint 10 frontend and backend lint, with zero warnings.
- Backend startup without optional integration credentials, runtime entry-point resolution, and materialized-workspace deployment verification in the clean Windows copy.
- Real Firebase SDK initialization and real Sentry SDK local-transport error capture.
- Local training load: section, adaptive, and mission scenarios at concurrency 1 and 5, with zero failed learners and zero request errors. This uses a disposable local Mongo replica set, not production capacity.
- npm audit: zero vulnerabilities.

The initial concurrent coverage commands encountered a Windows shell crash. Other shared-workspace coverage runs also removed temporary files during collection. The successful final runs use direct file logging and a separate installation. The first build encountered a native loader subprocess crash under concurrent machine load; both the subsequent shared-workspace build and the independent clean-install build passed.

Migration snapshots and isolated-run logs are retained in `D:/codex-dependency-migration-20260926-ad6313126ce047b08fb07c2cf083b9b5/`. The reviewed root-check and 38-test browser logs are in `D:/codex-dependency-completion-20260926/`; [the accompanying completion record](DEPENDENCY_COMPLETION_VERIFICATION.md) also records the frontend-only CI installation check. No application production code changed between that browser run and the final isolated build; subsequent edits concern tests, coverage configuration, and documentation.

## Release checks and rollback

Build verification used the local fixture API with Sentry DSNs and upload credentials disabled. Local verification cannot establish authenticated source-map upload, readable errors in the remote Sentry project, Vercel preview behavior, production monitoring performance/sampling, actual Azure runtime compatibility, real push delivery, or production capacity. Run those checks in the existing preview/CI deployment process before production promotion. Linux execution is not available on this Windows host; the lockfile includes the TypeScript 7 Linux native packages, and Linux CI remains a separate gate. Lighthouse was not rerun; the browser performance tests and entry bundle budgets passed.

Retain the manifests, root lockfile, compatibility configuration, generated declarations, and related test/fixture changes together. To roll back, restore a coherent dependency/configuration checkpoint and reinstall its lockfile in an isolated checkout. Do not roll back unrelated application work or application data.

## References

- [Firebase Admin Node release notes](https://firebase.google.com/support/release-notes/admin/node)
- [TypeScript 7 and the side-by-side TypeScript 6 API](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [ESLint compatibility utilities](https://eslint.org/blog/2024/05/eslint-compatibility-utilities/)
- [Vitest migration guide](https://main.vitest.dev/guide/migration/)
- [jsdom releases](https://github.com/jsdom/jsdom/releases)
- [Sentry 11 migration guide](https://github.com/getsentry/sentry-javascript/blob/11.0.0/MIGRATION.md)
