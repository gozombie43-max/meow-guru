# Audit verification and implementation

Verified against local `main` at `f02b2258` on 2026-10-04. This change implements the confirmed findings in the supplied audit. Note creation, editing, deletion, and image upload accept only the current database roles `admin` and `superadmin`.

## Findings and resulting behavior

| Audit finding | Verification and implementation |
| --- | --- |
| Anonymous note-image uploads | Confirmed. Authorization runs before upload limiting, lazy route loading, multipart parsing, decoding, and storage. The route independently requires admin authorization. Missing login returns 401; other roles return 403. Notes editor routes and write controls use the same exact role allowlist. |
| Client MIME trusted | Confirmed. Notes accept a maximum 5 MB of actual JPEG, PNG, or WebP bytes. Sharp fully decodes and re-encodes static images, limits input to 25 million pixels and 6000 pixels per side, rotates, strips metadata, and stores WebP within 2000 pixels per side. GIF, SVG, animated images, truncated data, and spoofed non-images are rejected. |
| B2 note-image orphans | Confirmed. Saved HTML determines `imageKeys`; client-supplied key arrays cannot override them. Pending uploads have a 48-hour grace period. Note updates/deletion schedule removed references for cleanup. A worker checks shared references, leases cleanup, prevents concurrent saves from retaining a deleting image, retries storage failures, and inventories older uploads in bounded pages. Database changes precede cleanup so a storage failure cannot destroy images in a note that still exists. |
| Anonymous Tutor and IP-based quotas | Confirmed. Every AI route authenticates before account-aware limiting/admission. Tutor submit, polling, and cancellation require login. Job reads and cancellation are scoped to the authenticated owner. Polling and cancellation do not consume generation quota. |
| Large Base64 Tutor job payloads | Confirmed. New jobs store raw validated attachments in object storage and only metadata/object keys in MongoDB. Attachment limit is 8 MB. Images use the same actual-content decoder; PDFs require a PDF header and EOF signature, followed by actual parsing in the attachment worker. Existing queued Base64 jobs can drain through a compatibility path. |
| Missing durable Tutor cost controls | Confirmed. MongoDB atomically reserves daily request, stored attachment byte, and conservative token allowances; durable per-user queued/running slots work across instances. Idempotent retries reuse jobs and usage reservations. Extracted model text is capped at 12,000 characters. Upload, cancellation, and cleanup use ownership leases; separate storage keys prevent cleanup collisions after job TTL expiry. |
| Hardcoded JWT secrets and environment fail-open | Confirmed. JWT fallbacks are removed. API and worker startup validate explicit `NODE_ENV`, separate secrets of at least 32 characters, and Tutor limits. An explicit staging/production deployment requires production settings. Unknown environments cannot use development rate-limit or localhost-origin fallbacks. Validation errors do not expose secrets. |
| Tiny backend typecheck scope | Confirmed. Strict JSDoc/`@ts-check` coverage now includes 10 selected modules across configuration, JWT/origin/role authorization, metadata persistence, Tutor policy, image/PDF validation, and note image key parsing. This is the first incremental stage; the full legacy backend is not typechecked. |
| Metadata service owns Mongo queries | Confirmed. Aggregation and persistence access now live in `questionMetadataRepository`; service normalization, caching, and warming remain in the service. Existing revision/snapshot repository helpers are preserved. A runtime boundary check protects the new separation. |
| Coverage gates cover only a few files | Confirmed. Both workspaces now have measured global floors and retain their existing critical-file gates. Backend JWT, environment, upload validators, Tutor policy, and attachment processing additionally require 90% coverage. See baseline/floor table below. |
| Compressed Battle handlers | Confirmed. Matchmaking join/cancel and social challenge handlers are expanded into readable control flow without changing their behavior. |
| Frontend CSP missing | Confirmed in repository configuration. Next.js now sends `Content-Security-Policy-Report-Only` globally, with a bounded report endpoint and rate-limited logging that strips URL details and script samples. Known application integrations are listed. This phase observes violations; enforcement requires reviewing reports from real production integrations. |
| CSRF concern | The audit's older concern was already addressed by trusted origins and OAuth state. Existing protections remain, with regression checks for malicious origins, configured origins, malformed referrers, and production localhost fallback rejection. |
| KaTeX HTML rendering | `trust: false` is already present. No confirmed vulnerability required a change. |
| Dead `generator.js` route | Already absent at the audited commit. No deletion required. |

