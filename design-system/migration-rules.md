# Phase 1 — Migration Rules, Dev-Route Gating & QA Policy (`migration-rules.md`)

---

## 1. Non-Negotiable Migration Rules

1. **No Big-Bang Rewrites**: Never rewrite all 80 CSS files or migrate multiple unrelated route families in a single PR.
2. **Progressive Semantic Migration (Zero Blind Search-Replace)**:
   - Dark theme (`#080C11` bg / `#111722` surface / `#222A38` border / `#F1F4F8` text / `#929CAF` secondary / `#687386` muted / `#3B82F6` accent / `#60A5FA` accent-light) MUST be adopted through `--meow-*` semantic tokens and `legacy-bridge.css`.
   - Do **not** blindly find-and-replace `#000000`, `#1c1c1e`, or `#ffffff` across charts, SVGs, math diagrams, or legacy modules without verifying dark & light contrast and visual regression diffs.
3. **One Theme Contract Across Both Modes**:
   - Light mode MUST stay functional across all student/auth/admin routes via `.theme-light` token overrides in `theme.css` (`check-light-theme.mjs` `>= 4.5:1` contrast & `[data-theme="dark"]` isolation MUST pass on every PR).
   - No feature page may ship light-only Tailwind classes (`bg-slate-50`, `text-slate-900`) or dark-only hardcoded arbitrary hexes (`bg-[#181613]`, `text-[#c9bfa9]`) once migrated.
4. **Preserve Feature UX & Logic**:
   - Route handlers, timers, sockets, offline caches, form validation, URL search params, analytics, and `preserveScroll` / `useQuizLeaveGuard` MUST remain intact.
5. **Kill Legacy CSS As You Migrate**:
   - Each page PR MUST migrate its corresponding CSS module / inline `<style jsx>` onto `design-system` tokens & components and delete dead rules instead of layering new `!important` overrides on top.

---

## 2. Development-Only Routes & Orphaned Layout Plan

Verified repo dependency scan results from Phase 0 / Phase 1 inspection:

| Target | Verified References Found | Action | Target PR |
|---|---|---|---|
| `/glass-test` (`app/(app)/glass-test/page.tsx`) | Zero code references anywhere in `frontend/` | Add dev-only guard (`if (process.env.NODE_ENV !== 'development') notFound()`) and remove/exclude from production surface. | **P0-C** (or **P5**) |
| `/preview-palette` (`app/(app)/preview-palette/page.tsx`) | Referenced ONLY in `frontend/proxy.ts:316` (exempt from access-code gate!) | Remove `/preview-palette` exemption from `proxy.ts:316` and gate route with `notFound()` outside `NODE_ENV === 'development'`. *(Also replace `alert()` if retained as dev swatch viewer for `--meow-*`)* | **P0-C** (or **P5**) |
| `/dev/convex-auth` (`app/dev/convex-auth/page.tsx`) | Referenced ONLY in `frontend/e2e/all-routes-screenshots.spec.ts:52` | Keep existing `notFound()` outside development; track in dev-only Playwright list if needed. | **No change / Verify** |
| `app/ai-test/layout.tsx` | Zero references in entire codebase; no `page.tsx` exists | Verify clean build/typecheck with file staged out, then remove orphaned `app/ai-test/` directory. | **P0-C** |

---

## 3. Split Execution Plan for P0 (Foundation Before Page Migration)

Per Decision 3, **P0 MUST be broken into small, independently verifiable PRs** rather than changing global CSS and application chrome simultaneously:

