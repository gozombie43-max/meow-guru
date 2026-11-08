# Meow Guru — Engineering Documentation

This directory is the central engineering documentation hub for **Meow Guru**, covering system architecture, database design, infrastructure, operational runbooks, architectural decisions, and the single-source-of-truth index for security, performance, backend, frontend, and reliability audits.

---

## Directory Structure

```text
docs/engineering/
├── README.md                                                     # Central engineering documentation index
│
├── architecture/
│   ├── system-architecture.md                                    # End-to-end monorepo, auth, caching, and runtime overview
│   ├── database-architecture.md                                  # MongoDB catalog metadata, transactional snapshots, and migrations
│   ├── infrastructure.md                                         # Azure Linux B1 runtime topology and embedded workers
│   ├── battle-competitive-policy.md                              # Ranked Battle v2 domain rules, matchmaking leases, and scoring
│   ├── bilingual-mock-papers.md                                  # Bilingual mock/PYQ paper contract and sequential section timers
│   └── iit-jam-mode.md                                           # IIT JAM Physics mode architecture and MCQ/MSQ/NAT rules
│
├── audits/
│   ├── README.md                                                 # Central Audit Index (Single Source of Truth)
│   ├── security/
│   │   ├── 2026-11-07-zero-regression-hardening-audit.md         # P0–P2 security vulnerability audit & remediation (VULN-01–VULN-10)
│   │   └── 2026-11-07-security-hardening-project-plan.md         # Security hardening milestone matrix and regression test mapping
│   ├── performance/
│   │   ├── 2026-10-21-lighthouse-and-render-path-audit.md        # Mobile Lighthouse LCP/TBT/CLS and render-path audit
│   │   ├── 2026-10-08-request-flow-audit.md                      # Baseline end-to-end request-flow audit (F1–F17)
│   │   └── 2026-10-08-request-flow-remaining-and-auth-probes.md  # Remaining production/Atlas measurements and auth probes
│   ├── backend/
│   │   ├── 2026-10-07-redis-phase-c-resilience-audit.md          # Redis operational resilience, queue admission, and staging gates
│   │   └── 2026-09-08-battle-production-test-matrix.md           # Battle concurrency, reconnect, and settlement test matrix
│   ├── frontend/
│   │   ├── README.md                                             # Frontend audits index and design system links
│   │   ├── 2026-10-22-frontend-theme-and-layout-audit.md         # Light/dark theme, responsive viewport, and UI verification audit
│   │   └── assets/                                               # Curated visual reference screenshots (light/dark, mobile/desktop)
│   ├── reliability/
│   │   ├── 2026-10-21-ci-verification-and-deployment-audit.md    # Continuous verification gates, CI routing, and deployment audit
│   │   └── 2026-10-15-battle-production-launch-checklist.md      # Ranked Battle production readiness checklist
│   └── archive/
│       ├── 2026-10-08-ci-security-and-bundle-fix.md              # Historical dependency CVE patches and quiz bundle split
│       ├── 2026-10-08-request-flow-batch-a.md                    # Request-flow Batch A remediation evidence (F6, F8, F12, F15)
│       ├── 2026-10-08-request-flow-batch-b.md                    # Request-flow Batch B remediation evidence (F2, F3, F7, F16)
│       ├── 2026-10-08-request-flow-batch-c.md                    # Request-flow Batch C remediation evidence (F4, F5, F9, F17)
│       ├── 2026-10-08-request-flow-batch-d.md                    # Request-flow Batch D remediation evidence (F4, F10–F14)
│       ├── 2026-10-08-request-flow-latency-check.md              # Point-in-time local latency benchmark after Batches A–D
│       ├── 2026-10-07-redis-phase-a-correctness-remediation.md   # Historical Redis Phase A correctness bug remediation
│       ├── 2026-10-07-redis-phase-b-hardening.md                 # Historical Redis Phase B lock fencing and stampede hardening
│       └── 2026-08-18-katex-mathrenderer-memoization-note.md     # Historical KaTeX MathRenderer memoization investigation note
│
├── decisions/
│   └── ADR/
│       └── README.md                                             # Architecture Decision Records index and template
│
└── runbooks/
    ├── deployment.md                                             # Production deployment, database migrations, and storage cutovers
    ├── canary-rollout.md                                         # Canary slot traffic routing, SLO evaluation, and rollback
    └── staging-reliability-and-recovery.md                       # Staging load tests, Redis/worker recovery drills, and DB restore
```

---

## Quick Links

- **Audits & Open Findings:** [Central Audit Index](./audits/README.md)
- **System Architecture:** [System Architecture Overview](./architecture/system-architecture.md)
- **Database & Catalog Snapshots:** [Database Architecture](./architecture/database-architecture.md)
- **Infrastructure & Process Roles:** [Azure B1 Runtime Infrastructure](./architecture/infrastructure.md)
- **Production Deployment Runbook:** [Deployment Runbook](./runbooks/deployment.md)
- **Canary Rollout & Rollback:** [Canary Rollout Runbook](./runbooks/canary-rollout.md)
- **Staging Load & Recovery Drills:** [Staging Reliability & Recovery Runbook](./runbooks/staging-reliability-and-recovery.md)

## Co-Located Workspace Documentation

The following documentation stays directly alongside its workspace code or static assets:

- **Root Overview:** [README.md](../../README.md)
- **Frontend Design System:** [frontend/design.md](../../frontend/design.md)
- **Frontend Workspace Guide:** [frontend/README.md](../../frontend/README.md)
- **Admin UI Guidelines:** [frontend/components/admin/README.md](../../frontend/components/admin/README.md)
- **Public Upload Format Policies (Served at Runtime):**
  - [frontend/public/docs/paper-image-zip-policy.md](../../frontend/public/docs/paper-image-zip-policy.md)
  - [frontend/public/docs/question-bank-image-zip-policy.md](../../frontend/public/docs/question-bank-image-zip-policy.md)
- **Backend Workspace Guide:** [backend/README.md](../../backend/README.md)
- **Observability & SLO Templates:** [backend/observability/README.md](../../backend/observability/README.md)
- **Migration & Lint Tooling:** [tools/azure-migration/README.md](../../tools/azure-migration/README.md), [tools/next-lint-glob/README.md](../../tools/next-lint-glob/README.md)

---

## Documentation Hygiene Rules

1. **Single source of truth for audits:** Register every security, performance, backend, frontend, or reliability audit in [audits/README.md](./audits/README.md) with its audited commit SHA, date, scope, findings, and remediation status.
2. **Preserve historical evidence:** Archive superseded or completed phase reports under `docs/engineering/audits/archive/` with `YYYY-MM-DD-` filename prefixes rather than overwriting or deleting them.
3. **Never commit generated test or benchmark dumps:** Playwright HTML reports (`playwright-report/`, `test-results/`), coverage directories (`coverage/`), ad-hoc UI verification dumps (`output/`), and raw benchmark JSON/JSONL files (`REQUEST_FLOW_*.json*`) belong in CI artifacts (14-day retention in `.github/workflows/ci-verify.yml`), not in Git.
4. **No secrets or PII:** Never include credentials, tokens, private keys, or real user data in any report or runbook.
