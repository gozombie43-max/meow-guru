# Meow Guru — System Architecture

## 1. Monorepo Structure

Meow Guru is structured as an npm workspaces monorepo with three core packages:

| Workspace | Path | Stack | Responsibilities |
| :--- | :--- | :--- | :--- |
| `@meow/contracts` | [`contracts/`](../../../contracts) | Zod, TypeScript declarations | Shared request/response validation schemas, DTO contracts (`auth`, `questions`, `quiz-grading`, `progress`, `exam-paper`, `jam`), and runtime boundary types. |
| `backend` | [`backend/`](../../../backend) | Node.js 22 (ESM), Express 5, Socket.IO, MongoDB Node Driver, Redis, BullMQ | REST API, JWT + durable session authorization, adaptive training engine, mock test engine, real-time ranked Battle mode, AI Tutor gateway, and background workers. |
| `frontend` | [`frontend/`](../../../frontend) | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, SWR, KaTeX | Student and Admin web application, Edge/Node request proxy ([`frontend/proxy.ts`](../../../frontend/proxy.ts)), offline-capable training/mock persistence, and responsive light/dark UI. |

---

## 2. Request & Transport Topology

- **Browser to Frontend Proxy:** By default, client API calls target `/backend-api/*`, which Next.js rewrites to the Express backend (`API_URL`).
- **Access-Code & Route Gate ([`frontend/proxy.ts`](../../../frontend/proxy.ts)):** Verifies the `access_session` cookie using constant-time HMAC-SHA256 signature and 24-hour expiration checks (`SESSION_SECRET`, isolated from `JWT_SECRET`). Public upload format guides (`/docs/paper-image-zip-policy.md` and `/docs/question-bank-image-zip-policy.md`) are explicitly allowlisted.
- **Server-Side Catalog Seeding:** Subject hubs (such as `/mathematics`) fetch public topic counts on the server from `/api/questions/topic-counts` and seed client SWR caches via `CatalogSeed`, separating public catalog totals from authenticated `/api/progress/topics/private` requests.

---

## 3. Authentication & Authorization

- **Token & Session Model ([`backend/auth/sessions.js`](../../../backend/auth/sessions.js)):**
  - Short-lived JWT access tokens are paired with an `HttpOnly` refresh cookie.
  - Every protected API request verifies the JWT and validates active session and user state (`authSessions` and `users` collections in MongoDB) with per-process in-flight deduplication and revisioned L1/Redis caching.
  - Refresh rotation, logout, role changes, and account suspension advance durable revisions and publish advisory Redis invalidation events across instances, immediately disconnecting active Socket.IO principals when authority is revoked.
- **HTML Session Preload:** On initial page load, a self-contained HTML bootstrap initiates the `HttpOnly` refresh-cookie exchange and `/users/me` profile fetch before client bundles finish hydrating.

---

## 4. Data Storage & Caching

- **Primary Database (MongoDB Replica Set):**
  - Authoritative store for `questions`, `users`, `authSessions`, `userTopicProgress`, `userQuestionProgress`, `aiConversations`, `aiMessages`, `mockSlots`, `mockCatalogMetadata`, `mockAttempts`, `trainingSessions`, `battleRooms`, and schema migrations (`schemaMigrations`).
  - Multi-document replica-set transactions enforce atomic commit semantics across quiz answer commands (`POST /api/questions/answer`), training session actions, mock submissions, notification receipts, and mock catalog metadata updates.
  - See [Database Architecture](./database-architecture.md) for catalog snapshot and migration design.
- **Caching, Rate Limiting & Queues (Redis):**
  - **Cache Redis (`REDIS_URL`):** Revision-fenced L2 cache with UUID-owned distributed leases, stampede coalescing, 512 KiB JSON / 2 MiB EJSON payload bounds, and a 5-failure circuit breaker. MongoDB remains authoritative if Redis is degraded or offline.
  - **Rate Limiting:** Fixed-window Lua counters using Redis server time, with bounded per-instance local fallback (`0.5x` conservative emergency multiplier on auth, AI, agent, and upload routes).
  - **Durable Queue Redis (`QUEUE_REDIS_URL`):** Isolated BullMQ queue connection requiring `maxmemory-policy=noeviction` and enabled persistence (`RDB`/`AOF`), governed by Lua backlog and per-owner admission quotas.
  - See [Redis Phase C Resilience Audit](../audits/backend/2026-10-07-redis-phase-c-resilience-audit.md).
- **Object Storage (Backblaze B2):**
  - Stores question/option/solution images (`question-images/`, `solution-images/`, `notes/images/`), PDFs, and temporary tutor attachment inputs (`tutor-jobs/`).
  - Served via `/api/upload/image/:id` with strict key prefix allowlisting (`SAFE_IMAGE_KEY_REGEX`) and `sharp` pixel/dimension bounds (max 6000px per side, 25 MP).

---

## 5. Runtime Roles & CI/CD

- **Process Roles ([`backend/config/processRole.js`](../../../backend/config/processRole.js)):**
  - `PROCESS_ROLE=api`: HTTP server and Socket.IO realtime gateway (with optional embedded maintenance and attachment workers when `RUN_EMBEDDED_WORKERS=true`).
  - `PROCESS_ROLE=worker`: Dedicated maintenance, scheduled notifications, and battle relay worker.
  - `PROCESS_ROLE=attachments`: Isolated child-process OCR/PDF tutor extraction worker.
  - See [Infrastructure](./infrastructure.md) and [Deployment Runbook](../runbooks/deployment.md).
- **Continuous Verification ([`.github/workflows/ci-verify.yml`](../../../.github/workflows/ci-verify.yml)):**
  - Policy-routed pipeline (`scripts/ci-policy.mjs` and `scripts/ci-gate.mjs`) running secret scanning (Gitleaks), dependency audits across all workspaces (`root`, `frontend`, `backend`, `@meow/contracts`), unit/integration coverage, Redis correctness/fault suites, production bundle/interface budgets, Playwright desktop/mobile E2E suites, and Lighthouse performance checks before gating production backend deployment on `refs/heads/main`.
  - See [CI Verification & Deployment Audit](../audits/reliability/2026-10-21-ci-verification-and-deployment-audit.md).