| PR | Scope | Files Touched (Target) | Required Verification Gate |
|---|---|---|---|
| **P0-A: Token Source & Tailwind v4 `@theme` + Legacy Bridge** | Add `frontend/design-system/tokens/{theme.css, legacy-bridge.css, motion.css}` and import at top of `app/globals.css`. Map existing `--ui-*` & `--background`/`--foreground` bridges without deleting legacy `--dark-*`/`--light-*` rules yet. | `design-system/tokens/*`, minimal import wiring in `app/globals.css` / `light-theme.css` / `dark-theme.css` | `npm run typecheck --workspace frontend`, `npm run check:interface --workspace frontend` (light/dark contrast >= 4.5:1), `npm run build --workspace frontend`. |
| **P0-B: Core Primitives (`Button`, `Card`, `Badge`, `Spinner`, `FeedbackToast`)** | Build foundational React components in `frontend/design-system/components/` stamping `data-ui-button` cleanly; unify `FeedbackToast` typography (`--meow-font-sans`). | `design-system/components/*`, `components/FeedbackToast.tsx` | Unit/component checks + `check:interface` + `check:performance` + Storybook/isolated contrast verification in dark & light. |
| **P0-C: Dialog & Form Primitives + Dev-Route Gating** | Build styled `ModalDialog`, `BottomSheet`, `ConfirmDialog` over `components/ui/Dialog.tsx`; build `Input`, `SearchInput`, `Select`, `Checkbox`, `Switch`; gate `/glass-test` & `/preview-palette` (remove `proxy.ts:316` exemption); remove orphaned `app/ai-test/layout.tsx`. | `design-system/components/{Dialog,Form}*`, `proxy.ts`, dev routes, delete `app/ai-test/layout.tsx` | `npm run typecheck`, `npm run build`, E2E dialog/focus/Escape tests, verify prod build returns 404 on dev routes. |
| **P0-D: Global Shell Chrome (`AppHeader`, `BackButton`, `BottomNav`, `NavRail`, `shell-policy`)** | Align responsive breakpoint at `1024px` (`< 1024px` BottomNav, `>= 1024px` Desktop rail/bar — fixing `1024`/`1025` bug), remove `.bottom-pill-nav` blur/duplication across `globals.css`/`dark-theme.css`/`light-theme.css`/`interface.css`, fix `shell-policy.ts` omissions (`/battle/rewards`, English study-mode roots), enforce `44px` `BackButton`. | `BottomNav.tsx`, `BackButton.tsx`, `lib/shell-policy.ts`, `design-system/patterns/AppHeader.tsx`, shell CSS cleanup | Playwright screenshot diff on key shell routes (`/`, `/mock-test`, `/play`, `/battle/rewards`) at `360×800`, `393×852`, `768×1024`, `1440×900` (`dark` & `light`), `check:interface`, horizontal overflow check (`scrollWidth <= innerWidth`). |
| **P0-E: Page Template Wrappers & Guidelines** | Create the 5 reusable layout shells in `frontend/design-system/layouts/` (`DashboardTemplate`, `ListingTemplate`, `QuizTemplate`, `ConfigurationTemplate`, `AnalyticsTemplate`) + copy approved spec into `frontend/design-system/guidelines/`. | `design-system/layouts/*`, `design-system/guidelines/*` | Typecheck + smoke tests before starting **P1 (`Home` / `Dashboard` / `Play`)**. |

---

## 4. P1–P5 Sequence Summary (One Route Group per PR)

- **P1 (Home, Dashboard & Play Hub)**: `/` (`HomeClient`), `/dashboard` (consolidate `/dashboard/overview`), `/play`.
- **P2 (Subject Hubs & Listings)**: `/mathematics`, `/reasoning`, `/general-awareness` (+ ranked topics), `/english` (merge `english.module.css` into unified Listing template), `formula-notes`, `/mock-test` + `/mock-test/[examSlug]`, `/notifications`, `/resource`.
- **P3 (Quiz, Mock Test & Training)**: `features/quiz/` (`QuizEngine`, `SubjectTopicStyles`, start/active views, remove `SubjectTopicStyles` `<style jsx>` & `36px` `.sg-back`), English `study-mode` (`bg-[#181613]` → dark tokens), `/mock-test/[examSlug]/[testId]/*`, `/play/setup/[mode]`, `/play/session/[id]`.
- **P4 (Battle, Results & Chat)**: `/battle` + `/battle/{leaderboard,missions,profile,social,rewards}`, `/mock-test/.../{result,review}/*`, `/ai-chat`.
- **P5 (Profile, Auth, Admin & Final CSS Purge)**: `/profile`, `(auth)/*`, `(admin)/*`, remove remaining `100vh`/`min-h-screen` & legacy stylesheets/bridges (`dark-theme.css`/`light-theme.css` deprecated aliases), run full Playwright 5-viewport visual + A11y + Lighthouse sweep.

---

## 5. Automated Verification & Governance Controls (Phase 5 & 6 Preview)

1. **Extended Playwright Viewports**: Expand `playwright.config.ts` to cover `360×800`, `393×852`, `430×932`, `768×1024`, and `1440×900` in **both Dark & Light modes**.
2. **Automated Structural Checks**: Fail PRs on `scrollWidth > innerWidth` (horizontal overflow), missing `BottomNav` / `AppHeader` visibility per `shell-policy.ts`, interactive touch target `< 44×44px` on mobile, visible text contrast `< 4.5:1`, focus-visible suppression, or `100vh` / `min-h-screen` reintroduction.
3. **Performance Guardrails**: Retain existing targets (`Lighthouse >= 0.90`, `LCP <= 2.5s`, `CLS <= 0.10`, `TBT <= 200ms`) alongside `npm run check:performance`.
4. **Governance**: Maintain `design-system/DESIGN_SYSTEM_CHANGELOG.md` for intentional token/component updates; every new page PR must declare its Template (`A`–`E`) and pass `npm run check` + visual diff review.
