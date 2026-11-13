# Responsive & Viewport Audit (Phase 0 Baseline)

Generated: 2026-11-13
Target Viewports (Phase 5 Requirement): `360x800` (Small Android), `393x852` (Standard Android), `430x932` (Large Mobile), `768x1024` (Tablet), `1440x900` (Desktop).
Reference Policy: `frontend/design.md` bans `100vh`/`min-h-screen` and mobile flex-centering, enforces `44px` minimum controls and single-shell fixed chrome via `globals.css`/`interface.css`, and locks `BottomNav` visibility via `lib/shell-policy.ts`.

---

## 1. Breakpoint Fragmentation Across CSS Files

Static analysis found **over 25 distinct width/interaction `@media` queries** with no shared breakpoint token system and off-by-one cutoffs between mobile, tablet, and desktop layouts:

| Breakpoint Query | Occurrences | Files | Notes / Conflicts |
|---|---:|---:|---|
| `max-width: 767px` (+ no-space variant) | 36 | 29 | Primary mobile cutoff in `dark-theme.css` & feature CSS |
| `min-width: 768px` (+ no-space variant) | 16 | 13 | Primary tablet/desktop expansion cutoff |
| `max-width: 600px` (+ no-space) / `min-width: 600px` | 11 | 6 | `globals.css`, `play-hub.css`, `exam-mode.module.css`, `battle.css`, `setup.css` |
| `min-width: 640px` / `max-width: 640px` | 18 | 7 | Tailwind `sm` overlap mixed with CSS custom media |
| `max-width: 360px` / `max-width: 359px` / `max-width: 340px` | 16 | 14 | Narrow-phone overrides (`340px`/`359px`/`360px` vs Phase 5 `360x800`) |
| `max-width: 1024px` / `min-width: 1024px` | 12 | 11 | Desktop rail/nav & `light-theme.css` / `dark-theme.css` mobile dock |
| `max-width: 900px` / `min-width: 900px` | 10 | 6 | Ad-hoc mid-tablet cutoff |
| `max-width: 480px` / `max-width: 400px` / `max-width: 380px` / `max-width: 420px` | 13 | 12 | Arbitrary small-phone steps |
| `max-width: 1023px` | 5 | 4 | Off-by-1 vs `1024px` |
| `max-width: 639.98px` / `max-width: 639px` / `max-width: 599px` / `max-width: 540px` | 5 | 5 | Arbitrary intermediate cutoffs |
| `min-width: 1025px` | 2 | 1 | `globals.css` hides `.bottom-pill-nav` at `>= 1025px` while `dark-theme.css`/`light-theme.css` scope mobile dock styling to `<= 1024px` |
| `max-width: 1050px` / `1100px` / `1200px` / `1250px` / `1300px` | 5 | 5 | Ad-hoc wide-desktop thresholds |
| `prefers-reduced-motion: reduce` (+ no-space) | 48 | 36 | Good adoption overall, duplicated per-file despite `interface.css` global reset |
| `hover: hover` / `pointer: fine` / `max-height: 560px` | 24 | 13 | Hover-capable / short-viewport guards |

### Off-by-One & Mobile-Only Token Bugs
1. **Nav visibility vs styling cutoff**: `globals.css` hides `.bottom-pill-nav` at `@media (min-width: 1025px)`, whereas `dark-theme.css` / `light-theme.css` style the bottom pill dock inside `@media (max-width: 1024px)` and other sheets switch desktop grids at `768px`, `900px`, or `1024px`.
2. **Mobile-only dark palette shift (`dark-theme.css` L245–271)**: Inside `@media (max-width: 767px)`, `dark-theme.css` redefines `--dark-text: #e5eaf0`, `--dark-text-secondary: #a2a9b4`, `--dark-text-muted: #929aa6`, and `--dark-border: #38383c`, causing dark text contrast and border appearance to change abruptly between `767px` and `768px` instead of using one token palette.

---

## 2. `100vh` & `min-h-screen` Violations (Forbidden by `frontend/design.md`)

`frontend/design.md` Rule #1 explicitly forbids `100vh` and `min-h-screen` because mobile browser chrome clips the bottom area and breaks fixed header/dock spacing. Despite this rule, **`27` CSS declarations and `5` TSX occurrences remain**:

### CSS Viewport-Height Usages (`27` occurrences across `10` CSS files)
| File | Match(es) | Count |
|---|---|---:|
| `app/(app)/english/english.module.css` | `100vh` | 5 |
| `app/(app)/page.module.css` | `100vh` | 4 |
| `app/globals.css` | `100vh` (2x, incl. `html.home-redesign { height: 100vh !important; }`), `55vh`, `70vh` | 4 |
| `features/quiz/components/ui/SeriesStartViews.module.css` | `100vh` (3x), `86vh` (1x) | 4 |
| `components/QuestionImage.module.css` | `42vh`, `38vh`, `82vh`, `76vh` | 4 |
| `app/(app)/ai-chat/AiChat.module.css` | `90vh` | 2 |
| `features/quiz/components/views/QuizStartView.module.css` | `100vh` | 1 |
| `app/(app)/english/idioms-phrases/study-mode/page.module.css` | `85vh` | 1 |
| `components/UserProfileMenu.module.css` | `90vh` | 1 |
| `app/(admin)/admin/notifications/AdminNotificationsPage.module.css` | `60vh` | 1 |

