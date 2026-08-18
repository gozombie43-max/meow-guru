# Jules Autonomous Agent Guidelines — QuizGuru / Ai-SSC

## Repository Context & Architecture
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, KaTeX for math formula rendering.
- **Backend**: Express 5, Node.js 22 (ES Modules), Azure Cosmos DB (`quizDB`), Azure OpenAI (`o4-mini`), Socket.io for battle mode.
- **Cosmos DB Partitioning**:
  - `questions` container -> `/topic`
  - `users` container -> `/email` (always use point reads `container.item(id, email).read()` when email is known)
  - `mockAttempts` container -> `/userId`
  - `mockTestSlots` container -> `/examSlug`
  - `accessCodes` container -> `/code`

---

## Jules Autonomous Investigation Tasks

### Task 1: KaTeX Performance & Memoization Verification
- Refer to `.jules/bolt.md`.
- **Constraint**: `katex.renderToString` is CPU heavy. Any string parsing and formula rendering must be cached (`MathRenderer.tsx`).
- **Goal**: When reviewing or creating quiz modules, ensure options list changes do NOT trigger repeated DOM/formula evaluations.

### Task 2: Cosmos DB RU Optimization Audit
- Ensure queries against the `questions` container include partition key (`/topic`) wherever feasible to avoid cross-partition fanout.
- User queries must use point reads (`container.item(id, email).read()`) using `req.user.email` from JWT.
- Avoid calling `LOWER(c.field)` inside WHERE clauses when an exact indexed match is possible.

### Task 3: Security & Input Validation Gate
- Every Express route mutating state MUST have Zod schema validation (`validateBody`, `validateQuery`, `validateParams`).
- Never introduce raw HTML injection with `dangerouslySetInnerHTML` unless wrapped through sanitized `MathRenderer`.
- Never expose server secrets (`AZURE_OPENAI_KEY`, `JWT_SECRET`, `ADMIN_SECRET`) to client-accessible `NEXT_PUBLIC_*` namespaces.

### Task 4: Continuous Build & Quality Verification
- Verify that `npm run build` succeeds without hydration errors or missing module paths.
- Ensure all new components provide proper ARIA attributes (`aria-label`, `role="button"`) and keyboard event listeners.
