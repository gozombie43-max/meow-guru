# PR P0-B — Core Primitives (`Button`, `Card`, `Badge`, `Spinner`, `Toast` / `FeedbackToast`) Implementation & Verification Report

**Status:** Complete & Verified (awaiting PR review; **P0-C** not started)
**Prerequisite Baseline:** Approved `P0-A` token architecture (`theme.css`, `legacy-bridge.css`, `motion.css`) and permanent pre-change baselines in [design-audit/baseline-screenshots](file:///c:/Users/91906/Ai%20ssc/design-audit/baseline-screenshots) (Dark) and [design-audit/baseline-screenshots-light](file:///c:/Users/91906/Ai%20ssc/design-audit/baseline-screenshots-light) (Light).

---

## 1. Files Changed

### Created Primitives, Tests, and Exports
| File | Purpose |
| --- | --- |
| [Spinner.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Spinner.module.css) | Token-backed spinner sizing (`--meow-icon-sm/md/lg`), tones (`inherit`, `accent`, `secondary`, `on-accent`), `meow-spin` keyframe animation, and `prefers-reduced-motion` clamp (`0.01ms`) |
| [Spinner.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Spinner.tsx) | Standardized SVG ring spinner with standalone accessible `role="status"` / `aria-live="polite"` mode (`label`) vs decorative embedded mode (`aria-hidden="true"`) |
| [Button.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Button.module.css) | Canonical `--meow-action-fill` (`#2563EB`), `--meow-surface`, `--meow-secondary`, `--meow-danger-fill`, desktop-only `sm` compaction (`>= 1024px` + `pointer: fine`), clean focus ring (`2px solid var(--meow-accent)`, offset `2px`), and scoped `--ui-*` variables |
| [Button.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Button.tsx) | `forwardRef` button primitive (`primary`, `secondary`, `ghost`, `destructive` solid/subtle; `sm`, `md`, `lg`, `icon`; `loading` width preservation + `aria-busy`; `leftIcon`/`rightIcon`; `fullWidth`; default `type="button"`) |
| [Card.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Card.module.css) | Flat `--meow-surface` + `1px solid var(--meow-border)` card with `backdrop-filter: none`, `--meow-shadow-none`, `4` variants, `4` padding sizes, `--ui-control-radius: var(--meow-radius-lg)`, and `font-weight: 400 !important` override on native interactive buttons |
| [Card.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Card.tsx) | Discriminated container primitive (`div`/`section`/`article`/`aside`/`li`/`header`/`footer`) switching cleanly to native `<button type="button" data-ui-button="state" data-custom-focus="true">` when interactive |
| [Badge.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Badge.module.css) | Pill status/category badges backed by semantic `-soft` surfaces and `--meow-secondary` (`neutral`) |
| [Badge.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Badge.tsx) | `Badge` (`neutral`, `accent`, `success`, `warning`, `error`, `info`; `sm`/`md`; optional decorative `icon`) |
| [Toast.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Toast.module.css) | Accessible bottom-right live region respecting `--meow-bottom-nav-h` & safe-area bottom insets, `--meow-z-toast` (`100`), `--meow-surface`, `--meow-text`, `--meow-font-sans`, `--meow-shadow-overlay`, and `meow-toast-in` reduced-motion clamping |
| [Toast.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Toast.tsx) | `ToastRegion` (`aria-live="polite"`, `aria-atomic="true"`) and `Toast` (`role="status"`, `success`/`error`/`info`/`warning` indicator dot + border accent) |
| [components/index.ts](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/index.ts) | Component and TypeScript prop/variant barrel exports |
| [design-system/index.ts](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/index.ts) | Root `frontend/design-system` barrel re-export |
| [primitives.test.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/primitives.test.tsx) | 10 unit, DOM, ARIA, timer, and CSS contract tests covering all 5 primitives + `FeedbackToast` |

### Modified Existing Files
| File | Diff Summary | Change Details |
| --- | --- | --- |
| [FeedbackToast.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/components/FeedbackToast.tsx) | `+14 / -4` | Migrated to render `<ToastRegion className="feedback-toast-region">` + `<Toast tone={tone} message={feedback.message} data-feedback-toast={tone} />`; preserved `'app-feedback'` window event listener, `3200ms` auto-dismiss timer, and cleanup |
| [globals.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/globals.css#L329-L366) | `+23 / -10` (`37` ins / `14` del total across both files) | Removed `'Nunito Sans'` from `.feedback-toast`; aligned `.feedback-toast-region` / `.feedback-toast` tokens to `--meow-font-sans`, `--meow-surface`, `--meow-text`, `--meow-z-toast`, `--meow-radius-md`, `--meow-duration-base`, semantic `color-mix` borders, and reduced motion |

No other application, token (`P0-A`), or baseline files were modified. `[data-meow-tokens]` remains strictly opt-in and is **not** enabled globally.

---

## 2. Component & Route Migration Details

### Primitive Architecture & Legacy Safeguards
1. **Isolated Opt-In Tokenization:**
   - [Button.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Button.tsx) stamps `data-ui-button` (`primary` | `secondary` | `danger` | `icon` | `state`), optional `data-ui-shape="icon"`, and `data-custom-focus="true"` so `check:interface` (`scripts/check-interface.mjs`, `scripts/check-ui-contract.mjs`, `scripts/check-light-theme.mjs`) contract checks pass while unmigrated legacy `<button data-ui-button="primary">` controls keep their existing `#0A84FF` / `#007AFF` appearance until migrated in `P1–P5`.
   - Scoping `--ui-*` variables directly on `.button` in [Button.module.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Button.module.css#L1-L14) prevents global variable leakage onto existing pages.
2. **Primary CTA Contrast Correction (`#2563EB`):**
   - `Button variant="primary"` binds `background-color: var(--meow-action-fill)` (`#2563EB`) and `color: var(--meow-on-accent)` (`#FFFFFF`), keeping `--meow-accent` (`#3B82F6`) dedicated to highlights, icons, and `2px` focus outlines (`outline: 2px solid var(--meow-accent)` with `outline-offset: 2px`).
3. **Loading Width Stability & Responsive Touch Sizing:**
   - Loading buttons disable interaction (`disabled`, `aria-busy="true"`), hide `.content` visually (`visibility: hidden; opacity: 0`) so the button retains its exact label width (`127.84375px` idle vs `127.84375px` loading), and overlay `<Spinner aria-hidden="true" />`.
   - `size="sm"` maintains `44px` minimum touch target height on mobile / coarse pointers (`min-height: var(--ui-control-height)`) and compacts to `36px` (`--meow-control-h-sm`) only inside `@media (min-width: 1024px) and (pointer: fine)` using `button.sizeSm[data-ui-button]`.
4. **Card Surface Discipline & Interactive Mode:**
   - [Card.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/components/Card.tsx) enforces flat elevation (`backdrop-filter: none`, `box-shadow: var(--meow-shadow-none)`) and avoids `#687386` for readable copy (`--meow-secondary` `#929CAF` / `#4B5565`). Interactive cards render `<button type="button" data-ui-button="state" data-custom-focus="true">` with `--ui-control-radius: var(--meow-radius-lg)` (`16px`) and `button.interactiveButton { font-weight: 400 !important; }`.
5. **`FeedbackToast` Route Scope (Intentional UI Normalization):**
   - [FeedbackToast.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/components/FeedbackToast.tsx) is mounted globally inside [app/(app)/layout.tsx](file:///c:/Users/91906/Ai%20ssc/frontend/app/(app)/layout.tsx#L3-L14).
   - When no feedback event is active, `FeedbackToast` renders `null` (0 visual impact on idle routes). When an `'app-feedback'` event fires, it renders `<ToastRegion>` + `<Toast>`, replacing the legacy `.feedback-toast` `'Nunito Sans'` stack and old card tint with `--meow-font-sans`, `--meow-surface` (`#111722` dark / `#FFFFFF` light), `--meow-text` (`#F1F4F8` dark / `#111827` light), and semantic indicator accents (`success`, `error`, `info`, `warning`).

---

## 3. Verification & Test Results

All checks ran cleanly **after the final application edit** (`app/globals.css`, `components/FeedbackToast.tsx`, `frontend/design-system/components/*`):

| Verification Suite | Scope | Result |
| --- | --- | --- |
| TypeScript (`npm run typecheck --workspace frontend`) | `tsc --noEmit` across entire frontend | **Passed** (`0` errors) |
| Unit & Component Tests (`npm run test:run --workspace frontend`) | Full Vitest suite including `design-system/components/primitives.test.tsx` (`10` tests) & `tokens.test.ts` (`6` tests) | **Passed** (`151 / 151` files, `946 / 946` tests) |
| ESLint (`npm run lint --workspace frontend`) | `eslint --max-warnings 0` | **Passed** (`0` errors, `0` warnings) |
| Interface & Light-Theme Contracts (`npm run check:interface --workspace frontend`) | `320px`, `390px`, `768px`, `1366px`, `1440px` (Light/Dark), safe-areas `0/24/34/48px`, `383` interface files | **Passed** |
| Production Build (`npm run build --workspace frontend`) | Next.js `16.4.2` (Turbopack) | **Passed** (`819 / 819` static/dynamic outputs built) |
| Performance Budget (`npm run check:performance --workspace frontend`) | Bundle gzip budgets (e.g., `/(app)/page`: `165,567 / 180,000` B; `/(app)/battle/page`: `156,952 / 215,000` B) | **Passed** (`10 / 10` routes under budget) |
| Playwright Targeted E2E (`web-guidelines`, `architecture`, `mobile-quiz-design`, `navigation`) | Theme switching, skip links, focus containment, palette scroll/reachability, history Back navigation | **Passed** (`18` passed, `16` viewport-skipped per project filter, `0` failed) |
| Isolated Dark/Light Primitive Showcase (`verify-p0b-isolated.mjs`) | Compiled TSX + CSS modules against real `theme.css` / `interface.css` / `dark-theme.css` / `light-theme.css` | **Passed** (Dark & Light contrasts `>= 4.76:1`, exact widths/heights, legacy button untouched) |
| Live `<FeedbackToast />` Verification (`verify-p0b-live-toast.mjs`) | Real production server on `127.0.0.1:3110` + fixture backend `3111`, `/` in Dark & Light (desktop + mobile) | **Passed** (`0` page errors, `16.28:1` dark / `17.74:1` light contrast, zero `Nunito Sans`, auto-dismiss after `3200ms`) |
| Full-Catalog Dark Route Capture (`SCREENSHOT_THEME=dark`) | `all-routes-screenshots.spec.ts` | **Passed** (`162` PNGs captured, `8` excluded/dynamic skips, `0` unexpected) |
| Full-Catalog Light Route Capture (`SCREENSHOT_THEME=light`) | `all-routes-screenshots.spec.ts` | **Passed** (`162` PNGs captured, `8` excluded/dynamic skips, `0` unexpected) |

*(Note: During the first Light route capture attempt in `task-668`, `mongodb-memory-server` hit Windows disk exhaustion (`436,002,816` bytes free vs WiredTiger `524,288,000` byte minimum) due to 16 orphaned `%TEMP%\mongo-mem-*` directories from prior runs. Removing those temp directories freed `3,438.43 MB`, after which the full Light capture passed cleanly `162 / 162`.)*

### Measured Runtime Contrast & Geometry (Isolated Primitive Showcase)
| Surface / Control | Dark Mode Ratio / Metric | Light Mode Ratio / Metric |
| --- | --- | --- |
| Primary `Button` (`#FFFFFF` on `#2563EB`) | **5.17 : 1** (`height: 44px` md) | **5.17 : 1** (`height: 44px` md) |
| Secondary `Button` (`--meow-text` on `--meow-surface`) | **16.28 : 1** | **17.74 : 1** |
| Ghost `Button` (`--meow-secondary` on `--meow-surface`) | **6.50 : 1** | **7.54 : 1** |
| Destructive Solid (`#FFFFFF` on `#DC2626`) | **4.83 : 1** | **4.83 : 1** |
| Destructive Subtle (`--meow-error` on `--meow-error-soft`) | **6.06 : 1** | **5.30 : 1** |
| Interactive `Card` helper (`--meow-secondary` on `--meow-surface`) | **6.50 : 1** | **7.54 : 1** |
| `Badge` variants (`neutral` / `accent` / `success` / `warning` / `error` / `info`) | **5.78 / 6.11 / 8.03 / 9.38 / 6.06 / 6.11 : 1** | **6.57 / 6.16 / 4.76 / 6.37 / 5.30 / 6.16 : 1** |
| `Toast` (all 4 tones) | **16.28 : 1** | **17.74 : 1** |
| Loading `Button` width stability (`idle` -> `loading`) | `127.84375px` -> `127.84375px` | `127.84375px` -> `127.84375px` |
| Desktop `sm` / `lg` heights (`1366x900`, `pointer: fine`) | `36px` / `48px` | `36px` / `48px` |
| Mobile `sm` / `md` / `icon` touch targets (`390x844`, `coarse`) | `44px` / `44px` / `44x44px` | `44px` / `44px` / `44x44px` |
| Unmigrated sibling `<button data-ui-button="primary">` | `rgb(10, 132, 255)` (unchanged) | `rgb(0, 122, 255)` (unchanged) |

---

## 4. Before / After & Visual Verification

### Primitive Showcase & Live `<FeedbackToast />` Captures
- **Isolated P0-B Primitive Showcase:** [p0b-isolated-dark.png](file:///C:/Users/91906/.gemini/antigravity/brain/958167c4-c4a5-43cd-81b7-3a862a9f1eba/scratch/p0b-isolated-dark.png) and [p0b-isolated-light.png](file:///C:/Users/91906/.gemini/antigravity/brain/958167c4-c4a5-43cd-81b7-3a862a9f1eba/scratch/p0b-isolated-light.png)
- **Live `<FeedbackToast />` on `/` (`127.0.0.1:3110`):**
  - Dark Desktop (`success` & `error`): [p0b-live-toast-dark-desktop.png](file:///C:/Users/91906/.gemini/antigravity/brain/958167c4-c4a5-43cd-81b7-3a862a9f1eba/scratch/p0b-live-toast-dark-desktop.png), [p0b-live-toast-error-dark-desktop.png](file:///C:/Users/91906/.gemini/antigravity/brain/958167c4-c4a5-43cd-81b7-3a862a9f1eba/scratch/p0b-live-toast-error-dark-desktop.png)
  - Dark Mobile (sits at `bottom: 760px` cleanly above BottomNav `top: 771px`): [p0b-live-toast-dark-mobile.png](file:///C:/Users/91906/.gemini/antigravity/brain/958167c4-c4a5-43cd-81b7-3a862a9f1eba/scratch/p0b-live-toast-dark-mobile.png)
  - Light Desktop & Mobile: [p0b-live-toast-light-desktop.png](file:///C:/Users/91906/.gemini/antigravity/brain/958167c4-c4a5-43cd-81b7-3a862a9f1eba/scratch/p0b-live-toast-light-desktop.png), [p0b-live-toast-light-mobile.png](file:///C:/Users/91906/.gemini/antigravity/brain/958167c4-c4a5-43cd-81b7-3a862a9f1eba/scratch/p0b-live-toast-light-mobile.png)
  - Full live measurement JSON: [p0b-live-toast-report.json](file:///C:/Users/91906/.gemini/antigravity/brain/958167c4-c4a5-43cd-81b7-3a862a9f1eba/scratch/p0b-live-toast-report.json)

### Baseline Screenshot Regression Comparisons (All 162 Dark + 162 Light Routes)
Compared post-P0-B captures directly against the untouched P0-A baselines:
- **Dark Mode** ([p0b-diff-summary-dark.json](file:///C:/Users/91906/.gemini/antigravity/brain/958167c4-c4a5-43cd-81b7-3a862a9f1eba/scratch/p0b-diff-summary-dark.json)):
  - Paired: `162 / 162` (`0` missing, `0` extra, `0` dimension mismatches)
  - Byte-identical: `134 / 162`
  - Minor non-zero diffs: `28 / 162` (largest diff: `desktop/home` at `916 / 1,229,400` px = `0.0745%` from the cycling hero subject word; `play/session` `0.0252%` / `0.0076%` from the `1s`/`2s` elapsed timer tick; remaining `<= 0.0179%` subpixel anti-aliasing on rounded thumbnails/formula icons)
- **Light Mode** ([p0b-diff-summary-light.json](file:///C:/Users/91906/.gemini/antigravity/brain/958167c4-c4a5-43cd-81b7-3a862a9f1eba/scratch/p0b-diff-summary-light.json)):
  - Paired: `162 / 162` (`0` missing, `0` extra, `0` dimension mismatches)
  - Byte-identical: `141 / 162`
  - Minor non-zero diffs: `21 / 162` (largest diff: `mobile/play__session__[uuid]` at `83 / 329,160` px = `0.0252%` timer tick; `desktop/home` at `0.0245%` hero cycle; remaining `<= 0.0181%` image/font anti-aliasing)

---

## 5. Remaining Compatibility Issues & Notes for Next PRs

1. **`interface.css` `[data-ui-button]` `!important` Specificity:** Legacy rules in [interface.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/interface.css) force `padding: 10px 16px !important`, `min-height: var(--ui-control-height) !important`, and `font-weight` onto `[data-ui-button]` attributes. For `P0-B`, `Button.module.css` uses `button.sizeSm[data-ui-button] { padding: 6px var(--meow-space-3) !important; }` on desktop fine pointers and `Card.module.css` uses `button.interactiveButton { font-weight: 400 !important; }` to override cleanly regardless of CSS chunk ordering. These compatibility overrides can be removed once `interface.css` `!important` button overrides are retired in `P0-D`/`P5`.
2. **Focus Ring Isolation via `data-custom-focus="true"`:** Both `Button` and interactive `Card` pass `data-custom-focus="true"` to opt out of `interface.css`'s global `:focus-visible` rule until legacy focus selectors are consolidated.
3. **Unmigrated Legacy Controls Preserved:** Existing feature buttons, `components/ui/Dialog.tsx`, form controls (`Input`/`Select`/`Textarea`), `Navbar`, and `BottomNav` remain intentionally untouched in `P0-B` (`P0-C` covers `Input`/`Select`/`Textarea` + dev-route gating, and `P0-D`/`P0-E` cover feedback dialogs and navigation shell components).
4. **Windows `mongo-mem-*` Temp Folder Accumulation:** Repeated `browser-fixture.js` harness runs create `mongo-mem-*` folders in `%TEMP%` (~200 MB each). Periodic cleanup prevents WiredTiger `OutOfDiskSpace` errors on constrained system drives.

---

## 6. Final P0-B Acceptance Checklist

- [x] **P0-A token architecture preserved:** `theme.css`, `legacy-bridge.css`, `motion.css`, `tokens.test.ts`, and `globals.css` `@import` header untouched.
- [x] **`[data-meow-tokens]` remains opt-in only:** Never globally enabled on `<html>` or `<body>`.
- [x] **Core primitives implemented:** `Button`, `Card`, `Badge`, `Spinner`, `Toast`, and `ToastRegion` implemented with TypeScript types and exported from `frontend/design-system`.
- [x] **WCAG contrast compliance verified:** Primary CTA `#2563EB` (`5.17:1`), `#687386` never used on body/helper text or badges, all dark & light primitive states `>= 4.76:1`.
- [x] **`FeedbackToast` migrated cleanly:** Typography unified to `--meow-font-sans` (`Nunito Sans` removed), wired to `--meow-surface` / `--meow-text` / `--meow-z-toast`, live dark & light rendering verified.
- [x] **Permanent P0-A baselines untouched & verified:** `design-audit/baseline-screenshots` & `baseline-screenshots-light` untouched; `162/162` Dark + `162/162` Light comparisons show zero visual regressions.
- [x] **Static & runtime verification gates green:** `typecheck`, Vitest (`946/946`), ESLint (`0` warnings), `check:interface`, `next build` (`819` routes), `check:performance`, and Playwright E2E all passed.
- [x] **Isolated to P0-B scope:** Zero unrelated CSS cleanup, zero page redesigns, `P0-C` not started.