### TSX Viewport-Height Usages (`5` occurrences across `3` TSX files)
- `app/(app)/preview-palette/page.tsx`: `100vh` (2x)
- `components/ConvexAuthDiagnostics.tsx`: `min-h-screen` (2x)
- `features/quiz/components/ui/QuestionPalette.tsx`: `100vh` (1x)

---

## 3. Runtime Mobile vs. Desktop Branching & Hydration Risks

`15` client hooks/components branch layout or interaction behaviour at runtime instead of pure responsive CSS (`useMediaQuery.ts`, `useVirtualKeyboard.ts`, `lib/motion.ts`, `useQuestionSwipe.ts`):
- Page/feature consumers:
  - `app/(app)/HomeClient.tsx`
  - `app/(app)/MobileHeroCarousel.client.tsx`
  - `app/(app)/ai-chat/page.tsx`
  - `app/(app)/general-awareness/_shared/ranked-topic-group-page.tsx`
  - `app/(app)/mock-test/_shared/MockTestEngine.tsx`
  - `components/SelectionPopover.tsx`
  - `components/subject-hub/SubjectHub.tsx` (switches between `SubjectHubMobile` and `SubjectHubDesktop`)
  - `components/training/TrainingFilterPicker.tsx`
  - `components/training/TrainingSessionView.tsx`
  - `features/quiz/components/ui/IosExamPicker.tsx`
  - `features/quiz/hooks/useQuizPresentation.tsx`
- Because `useMediaQuery.ts` initializes `false` on SSR/first render and updates after mount, pages switching between separate mobile and desktop trees (e.g., `SubjectHub`, `QuizEngine`, `HomeClient`) risk first-paint layout shift (CLS) on mobile/tablet viewports.

---

## 4. Mobile Touch Target, Input Zoom & Navigation Shell Gaps

- **Touch target below `44px` minimum**: `features/quiz/components/SubjectTopicStyles.tsx` sets `.sg-back { width: 36px !important; }` (violating `interface.css` `--ui-control-height: 44px`).
- **iOS input zoom guard**: `interface.css` enforces `font-size: max(16px, 1em) !important` on mobile inputs/selects globally, which helps prevent iOS Safari zoom but overrides author compact input sizes unexpectedly if containers don't accommodate `16px`.
- **Safe-area token adoption**: `--safe-top` (`107x`, `38` files), `--safe-bottom` (`100x`, `43` files), `--safe-left` (`93x`), `--safe-right` (`90x`) are well-established in shell/quiz views, but older modules and admin pages bypass them.
- **Navigation shell policy gaps (`frontend/lib/shell-policy.ts`)**: `BottomNav` suppresses chrome on specific full-screen quiz/auth paths, but omits `/battle/rewards` and two English study-mode sub-routes (`/english/homonyms-homophones/study-mode`, `/english/spelling-misspelled-words/study-mode`), causing inconsistent mobile footer visibility within the same feature families.

---

## 5. Automated Viewport Testing Gap (`playwright.config.ts`)

- Current Playwright projects cover **only 2 viewports**:
  - `desktop`: `1366 x 900`
  - `mobile`: `390 x 844`
- **Untested Phase 5 target viewports**:
  - Small Android (`360 x 800`) — matches several ad-hoc `max-width: 360px` / `359px` CSS overrides that are currently unverified visually.
  - Standard Android (`393 x 852`)
  - Large Mobile (`430 x 932`)
  - Tablet (`768 x 1024`) — critical because it sits directly on top of the `767px` / `768px` breakpoint split and under the `1025px` bottom-nav cutoff.
  - Full Desktop (`1440 x 900`)

---

## 6. Baseline Screenshot Capture & Existing Contract Checks

- **Fresh Baseline Capture (`design-audit/baseline-screenshots/`)**:
  - Command: `npx playwright test e2e/all-routes-screenshots.spec.ts --reporter=list,json` with `SCREENSHOT_THEME=dark` across `desktop` (`1366 x 900`) and `mobile` (`390 x 844`).
  - Result: **`162` passed (`81` desktop + `81` mobile PNGs captured, `0` failures), `8` skipped** (`desktop` and `mobile` for the 4 IIT JAM `/subjects/[subject]/[topic]*` routes; dev-only `/dev/convex-auth` is excluded from the 85-route capture list).
  - Full run report archived at `design-audit/baseline-screenshots/capture-report.json`.
- **Existing Static Interface Contract (`npm run check:interface --workspace frontend`)**:
  - Ran `check-interface.mjs`, `check-ui-contract.mjs`, and `check-light-theme.mjs`: exited `0` (verified light & dark styles across `320px`, `390px`, `768px`, `1366px`, `1440px` and `383` interface files, though it does not enforce unified colour tokens, Tailwind `@theme`, or rule-block deduplication).
