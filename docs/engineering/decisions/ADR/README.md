# Architecture Decision Records (ADR)

This directory holds Architecture Decision Records (ADRs) documenting significant technical decisions across the Meow Guru monorepo (`@meow/contracts`, `backend`, and `frontend`).

## Existing Architectural Documentation

Foundational architectural specifications and policies are currently documented in [`docs/engineering/architecture/`](../../architecture/):

- [System Architecture Overview](../../architecture/system-architecture.md)
- [Database Architecture & Transactional Catalog Metadata](../../architecture/database-architecture.md)
- [Azure B1 Runtime & Embedded Workers Infrastructure](../../architecture/infrastructure.md)
- [Ranked Battle v2 Competitive Policy & Matchmaking Leases](../../architecture/battle-competitive-policy.md)
- [Bilingual Mock & PYQ Papers Architecture](../../architecture/bilingual-mock-papers.md)
- [IIT JAM Physics Mode Specification](../../architecture/iit-jam-mode.md)

## ADR Naming & Template

When recording a new architectural decision, create `docs/engineering/decisions/ADR/NNNN-short-title.md` (e.g., `0001-server-readable-session-for-private-ssr.md`) using the template below:

```markdown
# ADR-NNNN: Title

- **Status:** Proposed | Accepted | Superseded
- **Date:** YYYY-MM-DD
- **Context / Commit:** <commit-sha>

## Context and Problem Statement

Describe the architectural problem, constraints, and forces at play.

## Decision

State the chosen design clearly and concisely.

## Consequences

- **Positive:** ...
- **Negative / Tradeoffs:** ...
- **Verification:** ...
```
