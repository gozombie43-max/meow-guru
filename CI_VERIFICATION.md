# CI verification and production deployment

The continuous verification workflow owns production deployment. Azure's production
workflow is reusable only, so a backend push no longer launches a second complete
copy of verification. The deployment packages the same `github.sha` that passed
the quality gate, and existing migration, runtime dependency, and release health
checks still run.

## Verification policy

| Event | Browser checks | Lighthouse | Production backend deployment |
| --- | --- | --- | --- |
| Development branch push | Desktop/mobile assessment and resource smoke | Skipped | Never |
| PR into main, master, or develop | Full desktop/mobile suite | Six routes, three runs each | Never |
| Push to main | Full desktop/mobile suite | Six routes, three runs each | Only when backend deployment paths changed |
| Push to master | Full desktop/mobile suite | Six routes, three runs each | Never |
| Scheduled run | Full desktop/mobile suite | Six routes, three runs each | Never |
| Manual continuous verification | Full desktop/mobile suite | Six routes, three runs each | Opt-in, main only |
| Reusable verification, including staging | Full desktop/mobile suite | Six routes, three runs each | Disabled by default |

Scheduled verification runs at 20:30 UTC (02:00 India time the following day),
subject to GitHub's scheduling availability. A direct main push is a production
candidate and retains full verification. Use development branches for fast feedback.

Deployment paths are `backend/**`, `contracts/**`, the root package manifests,
the continuous verification and production deployment workflows, and `scripts/ci-*`.
The policy examines the entire push range, including removed paths and renames.
An unknown or unavailable push base conservatively requests backend deployment.

## Independent checks and gates

- The production build job retains build, bundle budgets, and interface checks.
- Desktop and mobile regression jobs run on separate GitHub runners. Each starts
  its own disposable Mongo/backend fixture and retains `workers: 1`.
- Lighthouse runs independently of Playwright. It no longer waits for E2E to finish.
- Development smoke exercises login, saved assessment reload/submission, and
  resource rendering in both themes on desktop and mobile.
- **Fast Quality Gate** requires the original fast checks and development smoke
  when selected. It can finish before the full release jobs.
- **Quality Gate** retains the existing check name. PRs, main/master commits,
  scheduled runs, and manual/reusable verification must pass full regression and
  the Lighthouse job. Only policy-selected skips are accepted.
- Azure deployment depends on Quality Gate. Failed, cancelled, missing, or
  unexpectedly skipped checks cannot pass either gate.

Each independent browser/performance job installs and builds its own checkout.
The measured baseline production build was 37 seconds; build artifact transfer is
not assumed cheaper. Measure a new GitHub run before adding build-sharing machinery.

Superseded development verification runs are cancelled. Main and manual runs use
separate run groups so a later commit cannot cancel a release gate or migration.
Production deployment has its own concurrency group with cancellation disabled.
The staging deployment retains its existing concurrency policy.

## Manual production deployment

In Actions, select **Continuous Verification & Quality Gate**, choose **Run
workflow**, select **main**, and enable **deploy_backend**. This runs full checks
before calling production deployment. A non-main deployment request fails policy
validation. The Azure workflow no longer has a separate Run workflow entry.

Staging continues calling reusable verification with `verification_only: true`.
Its calling job declares the permission ceiling required by the nested workflows;
verification policy disables production deployment in that context.

## Failure evidence

Smoke and each regression project upload separate Playwright HTML reports and test
results, including retained failure traces. Lighthouse uploads its raw reports and
filesystem output even if collection/assertion fails. Artifacts are retained for
14 days. The build diagnostics and pagination benchmark artifacts remain available.
Secret scanning can read PR metadata and writes its findings to the job/artifact;
automatic PR comments are disabled, so it does not require PR write permission.

## Verification commands

```powershell
node --test scripts/ci-policy.test.mjs scripts/ci-gate.test.mjs
git diff --check

$env:API_URL = 'http://127.0.0.1:3111'
npm run build
npm run check:performance --workspace frontend
npm run check:interface --workspace frontend

npm run test:e2e --workspace frontend -- assessment.spec.ts resource.spec.ts --forbid-only --reporter=line,html
npm run test:e2e --workspace frontend -- --project=desktop --forbid-only --reporter=line,html
npm run test:e2e --workspace frontend -- --project=mobile --forbid-only --reporter=line,html
```

Run local browser commands sequentially because the current fixture uses fixed
ports. The GitHub matrix supplies separate runners, so those jobs can run together.
Validate all workflows with actionlint as well as YAML parsing; local actionlint
validation does not prove GitHub execution, Azure credentials, or deployment.

## Performance enforcement checkpoint

Lighthouse retains the existing thresholds and `warn` severity. The baseline run
on 2026-10-21 exceeded the LCP target on mathematics, active training, algebra quiz,
and mock attempt. Do not call these thresholds enforced, or switch them to
`error`, until route performance has been repaired and measured. The route validator
still fails on missing audits, redirects, runtime/browser errors, or missing
successful session/question requests.

The baseline run took 15m 22s: build 37s, E2E 9m 29s, and Lighthouse 3m 48s.
Future fast/release timings require a fresh GitHub Actions run after these changes.

The downloaded baseline artifact was checked against its GitHub SHA256 digest.
Its three-run mobile medians identify the next performance work:

| Route | Performance | LCP | Reported LCP element |
| --- | --- | --- | --- |
| Mathematics | 0.85 | 4,349ms | First topic thumbnail, currently lazy loaded |
| Active training | 0.90 | 3,501ms | Question text |
| Algebra quiz | 0.86 | 3,758ms | Session restoration message |
| Mock attempt | 0.88 | 3,710ms | Timer |

The mathematics report attributes about 2.66 seconds to image load delay. The
other routes primarily attribute the delay to rendering. These reports identify
investigation targets, not proof of a particular application fix. Preserve real
question/session loading when measuring improvements; do not optimize the audit
by removing useful content or bypassing authentication.

## Local verification on 2026-10-21

| Check | Result |
| --- | --- |
| Policy, Git range/rename, CLI output, and gate failure tests | 13 passed |
| All seven workflow files | actionlint and unique-key YAML parsing passed |
| Workflow shell scripts | 76 Bash syntax checks passed; shellcheck was unavailable |
| Root production build | Contracts, backend/runtime boundaries, and Next build passed |
| Entry JavaScript budgets and interface checks | Passed |
| Development browser smoke | 6 passed |
| Full desktop project | 127 passed, 20 skipped, 0 failed, 0 flaky |
| Full mobile project | 132 passed, 15 skipped, 0 failed, 0 flaky |
| Route validator replay against downloaded baseline reports | All 18 reports passed |

Browser reports are under `test-results/ci-split/desktop-html/` and
`test-results/ci-split/mobile-html/`. Both full projects retained the existing
conditional skips for opt-in fixtures, representative dynamic routes, and
environment-specific tests. The test-generated tracked screenshot was restored.
At this CI-split checkpoint, Lighthouse collection had not been rerun. The
subsequent local performance implementation, fresh measurements, and verification
are recorded in [PERFORMANCE_VERIFICATION.md](./PERFORMANCE_VERIFICATION.md).
GitHub workflow execution and Azure deployment have not been rerun. No commit,
push, production migration, or cloud setting change was made.