## Quota and coverage configuration

Tutor defaults are 100 requests/day, 40 MiB of validated stored attachment bytes/day, 10,000,000 conservative token credits/day, four queued attachments, and two processing attachments per account. Daily windows use UTC. Environment overrides are documented in `backend/.env.example`.

Token credits reserve input, system prompt, bounded extraction, a vision allowance, maximum completion, and possible worker attempts/text fallback. They are conservative reservations, not a measurement of provider billing. Failures are not refunded because a failed provider request may still incur cost.

Coverage percentages are ordered as lines / statements / functions / branches:

| Workspace | Measured pre-change baseline | Global floors |
| --- | --- | --- |
| Backend | 76.81 / 74.17 / 69.24 / 65.49 | 76 / 73 / 68 / 64 |
| Frontend | 44.45 / 42.38 / 36.82 / 34.85 | 44 / 42 / 36 / 34 |

## Verification

Local verification uses disposable MongoDB and a loopback S3-compatible object server. Note authorization, Sharp processing, actual AWS SDK upload/resolver behavior, image preview, save/read/delete, and desktop/mobile editor access are exercised together. Paid AI calls and live cloud writes are not part of these fixtures.

- Full frontend coverage: **410 tests passed** across 88 files; final percentages **44.66 / 42.63 / 37.14 / 35.08**.
- Full backend coverage: **588 tests passed**, with two optional real-Redis checks skipped, across 100 passing files and one skipped file. Final percentages **77.59 / 74.90 / 70.26 / 66.38**; all global and critical-file thresholds passed.
- Targeted storage deletion/security integration: **25 tests passed**. Provider command assertions cover exact-key filtering, permanent version deletion, delete-marker ordering, bounded retries, and storage failures.
- Targeted extraction-budget/environment checks: **19 tests passed**.
- Notes and mobile polish browser checks: **16 tests passed** across desktop/mobile, including admin and superadmin image upload, preview, save, read, and delete; student and signed-out editor access is blocked.
- Full desktop/mobile Playwright suite: **220 tests passed**, with 10 existing quiz checks skipped because `NAVIGATION_APP_URL` was unset. A follow-up run with `NAVIGATION_APP_URL=http://127.0.0.1:3110` enabled those checks: **all 10 passed**. All 230 discovered browser cases passed across the two runs, including all-route captures and local performance gates.
- Workspace typechecks, backend/frontend lint, production builds, runtime boundary checks, interface checks, and bundle budgets passed. Next.js generated **802 pages**.
- `npm audit`: **0 vulnerabilities**.

The two optional real-Redis reliability tests require `REDIS_TEST_URL` and were skipped locally. Fixture success is not evidence of live Redis, B2, paid-model, staging, or production behavior. Dependency updates were installed from the existing lockfile workflow; a fresh `npm ci` was not rerun in this session.

## Deployment requirements

1. Set explicit environment values and distinct JWT/refresh secrets. For staging and production, set `NODE_ENV=production`; set `DEPLOYMENT_ENVIRONMENT` to match the target. Keep previously issued signing secrets if sessions must survive this release.
2. Before starting this backend release, run `npm run db:migrate --workspace backend` against the intended database. Migration `015-audit-security` adds reference/cleanup and quota indexes and backfills legacy note image references. Startup intentionally rejects a database missing required migrations.
3. Run the maintenance worker for note-image cleanup and the attachment worker for Tutor processing/cleanup (or the existing authorized embedded-worker mode). B2 credentials need object write/read, version listing, and version deletion capabilities for the relevant prefixes. Cleanup removes exact unused data versions, then delete markers, rather than merely hiding objects. Do not apply an unconditional upload-age expiry to the pending namespace: saved notes can retain keys in that namespace.
4. Review CSP reports under real Firebase/OAuth, Monaco, fonts, Sentry, API, and asset traffic before moving from Report-Only to enforcement. Local browser checks of the production build report evaluation used by existing scripts, so enforcement is deliberately deferred.

No live database migration, cloud cleanup, deployment, or commit was performed by this change.

## Primary references

- [Sharp input options and pixel limits](https://sharp.pixelplumbing.com/api-constructor/)
- [Backblaze S3 deletion and version IDs](https://www.backblaze.com/apidocs/s3-delete-object)
- [Backblaze lifecycle and retained file versions](https://www.backblaze.com/docs/en/cloud-storage-lifecycle-rules)
- [CSP Report-Only behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only)
