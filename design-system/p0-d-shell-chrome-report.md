# PR P0-D Verification Report — Global Shell Chrome (`AppHeader`, `BackButton`, `BottomNav`, `NavRail`, `shell-policy`)

**Date:** 2026-11-13  
**Scope:** Phase 2 **PR P0-D** — `shell-policy` coverage fixes, `.bottom-pill-nav` CSS consolidation and `1024px` breakpoint alignment, canonical `44×44px` `BackButton`, and canonical `AppHeader` & `NavRail` patterns (strictly stopping before `P0-E` and `P1–P5`).

---

## 1. Deliverables Implemented

### 1.1 Shell Policy Corrections (`shell-policy.ts`)
- [shell-policy.ts](file:///c:/Users/91906/Ai%20ssc/frontend/lib/shell-policy.ts)
- [shell-policy.test.ts](file:///c:/Users/91906/Ai%20ssc/frontend/lib/shell-policy.test.ts)
  - Replaced the static `/battle/*` route array check with `if (within("/battle")) return true;`, hiding `BottomNav` across `/battle` sub-routes including `/battle/rewards`.
  - Replaced the hardcoded 3-topic study-mode list with `/^\/english\/[^/]+\/study-mode(?:\/|$)/.test(path)`, hiding `BottomNav` on all 5 `/english/<topic>/study-mode` (and `/study-mode/quiz`) routes while preserving primary bottom navigation on topic landing pages such as `/english/homonyms-homophones` and `/english/synonyms-antonyms`.

### 1.2 Consolidated `BottomNav` Pattern & `1024px` Breakpoint Alignment
- [nav-items.ts](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/patterns/nav-items.ts) (`PRIMARY_NAV_ITEMS`, `isPrimaryNavItemActive`)
- [BottomNav.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/patterns/BottomNav.tsx)
- [BottomNav.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/patterns/BottomNav.module.css)
- [BottomNav.tsx (app wrapper)](file:///c:/Users/91906/Ai%20ssc/frontend/components/BottomNav.tsx)
- [BottomNav.test.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/components/__tests__/BottomNav.test.tsx)
  - Consolidated legacy `.bottom-pill-nav` rules out of [globals.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/globals.css), [dark-theme.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/dark-theme.css), [light-theme.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/light-theme.css), and [interface.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/interface.css) into `BottomNav.module.css`.
  - Uses semantic tokens (`--meow-surface` `#111722` / `#FFFFFF`, hairline `--meow-border`, active `--meow-accent-soft` + `--meow-accent-light` / `--meow-action-fill`, `12px` `--meow-text-xs` labels), removes `backdrop-filter: blur(...)`, pulse keyframes, and decorative iOS home-indicator lines, and respects `prefers-reduced-motion`.
  - Kept `@/components/BottomNav` as a lean app-connected wrapper importing directly from `@/design-system/patterns/BottomNav` (preserving `useAuth`, `GoogleAvatarRing`, `useKeyboardOpen`, `body.has-bottom-nav`, and ResizeObserver/resize measurement of `--app-bottom-nav-occupied-height` without bloating the `/(app)/page` bundle).
  - Aligned responsive breakpoint strictly at `1024px` across [globals.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/globals.css) (`@media (min-width: 1024px)`), [play-hub.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/(app)/play/play-hub.css) (`@media (max-width: 1023px)`), and [setup.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/(app)/play/setup/%5Bmode%5D/setup.css) (`@media (max-width: 1023px)`), fixing the `1024px`/`1025px` mismatch.

### 1.3 Canonical `44×44px` `BackButton` & Specificity Preservation
- [BackButton.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/BackButton.tsx) & [BackButton.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/BackButton.module.css)
- [BackButton.tsx (app re-export)](file:///c:/Users/91906/Ai%20ssc/frontend/components/BackButton.tsx)
- [Button.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Button.tsx) & [Button.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Button.module.css)
- [ExamLandingPage.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/(app)/mock-test/_shared/ExamLandingPage.module.css)
  - Standardized `BackButton` atop `<Button variant="ghost" size="icon">` + `useAppNavigation().back(href)` with enforced `44×44px` hit target and `--meow-text` foreground (`[data-meow-component="back-button"]`), updating `{...rest}` order in `Button.tsx` so `data-meow-component="back-button"` is preserved.
  - Upgraded `.mobileBackBtn` in `ExamLandingPage.module.css` from `36px` to `44px`.
  - Wrapped `display: inline-flex` rules in `Button.module.css` and `interface.css` inside `:where(...)` so responsive hiding rules such as `.mobileBackBtn { display: none; }` (`>= 768px`) still win regardless of stylesheet order.
  - Wrapped `interface.css` header/footer opt-out exclusions (`[data-ui-chrome="header"]:where(:not([data-meow-component="app-header"]))` and `[data-ui-chrome="footer"]:where(:not(.bottom-pill-nav):not([data-meow-component="bottom-nav"]))`) in `:where(...)` so existing route CSS module rules (`MockTestEngine.module.css`, `mock-test/page.module.css`, `AuthCard`, `admincontrol`) keep exact `(0, 1, 0)` cascade precedence.

### 1.4 Canonical `AppHeader` & `NavRail` Patterns
- [AppHeader.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/patterns/AppHeader.tsx) & [AppHeader.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/patterns/AppHeader.module.css) (`56px` + `--safe-top` default / `48px` + `--safe-top` compact height, crisp `--meow-surface` + hairline `--meow-border`, zero blur)
- [NavRail.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/patterns/NavRail.tsx) & [NavRail.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/patterns/NavRail.module.css) (`>= 1024px` visible, `<= 1023px` hidden, `228px` expanded / `72px` collapsed)
- [patterns/index.ts](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/patterns/index.ts) & [design-system/index.ts](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/index.ts) (global `(app)/layout.tsx` remains untouched; `NavRail` integration deferred to layout/route migration phases)
- [shell-chrome.test.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/shell-chrome.test.tsx)
- [p0d-shell-chrome.spec.ts](file:///c:/Users/91906/Ai%20ssc/frontend/e2e/p0d-shell-chrome.spec.ts)

---

## 2. Automated Verification Results (Post-Final Edit)

All checks below ran cleanly after the final workspace edit (`design-system/shell-chrome.test.tsx` / `interface.css`):

| Check | Command / Harness | Result |
|---|---|---|
| TypeScript | `npm run typecheck` (`npm run check --workspace frontend`) | **Passed** (`0` errors) |
| Vitest Full Suite | `npm run test:run` (`npm run check --workspace frontend`) | **154 / 154** files, **986 / 986** tests passed |
| ESLint | `npm run lint` (`eslint --max-warnings 0`) | **Passed** (`0` warnings) |
| Interface & UI Contracts | `npm run check:interface --workspace frontend` | **Passed** across `320px`, `390px`, `768px`, `1366px`, `1440px` light/dark viewports & `383` interface files |
| Production Build | `npm run build --workspace frontend` | **Passed** (`Next.js 16.4.2 Turbopack`, `819/819` static pages) |
| Performance Budget | `npm run check:performance --workspace frontend` | **Passed** — `/(app)/page`: `165,281 / 180,000` gzip bytes (`286` bytes smaller than P0-B/P0-C baseline `165,567` B); `/(app)/battle/page`: `156,666 / 215,000`; `/(admin)/admin/upload/question/page`: `153,121 / 180,000` |
| Playwright Functional E2E | `e2e/p0d-shell-chrome.spec.ts`, `navigation.spec.ts`, `web-guidelines.spec.ts`, `mock-flow-navigation.spec.ts`, `architecture.spec.ts`, `mobile-quiz-design.spec.ts`, `iit-jam-mode.spec.ts`, `training-play.spec.ts` | **30 passed, 30 skipped** (project viewport filters & optional Mongo fixture test `iit-jam-mode.spec.ts:98`), `0 failed` |
| Isolated Chromium Matrix | `scratch/verify-p0d-isolated.mjs` | **Passed** — Dark (`1024px` desktop, `393px` mobile) & Light (`1440px` desktop, `360px` mobile): `overflowX: 0`, `headerHeight: 56px`, `headerBlur: "none"`, `headerTitleContrast: 16.28` dark / `17.74` light, `backBtnBox: 44×44`, `backBtnContrast: 16.28` dark / `17.74` light, `railVisible: true` at `>= 1024px` / `false` at `<= 393px`, `bottomVisible: false` at `>= 1024px` / `true` at `<= 393px`, nav item contrast `6.11` / `6.50` dark & `6.16` / `7.54` light |

---

## 3. Visual Screenshot Verification (vs Permanent P0-A Baselines)

Captured `158` expected routes (`8` dynamic parameterized templates skipped as expected, `0` unexpected, `0` flaky) across Dark (`285.4s`) and Light (`288.8s`) modes via `e2e/all-routes-screenshots.spec.ts`, then compared against `post-p0a-dark` and `post-p0a-light` (`compare-screenshots.mjs`):

- **Dark Mode (`158` paired):** **`111` exact byte-identical**, `47` non-zero diffs, `4` missing (exact 4 dev routes production-gated in P0-C: `desktop`/`mobile` `glass-test` and `preview-palette`), `0` extra:
  - **`3` mobile `shell-policy` fixes:** `mobile/battle__rewards` (`18.04%`, `dimMismatch: true`), `mobile/english__homonyms-homophones__study-mode` (`19.25%`, `dimMismatch: true`), `mobile/english__spelling-misspelled-words__study-mode` (`19.32%`, `dimMismatch: true`) where `BottomNav` is now hidden cleanly.
  - **`16` mobile primary-nav routes (`8.23%–9.54%`, `dimMismatch: false`):** Intentional `BottomNav` redesign (`mobile/` `home`, `mock-test`, `play`, `profile`, `adaptive-quiz`, `english`, `english/synonyms-antonyms`, `general-awareness`, `general-awareness/ancient-history`, `general-awareness/ancient-history/jainism-buddhism`, `mathematics`, `mathematics/advance/algebra`, `mathematics/algebra`, `mathematics/arithmetic/percentages`, `reasoning`, `reasoning/analogy`).
  - **`7` `BackButton` routes (`70 px` exact `13×13` arrow delta inside `44×44` target):** `desktop/` + `mobile/` `english/one-word-substitution/study-mode/quiz`, `mock-test/ssc-cgl/browser-test`, `mock-test/ssc-cgl/browser-test/attempt`, and `mobile/mock-test/ssc-cgl` (`desktop/mock-test/ssc-cgl` remains byte-identical with `.mobileBackBtn` hidden).
  - **`21` minor dynamic / `<= 198 px` anti-aliasing diffs:** `desktop/ai-chat` (`96 px` = `BackButton` delta + 26px chat AA), `mobile/ai-chat` (`145 px`), `desktop/play/session/[uuid]` (`93 px`), and `3–198 px` (`maxChannelDiff <= 15`) micro anti-aliasing across subject hubs, formula-notes, and battle sub-pages.
- **Light Mode (`158` paired):** **`118` exact byte-identical**, `40` non-zero diffs, `4` missing (same 4 gated dev routes), `0` extra:
  - **`3` mobile `shell-policy` fixes:** `mobile/battle__rewards` (`8.65%`), `mobile/english__homonyms-homophones__study-mode` (`19.18%`), `mobile/english__spelling-misspelled-words__study-mode` (`19.24%`).
  - **`16` mobile primary-nav routes (`5.93%–9.54%`, `dimMismatch: false`):** Same 16 mobile primary-nav routes as Dark Mode.
  - **`8` `BackButton` routes (`70 px` exact):** Same 7 routes as Dark Mode plus `desktop/ai-chat` (`70 px`).
  - **`13` minor dynamic / anti-aliasing diffs:** `mobile/ai-chat` (`150 px`), `desktop/home` (`239 px`, rotating hero text), and `3–106 px` (`maxChannelDiff <= 2`) micro anti-aliasing across formula-notes, battle tabs, and mathematics hub.
- **Cross-check vs P0-C (`p0d-vs-p0c-dark.json` / `p0d-vs-p0c-light.json`):** `110` Dark / `111` Light byte-identical out of `158` paired (`0` missing, `0` extra), confirming zero unintended header, footer, or card shifts on untouched routes.

---

## 4. Deferred Legacy Shell Dependencies (Targeted in P0-E / P1–P5)

- `[data-meow-tokens]` remains opt-in on new primitives and shell patterns; existing route headers (`[data-ui-chrome="header"]`), route footers (`[data-ui-chrome="footer"]`), and `(app)/layout.tsx` (`NavRail` shell adoption) remain on legacy styling until per-route migrations in Phases 1–5.
- Inline route `.bottom-nav-*` / `--app-bottom-nav-occupied-height` spacing overrides inside feature CSS modules remain compatible and will be simplified during route migrations.
- Remaining workspace check: `git diff --check` exited `0` (with trailing EOF blank-line notices on `frontend/app/light-theme.css:108` and `frontend/components/BackButton.tsx:5`).

---

## 5. Stop Point & Next Step Acceptance Checklist

- [x] `shell-policy.ts` hides `BottomNav` on `/battle/rewards` and all 5 `/english/<topic>/study-mode` routes.
- [x] `.bottom-pill-nav` consolidated into `BottomNav.module.css`; desktop `>= 1024px` / mobile `< 1024px` breakpoint aligned across `globals.css`, `play-hub.css`, and `setup.css`.
- [x] `BackButton` enforced at `44×44px` (`ExamLandingPage.module.css` `.mobileBackBtn` upgraded from `36px` to `44px`) with `:where(...)` specificity preservation.
- [x] `AppHeader` (`56px` / `48px` compact + safe top) and `NavRail` (`228px` / `72px`, `>= 1024px`) exported cleanly from `@/design-system`.
- [x] Full Vitest (`986/986`), TypeScript, ESLint (`0` warnings), `check:interface`, `next build` (`819/819`), `check:performance` (`165,281` B), Playwright E2E, isolated Chromium contrast/geometry, and Dark/Light visual diffs passed after final edit.

**PR P0-D** is complete and verified. Implementation pauses here pending user review before **PR P0-E**.
