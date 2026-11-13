# Meow Design System Specification (Phase 1 Authority)

> **Status**: Phase 1 Specification — Pending Review Before Phase 2 Implementation  
> **Scope**: Authoritative design tokens, theme strategy, component contracts, page templates, and PR migration rules for `frontend/` (`86` routes, Dark & Light modes).  
> **Code Freeze Rule**: Do not begin rewriting global CSS or migrating routes until this specification is approved.

---

## 1. Core Design Principles

1. **OLED-first dark clarity**: Canonical dark palette grounded in deep slate-black (`#080C11`), elevated surface (`#111722`), hairline borders (`#222A38`), high-contrast ink (`#F1F4F8`), and disciplined blue accents (`#3B82F6` / `#60A5FA`).
2. **Minimal visual noise**: Flat surfaces separated by `1px` hairline borders and restrained contrast steps — **no decorative `backdrop-filter` glassmorphism, radial background blobs, or multi-layer neon button glows**.
3. **Unified dual-theme engine**: Light mode is preserved through the **exact same semantic CSS variables and React components** with theme-scoped values (`html.theme-dark` default, `html.theme-light` opt-in). Zero parallel light-only or dark-only component trees.
4. **Mobile-first & safe-area safe**: Built for viewports `360px` through `1440px+`, respecting `--safe-top` / `--safe-bottom` / `--safe-left` / `--safe-right`, `44px` minimum touch controls, and banning `100vh` / `min-h-screen` per `frontend/design.md`.
5. **Preserve domain UX**: Templates structure chrome, spacing, and state boundaries while preserving authentic UX differences across Dashboard, Subject Listings, Practice Quiz, Mock Test (`preserveScroll` / exam timer / question navigator), Training Session, and Battle Arena.
6. **Exemption discipline**: Semantic status colours (`success`, `warning`, `error`, `info`) and specialized colours for charts, geometry diagrams (`GeometryRenderer.tsx`), rich KaTeX/formula highlights, and subject badges remain explicitly exempted from blind palette flattening.

---

## 2. Target Repository Structure (`frontend/`)

Because `frontend/tsconfig.json` resolves `@/*` to `frontend/*` (there is no `src/` folder), Phase 2 places the design system cleanly at `frontend/design-system/` without disrupting existing `app/` routes:

```text
frontend/
├── design-system/
│   ├── tokens/
│   │   ├── theme.css          # Tailwind v4 @theme + canonical --meow-* dark & light variables
│   │   ├── legacy-bridge.css  # Temporary compatibility aliases (--dark-*, --oled-*, --light-*, --ui-*)
│   │   └── motion.css         # Shared @keyframes (spin, fadeIn, shake) & reduced-motion guards
│   ├── components/            # Genuinely reusable primitives (Button, Card, Input, Dialog, Badge, Spinner, Table...)
│   ├── patterns/              # Cross-feature UI compositions (SearchFilterBar, PageHeader, StatRow, Empty/ErrorState)
│   ├── layouts/               # Approved structural page templates (Dashboard, Listing, Quiz, Config, Analytics)
│   └── guidelines/            # Mirror of this approved spec for AI agents & PR reviewers
├── features/                  # Feature-specific business logic & views (quiz, mock-test, training, battle, admin)
├── components/                # Gradually thinned wrapper/legacy location until P5 cleanup
└── app/                       # Next.js routes consuming layouts + features
```

> **Boundary rule**: Reusable UI primitives live in `frontend/design-system/`. Domain logic (timer state, battle sockets, quiz scoring, Convex/API hooks) stays inside `frontend/features/` or route segments.

---

## 3. Specification Index

- [tokens.md](file:///c:/Users/91906/Ai%20ssc/design-system/tokens.md) — Canonical Dark & Light colours, WCAG contrast verification, semantic states, typography, `4px` spacing scale, radii, control heights, icon sizes, motion, unified breakpoints, and legacy token alias bridge.
- [components.md](file:///c:/Users/91906/Ai%20ssc/design-system/components.md) — Phase 2 shared React component contracts, variant matrices (`primary`, `secondary`, `ghost`, `destructive`, `loading`, `disabled`), accessibility requirements, and wrapping strategy for `data-ui-button`, `Dialog.tsx`, and quiz primitives.
- [templates.md](file:///c:/Users/91906/Ai%20ssc/design-system/templates.md) — The 5 canonical Page Templates (`Dashboard`, `Listing`, `Quiz`, `Configuration`, `Analytics`), Auth/Admin specializations, navigation & shell behaviour, and route mapping across all `86` routes.
- [migration-rules.md](file:///c:/Users/91906/Ai%20ssc/design-system/migration-rules.md) — Theme-switching & isolation rules, dev-route gating (`/glass-test`, `/preview-palette`, `/dev/convex-auth`, `app/ai-test/layout.tsx`), P0 PR split plan, CSS deprecation policy, and automated Playwright/CI gates.
