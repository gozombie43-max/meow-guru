# PR P0-A — Canonical Token Architecture & Legacy Compatibility Report

**Phase:** Phase 2 — PR `P0-A` (Tokens, `@theme inline`, Legacy Compatibility Bridge, Motion & Visual Safeguard Verification)  
**Scope:** Establish the canonical Meow design-token layer under `frontend/design-system/tokens/` and wire it into `frontend/app/globals.css` with **zero unintended visual changes** to existing routes prior to incremental `P0-B`–`P5` migration.

---

## 1. Files Created & Modified in PR `P0-A`

| File | Role | Notes |
| --- | --- | --- |
| [theme.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/tokens/theme.css) | Canonical `--meow-*` dark/light semantic tokens, structural scales, Tailwind v4 `@theme inline`, and nested theme isolation | Exposes `bg-meow-*`, `text-meow-*`, `border-meow-*`, `font-meow-*`, `radius-meow-*` without overwriting Tailwind built-ins |
| [legacy-bridge.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/tokens/legacy-bridge.css) | Read-only `:root` compatibility reference (`--meow-compat-*`) + progressive opt-in `[data-meow-tokens]` scope | Leaves all existing global variables untouched until a subtree opts in via `data-meow-tokens` |
| [motion.css](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/tokens/motion.css) | Shared durations, cubic-bezier easings, keyframes (`meow-spin`, `meow-fade-in`, `meow-shake`), and `prefers-reduced-motion: reduce` overrides | Collapses `--meow-duration-*` and `[data-meow-motion]` animations/transitions to `0.01ms` under reduced motion |
| [tokens.test.ts](file:///c:/Users/91906/Ai%20ssc/frontend/design-system/tokens/tokens.test.ts) | Automated Vitest contract & WCAG luminance suite (6 tests) | Verifies `globals.css` wiring, `@theme inline`, Dark/Light token parity, WCAG AA `>= 4.5:1` ratios, `:root` isolation, and motion safety |
| [globals.css](file:///c:/Users/91906/Ai%20ssc/frontend/app/globals.css) | Root stylesheet entry | Inserts `@import "../design-system/tokens/theme.css";`, `legacy-bridge.css`, and `motion.css` at lines 2–4 immediately after `@import "tailwindcss";` |

---

## 2. Canonical vs. Legacy Token Mapping Matrix

### 2.1 Unmigrated Global Roots (`P0-A` Migration Safeguard)

Outside `[data-meow-tokens]`, all legacy global variables in `globals.css`, `dark-theme.css`, `light-theme.css`, and `interface.css` remain untouched on `:root` / `html.theme-dark` / `html.theme-light`, preserving existing screen rendering and existing `check:interface` / `web-guidelines` expectations:

- `:root` in `legacy-bridge.css` defines only read-only reference constants (`--meow-compat-dark-bg: #000000`, `--meow-compat-dark-surface: #1c1c1e`, `--meow-compat-dark-surface-muted: #2c2c2e`, `--meow-compat-dark-accent: #0a84ff`, `--meow-compat-light-bg: #f4f5f7`, `--meow-compat-light-surface: #ffffff`, `--meow-compat-light-accent: #007aff`).
- Chromium runtime check confirmed unmigrated elements still compute `--dark-canvas: #000`, `--oled-surface: #1c1c1e`, `--dark-text-muted: #ebebf566`, `--light-canvas: #f4f5f7` (light), `--ui-surface: #1c1c1e` (dark) / `#fff` (light), and `--ui-action: #0a84ff` (dark) / `#007aff` (light).

### 2.2 Progressive Opt-In Bridge (`[data-meow-tokens]`)

Subtrees opting in with `data-meow-tokens` remap legacy variable namespaces onto canonical `--meow-*` tokens across both dark and light modes, routing readable metadata tokens to `--meow-secondary` (never `--meow-muted`) and primary CTA fill tokens to `--meow-action-fill`:

| Legacy Namespace | Sample Bridged Variables | Canonical Target | Dark Value (`[data-meow-tokens]`) | Light Value (`[data-meow-tokens]`) |
| --- | --- | --- | --- | --- |
| `--oled-*` | `--oled-canvas`, `--oled-surface`, `--oled-hover`, `--oled-inset`, `--oled-text`, `--oled-secondary`, `--oled-selected`, `--oled-selected-soft` | `--meow-bg`, `--meow-surface`, `--meow-surface-subtle`, `--meow-text`, `--meow-secondary`, `--meow-action-fill`, `--meow-accent-soft` | `#080C11` / `#111722` / `#2563EB` | `#F4F6F9` / `#FFFFFF` / `#2563EB` |
| `--dark-*` | `--dark-canvas`, `--dark-surface`, `--dark-surface-muted`, `--dark-border`, `--dark-text`, `--dark-text-secondary`, `--dark-text-muted`, `--dark-accent`, `--dark-action`, `--theme-action` | `--meow-bg`, `--meow-surface`, `--meow-surface-subtle`, `--meow-border`, `--meow-text`, `--meow-secondary`, `--meow-accent`, `--meow-action-fill` | `--dark-text-muted: #929CAF`, `--dark-action: #2563EB` | `--dark-text-muted: #4B5565`, `--dark-action: #2563EB` |
| `--light-*` | `--light-canvas`, `--light-surface`, `--light-surface-muted`, `--light-border`, `--light-text`, `--light-text-secondary`, `--light-text-muted`, `--light-accent`, semantic pairs | `--meow-bg`, `--meow-surface`, `--meow-surface-subtle`, `--meow-border`, `--meow-text`, `--meow-secondary`, `--meow-accent`, semantic tokens | Adapts seamlessly via `--meow-*` | `#F4F6F9` / `#FFFFFF` / `#4B5565` / `#2563EB` |
| `--light-only-*` | `--light-only-canvas`, `--light-only-surface`, `--light-only-text`, `--light-only-text-muted`, semantic pairs | Scoped inside `html.theme-light [data-meow-tokens]`; reset to `initial` inside `.theme-dark`, `[data-theme="dark"]`, `.training-dark` | `initial` (unsets nested light card leaks) | `#F4F6F9` / `#FFFFFF` / `#111827` / `#4B5565` |
| `--ui-*` (`interface.css`) | `--ui-space-*`, `--ui-font-*`, `--ui-radius-*`, `--ui-control-height`, `--ui-surface`, `--ui-header-surface`, `--ui-muted-surface`, `--ui-border`, `--ui-text`, `--ui-secondary`, `--ui-accent`, `--ui-action`, `--ui-danger` | `--meow-space-*`, `--meow-text-*`, `--meow-radius-*`, `--meow-control-h-md`, `--meow-surface`, `--meow-bg`, `--meow-surface-subtle`, `--meow-border`, `--meow-text`, `--meow-secondary`, `--meow-accent`, `--meow-action-fill`, `--meow-danger-fill` | `--ui-surface: #111722`, `--ui-action: #2563EB` | `--ui-surface: #FFFFFF`, `--ui-action: #2563EB` |
| Generic / `globals.css` | `--background`, `--foreground`, `--bg`, `--surface`, `--card`, `--card-bg`, `--border`, `--line`, `--text-primary`, `--text-secondary`, `--text-muted`, `--text-light`, `--primary`, `--color-*` | `--meow-bg`, `--meow-text`, `--meow-surface`, `--meow-border`, `--meow-secondary`, `--meow-accent` | `--text-muted: #929CAF` | `--text-muted: #4B5565` |
| Feature Namespaces | `--tr-*`, `--tfp-*`, `--admin-*`, `--mac-*`, `--quiz-*` | Canonical `--meow-*` surface, ink, border, accent, font, and semantic feedback tokens | `--mac-window-bg: #111722`, `--admin-bg: #080C11`, `--quiz-surface: #111722` | `--mac-window-bg: #FFFFFF`, `--admin-bg: #F4F6F9`, `--quiz-surface: #FFFFFF` |

---

## 3. WCAG AA Accessibility Contrast Verification

All contrast ratios were verified computationally from `frontend/design-system/tokens/theme.css` (both in Vitest `tokens.test.ts` and direct Node luminance evaluation):

### 3.1 Dark Theme (`#080C11` / `#111722` / `#192231`)

| Pair / Policy Check | Foreground | Background | Ratio | Policy Verdict |
| --- | --- | --- | --- | --- |
| Primary text on canvas / surface / subtle | `#F1F4F8` | `#080C11` / `#111722` / `#192231` | **17.77** / **16.28** / **14.48** | Pass (`>= 4.5:1`) |
| Secondary text (labels, placeholders, helper copy, normal metadata) | `#929CAF` | `#080C11` / `#111722` / `#192231` | **7.09** / **6.50** / **5.78** | Pass (`>= 4.5:1`) |
| Accent light ink/links on canvas / surface / subtle | `#60A5FA` | `#080C11` / `#111722` / `#192231` | **7.71** / **7.06** / **6.28** | Pass (`>= 4.5:1`) |
| Visual accent on surface (`#3B82F6`) | `#3B82F6` | `#111722` | **4.88** | Pass for highlights/icons/focus |
| White CTA label on `--meow-action-fill` (default & hover) | `#FFFFFF` | `#2563EB` / `#1D4ED8` | **5.17** / **6.70** | Pass (`>= 4.5:1`); separated from `#3B82F6` (`3.68:1` on white) |
| White label on `--meow-danger-fill` | `#FFFFFF` | `#DC2626` | **4.83** | Pass (`>= 4.5:1`) |
| Semantic feedback on `-soft` containers | `#34D399`/`#0E2923`, `#FBBF24`/`#2C220D`, `#F87171`/`#31151B`, `#60A5FA`/`#13243F` | Soft pairs | **8.03**, **9.38**, **6.06**, **6.11** | Pass (`>= 4.5:1`) |
| Semantic feedback on `#111722` surface | `#34D399`, `#FBBF24`, `#F87171`, `#60A5FA` | `#111722` | **9.34**, **10.76**, **6.49**, **7.06** | Pass (`>= 4.5:1`) |
| `--meow-muted` restriction check | `#687386` | `#080C11` / `#111722` / `#192231` | **4.09** / **3.75** / **3.34** | **Restricted strictly to disabled controls & decorative/non-text elements** |

### 3.2 Light Theme (`#F4F6F9` / `#FFFFFF` / `#EBF0F5`)

| Pair / Policy Check | Foreground | Background | Ratio | Policy Verdict |
| --- | --- | --- | --- | --- |
| Primary text on canvas / surface / subtle | `#111827` | `#F4F6F9` / `#FFFFFF` / `#EBF0F5` | **16.39** / **17.74** / **15.47** | Pass (`>= 4.5:1`) |
| Secondary text on canvas / surface / subtle | `#4B5565` | `#F4F6F9` / `#FFFFFF` / `#EBF0F5` | **6.96** / **7.54** / **6.57** | Pass (`>= 4.5:1`) |
| Muted text on canvas / surface / subtle | `#5D6778` | `#F4F6F9` / `#FFFFFF` / `#EBF0F5` | **5.28** / **5.71** / **4.98** | Pass (`>= 4.5:1`) |
| Accent (`#2563EB`) on canvas / surface / subtle | `#2563EB` | `#F4F6F9` / `#FFFFFF` / `#EBF0F5` | **4.77** / **5.17** / **4.51** | Pass (`>= 4.5:1`) |
| White CTA label on `--meow-action-fill` (default & hover) | `#FFFFFF` | `#2563EB` / `#1D4ED8` | **5.17** / **6.70** | Pass (`>= 4.5:1`) |
| White label on `--meow-danger-fill` | `#FFFFFF` | `#DC2626` | **4.83** | Pass (`>= 4.5:1`) |
| Semantic feedback on `-soft` containers | `#15803D`/`#ECFDF3`, `#92400E`/`#FEF3C7`, `#B91C1C`/`#FEE2E2`, `#1D4ED8`/`#EFF6FF` | Soft pairs | **4.76**, **6.37**, **5.30**, **6.16** | Pass (`>= 4.5:1`) |

---

## 4. Runtime, Build & Cross-Route Visual Comparison Results

### 4.1 Static Checks, Production Build & Browser Regression Suites

- **TypeScript (`tsc --noEmit`), Vitest & ESLint** (`npm run check --workspace frontend`):
  - 0 TypeScript errors, 0 ESLint warnings/errors, `150` test files (`936` tests) passed including `design-system/tokens/tokens.test.ts` (`6/6`).
- **Interface & Theme Contract Checks** (`npm run check:interface --workspace frontend`):
  - `check-interface.mjs`, `check-ui-contract.mjs` (`383` interface source files), and `check-light-theme.mjs` passed across `light` / `dark` and `320px`, `390px`, `768px`, `1366px`, `1440px`.
- **Production Build & Performance Budgets** (`npm run build --workspace frontend` & `npm run check:performance --workspace frontend`):
  - Compiled cleanly with `819/819` static routes generated and performance budgets passing.
- **Headless Chromium Token & Tailwind v4 Probe**:
  - Verified built `.next/static/chunks/*.css` includes all canonical tokens, `[data-meow-tokens]`, and `meow-spin`.
  - Compiled Tailwind v4 `@theme inline` classes dynamically resolved in Chromium: dark (`rgb(17, 23, 34)` surface, `rgb(241, 244, 248)` text, `rgb(34, 42, 56)` border, `rgb(37, 99, 235)` CTA) <-> light (`rgb(255, 255, 255)` surface, `rgb(17, 24, 39)` text, `rgb(220, 227, 236)` border, `rgb(37, 99, 235)` CTA).
  - Verified `[data-meow-tokens]` progressive bridging, nested `.theme-dark`/`.theme-light` isolation, and `prefers-reduced-motion: reduce` (`--meow-duration-*` collapsed to `.01ms` / `1e-05s`).
- **Playwright E2E Suites** (`e2e/web-guidelines.spec.ts`, `e2e/architecture.spec.ts`, `e2e/mobile-quiz-design.spec.ts`, `e2e/navigation.spec.ts`):
  - `18` passed, `16` project-gated skips (desktop-only tests skipped on `mobile` project and vice-versa), `0` failures.

### 4.2 Route-by-Route Screenshot Pixel Comparison (Pre-`P0-A` Baseline vs. Post-`P0-A`)

Pre-change baselines are archived in [`design-audit/baseline-screenshots/`](file:///c:/Users/91906/Ai%20ssc/design-audit/baseline-screenshots) (Dark) and [`design-audit/baseline-screenshots-light/`](file:///c:/Users/91906/Ai%20ssc/design-audit/baseline-screenshots-light) (Light). Dynamic session/attempt UUID directories (`/play/session/[id]`, `/mock-test/.../result/[attemptId]`, `/mock-test/.../review/[attemptId]`) were normalized by path prefix and compared pixel-by-pixel using HTML5 `<canvas>` in Chromium.

| Theme | Captured Pairs | Skipped Dynamic Template Routes | Exact Pixel Matches | Non-Zero Pixel Diffs | Missing / Extra / Dimension Mismatch |
| --- | --- | --- | --- | --- | --- |
| **Dark** | `162` (`81` desktop + `81` mobile) | `8` (`/subjects/[subject]/[topic]*`) | `141` (`141` byte-identical) | `21` (max diff `0.0754%`) | `0` / `0` / `0` |
| **Light** | `162` (`81` desktop + `81` mobile) | `8` (`/subjects/[subject]/[topic]*`) | `140` (`140` byte-identical) | `22` (max diff `0.0252%`) | `0` / `0` / `0` |

Visual diff inspection of all non-zero routes confirmed zero CSS, color, typography, border, or layout regressions:
- **Home Hero Typing Carousel** (`desktop/home`): `927 px` (`0.0754%`) in dark / `301 px` (`0.0245%`) in light strictly localized to the animated subject word cycle (`MATH` / `GK`).
- **Live Session Elapsed Timer** (`play/session/[uuid]`): `83 px` (`0.0252%`) mobile dark, `93 px` (`0.0076%`) desktop light, and `83 px` (`0.0252%`) mobile light strictly localized to the `You 1s` vs `You 2s` counter tick.
- **Rasterized Thumbnail / Rounded Corner Anti-Aliasing**: remaining diffs across formula-notes, subject hubs, battle subroutes, notifications, check-email, and profile were `3–172 px` (`0.0002%–0.0201%`, mostly `maxDiff <= 2`).

---

## 5. P0-A Acceptance Checklist Status

- [x] Pre-change Light and Dark screenshot baselines archived (`162` + `162` PNGs).
- [x] Three canonical token files created (`theme.css`, `legacy-bridge.css`, `motion.css`) plus `tokens.test.ts`.
- [x] Tailwind v4 `@theme inline` working cleanly without colliding with default utilities.
- [x] Light/dark theme switching and nested theme isolation preserved.
- [x] Legacy token bridge verified (`:root` untouched on unmigrated subtrees; `[data-meow-tokens]` routes all legacy namespaces).
- [x] Reduced-motion support verified (`prefers-reduced-motion: reduce`).
- [x] WCAG AA contrast checks passed (including `#929CAF` vs `#687386` and `--meow-action-fill: #2563EB` policy corrections).
- [x] TypeScript, unit tests, ESLint, interface checks, and Next.js production build + performance budget checks passed.
- [x] Before/after Chromium pixel comparison completed across Dark & Light routes (`324` screenshots total) with zero visual regressions.
- [x] No unrelated application files modified (`git diff --stat` confirms only `frontend/app/globals.css` +3 lines + new `frontend/design-system/tokens/`).
